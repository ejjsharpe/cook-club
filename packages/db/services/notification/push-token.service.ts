import { and, eq, inArray, isNotNull, lte } from "drizzle-orm";

import {
  pushNotificationTickets,
  pushTokens,
  type PushPlatform,
} from "../../schemas";
import type { DbClient } from "../types";

export type PushTokenItem = {
  id: number;
  userId: string;
  expoPushToken: string;
  platform: PushPlatform;
  enabled: boolean;
};

export type PushTicketInsert = {
  notificationId: number;
  pushTokenId: number;
  expoTicketId?: string | null;
  status: "ok" | "error";
  message?: string | null;
  details?: unknown;
  receiptStatus?: "pending" | "unavailable";
};

export type PendingPushTicket = {
  id: number;
  pushTokenId: number;
  expoTicketId: string;
};

export async function registerPushToken(
  db: DbClient,
  params: {
    userId: string;
    expoPushToken: string;
    platform: PushPlatform;
  },
): Promise<PushTokenItem> {
  const now = new Date();
  const [token] = await db
    .insert(pushTokens)
    .values({
      userId: params.userId,
      expoPushToken: params.expoPushToken,
      platform: params.platform,
      enabled: true,
      lastSeenAt: now,
      disabledAt: null,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: pushTokens.expoPushToken,
      set: {
        userId: params.userId,
        platform: params.platform,
        enabled: true,
        lastSeenAt: now,
        disabledAt: null,
        updatedAt: now,
      },
    })
    .returning();

  if (!token) {
    throw new Error("Failed to register push token");
  }

  return {
    id: token.id,
    userId: token.userId,
    expoPushToken: token.expoPushToken,
    platform: token.platform as PushPlatform,
    enabled: token.enabled,
  };
}

export async function unregisterPushToken(
  db: DbClient,
  params: {
    userId: string;
    expoPushToken: string;
  },
): Promise<{ success: boolean; updatedCount: number }> {
  const now = new Date();
  const updated = await db
    .update(pushTokens)
    .set({ enabled: false, disabledAt: now, updatedAt: now })
    .where(
      and(
        eq(pushTokens.userId, params.userId),
        eq(pushTokens.expoPushToken, params.expoPushToken),
      ),
    )
    .returning({ id: pushTokens.id });

  return { success: true, updatedCount: updated.length };
}

export async function disablePushToken(
  db: DbClient,
  pushTokenId: number,
): Promise<void> {
  const now = new Date();
  await db
    .update(pushTokens)
    .set({ enabled: false, disabledAt: now, updatedAt: now })
    .where(eq(pushTokens.id, pushTokenId));
}

export async function getEnabledPushTokensForUser(
  db: DbClient,
  userId: string,
): Promise<PushTokenItem[]> {
  const rows = await db
    .select({
      id: pushTokens.id,
      userId: pushTokens.userId,
      expoPushToken: pushTokens.expoPushToken,
      platform: pushTokens.platform,
      enabled: pushTokens.enabled,
    })
    .from(pushTokens)
    .where(and(eq(pushTokens.userId, userId), eq(pushTokens.enabled, true)));

  return rows.map((row) => ({
    ...row,
    platform: row.platform as PushPlatform,
  }));
}

export async function createPushNotificationTickets(
  db: DbClient,
  tickets: PushTicketInsert[],
): Promise<void> {
  if (tickets.length === 0) {
    return;
  }

  const now = new Date();
  await db.insert(pushNotificationTickets).values(
    tickets.map((ticket) => ({
      notificationId: ticket.notificationId,
      pushTokenId: ticket.pushTokenId,
      expoTicketId: ticket.expoTicketId ?? null,
      status: ticket.status,
      message: ticket.message ?? null,
      details: ticket.details ?? null,
      receiptStatus:
        ticket.status === "ok"
          ? (ticket.receiptStatus ?? "pending")
          : (ticket.receiptStatus ?? "unavailable"),
      receiptError: null,
      createdAt: now,
      updatedAt: now,
    })),
  );
}

export async function getPendingPushNotificationTickets(
  db: DbClient,
  params: { olderThan: Date; limit?: number },
): Promise<PendingPushTicket[]> {
  const rows = await db
    .select({
      id: pushNotificationTickets.id,
      pushTokenId: pushNotificationTickets.pushTokenId,
      expoTicketId: pushNotificationTickets.expoTicketId,
    })
    .from(pushNotificationTickets)
    .where(
      and(
        eq(pushNotificationTickets.receiptStatus, "pending"),
        isNotNull(pushNotificationTickets.expoTicketId),
        lte(pushNotificationTickets.createdAt, params.olderThan),
      ),
    )
    .limit(params.limit ?? 300);

  return rows
    .filter((row): row is PendingPushTicket => row.expoTicketId !== null)
    .map((row) => ({
      id: row.id,
      pushTokenId: row.pushTokenId,
      expoTicketId: row.expoTicketId,
    }));
}

export async function markPushTicketReceipts(
  db: DbClient,
  receipts: {
    ticketId: number;
    status: "ok" | "error" | "unavailable";
    message?: string | null;
    details?: unknown;
  }[],
): Promise<void> {
  const now = new Date();

  await Promise.all(
    receipts.map((receipt) =>
      db
        .update(pushNotificationTickets)
        .set({
          receiptStatus: receipt.status,
          receiptCheckedAt: now,
          receiptError: receipt.message ?? null,
          details: receipt.details ?? null,
          updatedAt: now,
        })
        .where(eq(pushNotificationTickets.id, receipt.ticketId)),
    ),
  );
}

export async function markPushTicketsUnavailable(
  db: DbClient,
  ticketIds: number[],
): Promise<void> {
  if (ticketIds.length === 0) {
    return;
  }

  const now = new Date();
  await db
    .update(pushNotificationTickets)
    .set({
      receiptStatus: "unavailable",
      receiptCheckedAt: now,
      receiptError: "Receipt was not returned by Expo",
      updatedAt: now,
    })
    .where(inArray(pushNotificationTickets.id, ticketIds));
}
