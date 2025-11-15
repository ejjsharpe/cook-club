import { pgTable, text, integer, serial, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

// ─── Central recipes store ────────────────────────────────────────────────────
export const recipes = pgTable("recipes", {
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
});

// ─── Join table: which users have saved or uploaded recipes ─────────────────
export const userRecipes = pgTable("user_recipes", {
  id: serial("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  recipeId: integer("recipe_id")
    .notNull()
    .references(() => recipes.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull(),
});

// ─── Additional recipe detail tables ─────────────────────────────────────────
export const recipeImages = pgTable("recipe_images", {
  id: serial("id").primaryKey(),
  recipeId: integer("recipe_id")
    .notNull()
    .references(() => recipes.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
});

export const recipeIngredients = pgTable("recipe_ingredients", {
  id: serial("id").primaryKey(),
  recipeId: integer("recipe_id")
    .notNull()
    .references(() => recipes.id, { onDelete: "cascade" }),
  index: integer("index").notNull(),
  ingredient: text("ingredient").notNull(),
});

export const recipeInstructions = pgTable("recipe_instructions", {
  id: serial("id").primaryKey(),
  recipeId: integer("recipe_id")
    .notNull()
    .references(() => recipes.id, { onDelete: "cascade" }),
  index: integer("index").notNull(),
  instruction: text("instruction").notNull(),
});

// ─── Tags system ─────────────────────────────────────────────────────────────
export const tags = pgTable("tags", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(), // e.g., "cuisine", "meal_type", "occasion"
  name: text("name").notNull(), // e.g., "Italian", "Breakfast", "Birthday Party"
});

export const recipeTags = pgTable("recipe_tags", {
  id: serial("id").primaryKey(),
  recipeId: integer("recipe_id")
    .notNull()
    .references(() => recipes.id, { onDelete: "cascade" }),
  tagId: integer("tag_id")
    .notNull()
    .references(() => tags.id, { onDelete: "cascade" }),
});
