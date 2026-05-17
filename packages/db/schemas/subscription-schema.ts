import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  integer,
  serial,
  timestamp,
  boolean,
  jsonb,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";

import { user } from "./auth-schema";

export const subscriptionEntitlements = pgTable(
  "subscription_entitlements",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    adaptyProfileId: text("adapty_profile_id"),
    adaptyCustomerUserId: text("adapty_customer_user_id"),
    accessLevelId: text("access_level_id").notNull(),
    isActive: boolean("is_active").notNull().default(false),
    willRenew: boolean("will_renew"),
    expiresAt: timestamp("expires_at"),
    lastEventAt: timestamp("last_event_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("subscription_entitlements_user_id_unique_idx").on(
      table.userId,
    ),
    index("subscription_entitlements_adapty_profile_idx").on(
      table.adaptyProfileId,
    ),
    index("subscription_entitlements_customer_user_idx").on(
      table.adaptyCustomerUserId,
    ),
  ],
);

export const smartImportUsage = pgTable(
  "smart_import_usage",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    periodStart: timestamp("period_start").notNull(),
    usedCount: integer("used_count").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("smart_import_usage_user_period_unique_idx").on(
      table.userId,
      table.periodStart,
    ),
    index("smart_import_usage_user_idx").on(table.userId),
    check("smart_import_usage_used_count_check", sql`${table.usedCount} >= 0`),
  ],
);

export const adaptyWebhookEvents = pgTable(
  "adapty_webhook_events",
  {
    eventId: text("event_id").primaryKey(),
    eventType: text("event_type"),
    profileId: text("profile_id"),
    customerUserId: text("customer_user_id"),
    payload: jsonb("payload").notNull(),
    receivedAt: timestamp("received_at").notNull().defaultNow(),
  },
  (table) => [
    index("adapty_webhook_events_customer_user_idx").on(table.customerUserId),
    index("adapty_webhook_events_profile_idx").on(table.profileId),
    index("adapty_webhook_events_received_at_idx").on(table.receivedAt),
  ],
);
