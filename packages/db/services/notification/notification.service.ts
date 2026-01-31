import {
  notifications,
  user,
  type NotificationType,
} from "../../schemas";
import { eq, and, desc, lt, sql, inArray } from "drizzle-orm";

import type { DbClient } from "../types";

// ─── Types ─────────────────────────────────────────────────────────────────

export type NotificationItem = {
  id: number;
  type: NotificationType;
  actorId: string;
  actorName: string;
  actorImage: string | null;
  activityEventId: number | null;
  mealPlanId: number | null;
  commentId: number | null;
  isRead: boolean;
  createdAt: Date;
};

export type CreateNotificationParams = {
  recipientId: string;
  actorId: string;
  type: NotificationType;
  activityEventId?: number;
  mealPlanId?: number;
  commentId?: number;
};

// ─── Notification Operations ─────────────────────────────────────────────────

/**
 * Create a notification
 * Skips self-notifications (when actor === recipient)
 * Fetches actor info for denormalization
 */
export async function createNotification(
  db: DbClient,
  params: CreateNotificationParams
): Promise<NotificationItem | null> {
  const { recipientId, actorId, type, activityEventId, mealPlanId, commentId } =
    params;

  // Skip self-notifications
  if (recipientId === actorId) {
    return null;
  }

  // Fetch actor info for denormalization
  const actor = await db
    .select({ name: user.name, image: user.image })
    .from(user)
    .where(eq(user.id, actorId))
    .then((rows) => rows[0]);

  if (!actor) {
    return null;
  }

  const now = new Date();

  const [notification] = await db
    .insert(notifications)
    .values({
      recipientId,
      actorId,
      type,
      activityEventId: activityEventId ?? null,
      mealPlanId: mealPlanId ?? null,
      commentId: commentId ?? null,
      actorName: actor.name,
      actorImage: actor.image,
      isRead: false,
      createdAt: now,
    })
    .returning();

  if (!notification) {
    return null;
  }

  return {
    id: notification.id,
    type: notification.type as NotificationType,
    actorId: notification.actorId,
    actorName: notification.actorName,
    actorImage: notification.actorImage,
    activityEventId: notification.activityEventId,
    mealPlanId: notification.mealPlanId,
    commentId: notification.commentId,
    isRead: notification.isRead,
    createdAt: notification.createdAt,
  };
}

/**
 * Get paginated notifications for a user
 */
export async function getNotifications(
  db: DbClient,
  params: {
    userId: string;
    cursor?: number;
    limit?: number;
  }
): Promise<{
  items: NotificationItem[];
  nextCursor: number | null;
}> {
  const { userId, cursor, limit = 20 } = params;

  const conditions = cursor
    ? and(eq(notifications.recipientId, userId), lt(notifications.id, cursor))
    : eq(notifications.recipientId, userId);

  const results = await db
    .select()
    .from(notifications)
    .where(conditions)
    .orderBy(desc(notifications.createdAt))
    .limit(limit + 1);

  const hasMore = results.length > limit;
  const items = hasMore ? results.slice(0, limit) : results;

  const lastItem = items[items.length - 1];
  const nextCursor = hasMore && lastItem ? lastItem.id : null;

  return {
    items: items.map((n) => ({
      id: n.id,
      type: n.type as NotificationType,
      actorId: n.actorId,
      actorName: n.actorName,
      actorImage: n.actorImage,
      activityEventId: n.activityEventId,
      mealPlanId: n.mealPlanId,
      commentId: n.commentId,
      isRead: n.isRead,
      createdAt: n.createdAt,
    })),
    nextCursor,
  };
}

/**
 * Get unread notification count for a user
 */
export async function getUnreadCount(
  db: DbClient,
  userId: string
): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(notifications)
    .where(
      and(eq(notifications.recipientId, userId), eq(notifications.isRead, false))
    )
    .then((rows) => rows[0]);

  return result?.count ?? 0;
}

/**
 * Mark notifications as read
 * If notificationIds is not provided, marks all notifications as read
 */
export async function markAsRead(
  db: DbClient,
  params: {
    userId: string;
    notificationIds?: number[];
  }
): Promise<{ success: boolean; updatedCount: number }> {
  const { userId, notificationIds } = params;

  let updatedCount = 0;

  if (notificationIds && notificationIds.length > 0) {
    // Mark specific notifications as read
    const result = await db
      .update(notifications)
      .set({ isRead: true })
      .where(
        and(
          eq(notifications.recipientId, userId),
          inArray(notifications.id, notificationIds),
          eq(notifications.isRead, false)
        )
      )
      .returning({ id: notifications.id });

    updatedCount = result.length;
  } else {
    // Mark all notifications as read
    const result = await db
      .update(notifications)
      .set({ isRead: true })
      .where(
        and(
          eq(notifications.recipientId, userId),
          eq(notifications.isRead, false)
        )
      )
      .returning({ id: notifications.id });

    updatedCount = result.length;
  }

  return { success: true, updatedCount };
}
