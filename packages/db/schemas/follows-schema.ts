import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { user } from "./auth-schema";

// ─── Follower system ─────────────────────────────────────────────────────────
export const follows = sqliteTable("follows", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  followerId: text("follower_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  followingId: text("following_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});
