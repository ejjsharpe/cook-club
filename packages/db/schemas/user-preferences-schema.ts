import {
  pgTable,
  text,
  integer,
  serial,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";
import { tags } from "./recipe-schema";

// ─── User tag preferences (junction table for user taste preferences) ─────────
// Replaces the array columns (cuisineLikes, ingredientLikes, etc.) on user table
export const userTagPreferences = pgTable(
  "user_tag_preferences",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    tagId: integer("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
    // "cuisine_like", "cuisine_dislike", "ingredient_like", "ingredient_dislike", "dietary"
    preferenceType: text("preference_type").notNull(),
  },
  (table) => [
    index("user_tag_preferences_user_id_idx").on(table.userId),
    index("user_tag_preferences_tag_id_idx").on(table.tagId),
    index("user_tag_preferences_user_type_idx").on(
      table.userId,
      table.preferenceType
    ),
    uniqueIndex("user_tag_preferences_user_tag_type_idx").on(
      table.userId,
      table.tagId,
      table.preferenceType
    ),
  ]
);
