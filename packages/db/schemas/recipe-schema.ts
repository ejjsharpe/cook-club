import {
  pgTable,
  text,
  integer,
  serial,
  timestamp,
  index,
  boolean,
  numeric,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { user } from "./auth-schema";

// ─── Central recipes store ────────────────────────────────────────────────────
export const recipes = pgTable(
  "recipes",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    uploadedBy: text("uploaded_by").notNull(),
    description: text("description"),
    prepTime: text("prep_time"),
    cookTime: text("cook_time"),
    totalTime: text("total_time"),
    servings: integer("servings"),
    nutrition: text("nutrition"),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),

    // properties for scraped recipes
    sourceUrl: text("source_url"),
  },
  (table) => [
    index("recipes_uploaded_by_idx").on(table.uploadedBy),
    index("recipes_created_at_idx").on(table.createdAt),
    index("recipes_name_idx").on(table.name),
  ]
);

// ─── Collections: user-created recipe collections ────────────────────────────
export const collections = pgTable(
  "collections",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
  },
  (table) => [
    index("collections_user_id_idx").on(table.userId),
    index("collections_user_id_created_at_idx").on(
      table.userId,
      table.createdAt.desc()
    ),
    // Ensure only one default collection per user
    index("collections_user_default_unique_idx")
      .on(table.userId, table.isDefault)
      .where(sql`${table.isDefault} = true`),
  ]
);

// ─── Join table: which recipes are in which collections ──────────────────────
export const recipeCollections = pgTable(
  "recipe_collections",
  {
    id: serial("id").primaryKey(),
    recipeId: integer("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    collectionId: integer("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull(),
  },
  (table) => [
    index("recipe_collections_recipe_id_idx").on(table.recipeId),
    index("recipe_collections_collection_id_idx").on(table.collectionId),
    index("recipe_collections_recipe_collection_idx").on(
      table.recipeId,
      table.collectionId
    ),
  ]
);

// ─── Join table: which users have liked recipes ──────────────────────────────
export const userLikes = pgTable(
  "user_likes",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    recipeId: integer("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull(),
  },
  (table) => [
    index("user_likes_user_id_idx").on(table.userId),
    index("user_likes_recipe_id_idx").on(table.recipeId),
    index("user_likes_user_recipe_idx").on(table.userId, table.recipeId),
  ]
);

// ─── Additional recipe detail tables ─────────────────────────────────────────
export const recipeImages = pgTable(
  "recipe_images",
  {
    id: serial("id").primaryKey(),
    recipeId: integer("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
  },
  (table) => [index("recipe_images_recipe_id_idx").on(table.recipeId)]
);

export const recipeIngredients = pgTable(
  "recipe_ingredients",
  {
    id: serial("id").primaryKey(),
    recipeId: integer("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    index: integer("index").notNull(),
    // Structured ingredient fields
    quantity: numeric("quantity"),
    unit: text("unit"),
    name: text("name").notNull(),
  },
  (table) => [
    index("recipe_ingredients_recipe_id_idx").on(table.recipeId),
    index("recipe_ingredients_recipe_id_index_idx").on(
      table.recipeId,
      table.index
    ),
  ]
);

export const recipeInstructions = pgTable(
  "recipe_instructions",
  {
    id: serial("id").primaryKey(),
    recipeId: integer("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    index: integer("index").notNull(),
    instruction: text("instruction").notNull(),
    imageUrl: text("image_url"),
  },
  (table) => [
    index("recipe_instructions_recipe_id_idx").on(table.recipeId),
    index("recipe_instructions_recipe_id_index_idx").on(
      table.recipeId,
      table.index
    ),
  ]
);

// ─── Tags system ─────────────────────────────────────────────────────────────
export const tags = pgTable(
  "tags",
  {
    id: serial("id").primaryKey(),
    type: text("type").notNull(), // e.g., "cuisine", "meal_type", "occasion"
    name: text("name").notNull(), // e.g., "Italian", "Breakfast", "Birthday Party"
  },
  (table) => [
    index("tags_type_idx").on(table.type),
    index("tags_type_name_idx").on(table.type, table.name),
  ]
);

export const recipeTags = pgTable(
  "recipe_tags",
  {
    id: serial("id").primaryKey(),
    recipeId: integer("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    tagId: integer("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("recipe_tags_recipe_id_idx").on(table.recipeId),
    index("recipe_tags_tag_id_idx").on(table.tagId),
  ]
);
