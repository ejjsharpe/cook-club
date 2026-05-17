import {
  createNotification,
  createPushNotificationTickets,
  disablePushToken,
  getEnabledPushTokensForUser,
  getPendingPushNotificationTickets,
  markPushTicketReceipts,
  markPushTicketsUnavailable,
  type CreateNotificationParams,
  type NotificationItem,
  type PushTicketInsert,
  type PushTokenItem,
  DbClient,
} from "@repo/db/services";

import type { TRPCEnv } from "../env";

const EXPO_PUSH_SEND_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_PUSH_RECEIPTS_URL = "https://exp.host/--/api/v2/push/getReceipts";
const EXPO_SEND_BATCH_SIZE = 100;
const EXPO_RECEIPT_BATCH_SIZE = 300;
const RECEIPT_MIN_AGE_MS = 15 * 60 * 1000;

export type PushNotificationData = {
  notificationId: number;
  type: NotificationItem["type"];
  actorId: string;
  activityEventId?: number;
  mealPlanId?: number;
  shoppingListId?: number;
  commentId?: number;
};

type ExpoPushMessage = {
  to: string;
  sound: "default";
  title: string;
  body: string;
  data: PushNotificationData;
  channelId?: string;
};

type ExpoTicket = {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: unknown;
};

type ExpoReceipt = {
  status: "ok" | "error";
  message?: string;
  details?: unknown;
};

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function getNotificationActionText(type: NotificationItem["type"]): string {
  switch (type) {
    case "follow":
      return "started following you";
    case "meal_plan_share":
      return "shared a meal plan with you";
    case "meal_plan_invite":
      return "invited you to a meal plan";
    case "shopping_list_invite":
      return "invited you to a shopping list";
    case "activity_like":
      return "liked your activity";
    case "activity_comment":
      return "commented on your activity";
    case "comment_reply":
      return "replied to your comment";
    default:
      return "interacted with you";
  }
}

export function getPushNotificationBody(
  notification: Pick<NotificationItem, "actorName" | "type">,
): string {
  return `${notification.actorName} ${getNotificationActionText(notification.type)}`;
}

export function getPushNotificationData(
  notification: NotificationItem,
): PushNotificationData {
  return {
    notificationId: notification.id,
    type: notification.type,
    actorId: notification.actorId,
    ...(notification.activityEventId
      ? { activityEventId: notification.activityEventId }
      : {}),
    ...(notification.mealPlanId ? { mealPlanId: notification.mealPlanId } : {}),
    ...(notification.shoppingListId
      ? { shoppingListId: notification.shoppingListId }
      : {}),
    ...(notification.commentId ? { commentId: notification.commentId } : {}),
  };
}

function getAuthHeaders(env: TRPCEnv): Record<string, string> {
  const expoAccessToken = env.EXPO_ACCESS_TOKEN;
  return expoAccessToken ? { Authorization: `Bearer ${expoAccessToken}` } : {};
}

export function buildExpoPushMessages(
  notification: NotificationItem,
  tokens: PushTokenItem[],
): ExpoPushMessage[] {
  const body = getPushNotificationBody(notification);
  const data = getPushNotificationData(notification);

  return tokens.map((token) => ({
    to: token.expoPushToken,
    sound: "default",
    title: "Cook Club",
    body,
    data,
    ...(token.platform === "android" ? { channelId: "default" } : {}),
  }));
}

export function isDeviceNotRegistered(details: unknown): boolean {
  return (
    typeof details === "object" &&
    details !== null &&
    "error" in details &&
    details.error === "DeviceNotRegistered"
  );
}

export function mapExpoTicketsToRows(params: {
  notificationId: number;
  tokens: PushTokenItem[];
  tickets: ExpoTicket[];
}): PushTicketInsert[] {
  return params.tokens.map((token, index) => {
    const ticket = params.tickets[index];

    if (!ticket) {
      return {
        notificationId: params.notificationId,
        pushTokenId: token.id,
        status: "error",
        message: "Expo did not return a ticket for this token",
        receiptStatus: "unavailable",
      };
    }

    return {
      notificationId: params.notificationId,
      pushTokenId: token.id,
      expoTicketId: ticket.id ?? null,
      status: ticket.status,
      message: ticket.message ?? null,
      details: ticket.details,
      receiptStatus:
        ticket.status === "ok" && ticket.id ? "pending" : "unavailable",
    };
  });
}

async function sendExpoPushBatch(
  env: TRPCEnv,
  messages: ExpoPushMessage[],
): Promise<ExpoTicket[]> {
  const response = await fetch(EXPO_PUSH_SEND_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...getAuthHeaders(env),
    },
    body: JSON.stringify(messages),
  });

  if (!response.ok) {
    const message = await response.text();
    return messages.map(() => ({
      status: "error",
      message: `Expo push request failed with ${response.status}: ${message}`,
    }));
  }

  const payload = (await response.json()) as { data?: ExpoTicket[] };
  return payload.data ?? [];
}

