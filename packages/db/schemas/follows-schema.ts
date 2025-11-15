import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

// ─── Follower system ─────────────────────────────────────────────────────────
export const follows = pgTable("follows", {
  id: serial("id").primaryKey(),
  followerId: text("follower_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  followingId: text("following_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull(),
});
