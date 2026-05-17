import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  integer,
  serial,
  timestamp,
  boolean,
  index,
  uniqueIndex,
  check,
  jsonb,
} from "drizzle-orm/pg-core";

import { activityEvents } from "./activity-schema";
import { user } from "./auth-schema";
import { comments } from "./comments-schema";
import { mealPlans } from "./meal-plan-schema";
import { shoppingLists } from "./shopping-schema";

// ─── Notifications - user notifications for social events ─────────────────────
export const notifications = pgTable(
  "notifications",
  {
    id: serial("id").primaryKey(),
    recipientId: text("recipient_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    actorId: text("actor_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // "follow" | "meal_plan_share" | "activity_like" | "activity_comment" | "comment_reply"
    type: text("type").notNull(),

    // Entity references (nullable based on type)
    activityEventId: integer("activity_event_id").references(
      () => activityEvents.id,
      { onDelete: "cascade" },
    ),
    mealPlanId: integer("meal_plan_id").references(() => mealPlans.id, {
      onDelete: "cascade",
    }),
    shoppingListId: integer("shopping_list_id").references(
      () => shoppingLists.id,
      { onDelete: "cascade" },
    ),
    commentId: integer("comment_id").references(() => comments.id, {
      onDelete: "cascade",
    }),

    // Denormalized actor info for efficient queries
    actorName: text("actor_name").notNull(),
    actorImage: text("actor_image"),

    isRead: boolean("is_read").notNull().default(false),
    createdAt: timestamp("created_at").notNull(),
  },
  (table) => [
    index("notifications_recipient_created_idx").on(
      table.recipientId,
      table.createdAt.desc(),
    ),
    index("notifications_recipient_unread_idx").on(
      table.recipientId,
      table.isRead,
    ),
    check(
      "notifications_type_check",
      sql`${table.type} IN ('follow', 'meal_plan_share', 'meal_plan_invite', 'shopping_list_invite', 'activity_like', 'activity_comment', 'comment_reply')`,
    ),
  ],
);

// Type exports for notification types
export type NotificationType =
  | "follow"
  | "meal_plan_share"
  | "meal_plan_invite"
  | "shopping_list_invite"
  | "activity_like"
  | "activity_comment"
  | "comment_reply";

// ─── Expo Push Tokens ────────────────────────────────────────────────────────
export const pushTokens = pgTable(
  "push_tokens",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    expoPushToken: text("expo_push_token").notNull(),
    platform: text("platform").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    lastSeenAt: timestamp("last_seen_at").notNull(),
    disabledAt: timestamp("disabled_at"),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("push_tokens_expo_push_token_unique").on(table.expoPushToken),
    index("push_tokens_user_enabled_idx").on(table.userId, table.enabled),
    check(
      "push_tokens_platform_check",
      sql`${table.platform} IN ('ios', 'android', 'web')`,
    ),
  ],
);

export const pushNotificationTickets = pgTable(
  "push_notification_tickets",
  {
    id: serial("id").primaryKey(),
    notificationId: integer("notification_id")
      .notNull()
      .references(() => notifications.id, { onDelete: "cascade" }),
    pushTokenId: integer("push_token_id")
      .notNull()
      .references(() => pushTokens.id, { onDelete: "cascade" }),
    expoTicketId: text("expo_ticket_id"),
    status: text("status").notNull(),
    message: text("message"),
    details: jsonb("details"),
    receiptStatus: text("receipt_status").notNull().default("pending"),
    receiptCheckedAt: timestamp("receipt_checked_at"),
    receiptError: text("receipt_error"),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("push_notification_tickets_expo_ticket_id_unique").on(
      table.expoTicketId,
    ),
    index("push_notification_tickets_notification_idx").on(
      table.notificationId,
    ),
    index("push_notification_tickets_receipt_idx").on(
      table.receiptStatus,
      table.createdAt,
    ),
    check(
      "push_notification_tickets_status_check",
      sql`${table.status} IN ('ok', 'error')`,
    ),
    check(
      "push_notification_tickets_receipt_status_check",
      sql`${table.receiptStatus} IN ('pending', 'ok', 'error', 'unavailable')`,
    ),
  ],
);

export type PushPlatform = "ios" | "android" | "web";