export async function sendPushForNotification(
  db: DbClient,
  env: TRPCEnv,
  notification: NotificationItem,
  recipientId: string,
): Promise<void> {
  const tokens = await getEnabledPushTokensForUser(db, recipientId);
  if (tokens.length === 0) {
    return;
  }

  const messages = buildExpoPushMessages(notification, tokens);
  const ticketRows: PushTicketInsert[] = [];

  for (let index = 0; index < messages.length; index += EXPO_SEND_BATCH_SIZE) {
    const messageBatch = messages.slice(index, index + EXPO_SEND_BATCH_SIZE);
    const tokenBatch = tokens.slice(index, index + EXPO_SEND_BATCH_SIZE);
    const tickets = await sendExpoPushBatch(env, messageBatch);

    await Promise.all(
      tickets.map((ticket, ticketIndex) => {
        const token = tokenBatch[ticketIndex];
        if (
          token &&
          ticket.status === "error" &&
          isDeviceNotRegistered(ticket.details)
        ) {
          return disablePushToken(db, token.id);
        }

        return Promise.resolve();
      }),
    );

    ticketRows.push(
      ...mapExpoTicketsToRows({
        notificationId: notification.id,
        tokens: tokenBatch,
        tickets,
      }),
    );
  }

  await createPushNotificationTickets(db, ticketRows);
}

export async function createAndSendNotification(
  ctx: { db: DbClient; env: TRPCEnv },
  params: CreateNotificationParams,
): Promise<NotificationItem | null> {
  const notification = await createNotification(ctx.db, params);

  if (notification) {
    await sendPushForNotification(
      ctx.db,
      ctx.env,
      notification,
      params.recipientId,
    );
  }

  return notification;
}

export function createAndSendNotificationInBackground(
  ctx: {
    db: DbClient;
    env: TRPCEnv;
    waitUntil?: (promise: Promise<unknown>) => void;
  },
  params: CreateNotificationParams,
  errorMessage: string,
): void {
  const promise = createAndSendNotification(ctx, params).catch((err) => {
    console.error(errorMessage, err);
  });

  if (ctx.waitUntil) {
    ctx.waitUntil(promise);
  }
}

async function fetchExpoReceipts(
  env: TRPCEnv,
  ids: string[],
): Promise<Record<string, ExpoReceipt>> {
  const response = await fetch(EXPO_PUSH_RECEIPTS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...getAuthHeaders(env),
    },
    body: JSON.stringify({ ids }),
  });

  if (!response.ok) {
    const message = await response.text();
    return Object.fromEntries(
      ids.map((id) => [
        id,
        {
          status: "error",
          message: `Expo receipt request failed with ${response.status}: ${message}`,
        },
      ]),
    );
  }

  const payload = (await response.json()) as {
    data?: Record<string, ExpoReceipt>;
  };
  return payload.data ?? {};
}

export async function processPushNotificationReceipts(
  db: DbClient,
  env: TRPCEnv,
): Promise<{ checked: number; disabledTokens: number }> {
  const olderThan = new Date(Date.now() - RECEIPT_MIN_AGE_MS);
  const pendingTickets = await getPendingPushNotificationTickets(db, {
    olderThan,
    limit: EXPO_RECEIPT_BATCH_SIZE,
  });

  let checked = 0;
  let disabledTokens = 0;

  for (const ticketBatch of chunk(pendingTickets, EXPO_RECEIPT_BATCH_SIZE)) {
    const receiptsById = await fetchExpoReceipts(
      env,
      ticketBatch.map((ticket) => ticket.expoTicketId),
    );
    const missingTicketIds = new Set(ticketBatch.map((ticket) => ticket.id));
    const receiptUpdates: Parameters<typeof markPushTicketReceipts>[1] = [];

    for (const ticket of ticketBatch) {
      const receipt = receiptsById[ticket.expoTicketId];
      if (!receipt) {
        continue;
      }

      missingTicketIds.delete(ticket.id);
      checked += 1;
      receiptUpdates.push({
        ticketId: ticket.id,
        status: receipt.status,
        message: receipt.message ?? null,
        details: receipt.details,
      });

      if (
        receipt.status === "error" &&
        isDeviceNotRegistered(receipt.details)
      ) {
        await disablePushToken(db, ticket.pushTokenId);
        disabledTokens += 1;
      }
    }

    await markPushTicketReceipts(db, receiptUpdates);
    await markPushTicketsUnavailable(db, [...missingTicketIds]);
  }

  return { checked, disabledTokens };
}
