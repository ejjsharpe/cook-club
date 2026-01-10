import {
  pgTable,
  text,
  serial,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

// ─── Follower system ─────────────────────────────────────────────────────────
export const follows = pgTable(
  "follows",
  {
    id: serial("id").primaryKey(),
    followerId: text("follower_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    followingId: text("following_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull(),
  },
  (table) => [
    index("follows_follower_id_idx").on(table.followerId),
    index("follows_following_id_idx").on(table.followingId),
    uniqueIndex("follows_follower_following_unique_idx").on(
      table.followerId,
      table.followingId
    ),
  ]
);
