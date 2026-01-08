import {
  pgTable,
  text,
  integer,
  serial,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";
import { recipes } from "./recipe-schema";

// ─── Activity Events - tracks all user activities ────────────────────────────
export const activityEvents = pgTable(
  "activity_events",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: text("type").notNull(), // "recipe_import" | "cooking_review"
    recipeId: integer("recipe_id").references(() => recipes.id, {
      onDelete: "cascade",
    }),
    // Denormalized engagement counts
    likeCount: integer("like_count").notNull().default(0),
    commentCount: integer("comment_count").notNull().default(0),
    createdAt: timestamp("created_at").notNull(),
  },
  (table) => [
    index("activity_events_user_id_idx").on(table.userId),
    index("activity_events_created_at_idx").on(table.createdAt),
    index("activity_events_user_created_idx").on(
      table.userId,
      table.createdAt.desc()
    ),
  ]
);

// ─── Cooking Reviews - new feature for recipe reviews ────────────────────────
export const cookingReviews = pgTable(
  "cooking_reviews",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    recipeId: integer("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    activityEventId: integer("activity_event_id").references(
      () => activityEvents.id,
      { onDelete: "cascade" }
    ),
    rating: integer("rating").notNull(), // 1-5 stars
    reviewText: text("review_text"),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
  },
  (table) => [
    index("cooking_reviews_user_id_idx").on(table.userId),
    index("cooking_reviews_recipe_id_idx").on(table.recipeId),
    index("cooking_reviews_user_recipe_idx").on(table.userId, table.recipeId),
  ]
);

// ─── Review Images - multiple images per review ──────────────────────────────
export const cookingReviewImages = pgTable(
  "cooking_review_images",
  {
    id: serial("id").primaryKey(),
    reviewId: integer("review_id")
      .notNull()
      .references(() => cookingReviews.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    index: integer("index").notNull(), // for ordering
  },
  (table) => [
    index("cooking_review_images_review_id_idx").on(table.reviewId),
    index("cooking_review_images_review_id_index_idx").on(
      table.reviewId,
      table.index
    ),
  ]
);

// ─── Activity Likes - user likes on activity feed items ─────────────────────
export const activityLikes = pgTable(
  "activity_likes",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    activityEventId: integer("activity_event_id")
      .notNull()
      .references(() => activityEvents.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("activity_likes_activity_event_id_idx").on(table.activityEventId),
    index("activity_likes_user_id_idx").on(table.userId),
    uniqueIndex("activity_likes_user_activity_unique_idx").on(
      table.userId,
      table.activityEventId
    ),
  ]
);
