import {
  pgTable,
  text,
  integer,
  serial,
  timestamp,
  boolean,
  index,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";
import { activityEvents } from "./activity-schema";
import { mealPlans } from "./meal-plan-schema";
import { comments } from "./comments-schema";

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
      { onDelete: "cascade" }
    ),
    mealPlanId: integer("meal_plan_id").references(() => mealPlans.id, {
      onDelete: "cascade",
    }),
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
      table.createdAt.desc()
    ),
    index("notifications_recipient_unread_idx").on(
      table.recipientId,
      table.isRead
    ),
  ]
);

// Type exports for notification types
export type NotificationType =
  | "follow"
  | "meal_plan_share"
  | "activity_like"
  | "activity_comment"
  | "comment_reply";
