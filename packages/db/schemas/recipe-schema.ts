import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { user } from "./auth-schema";

// ─── Central recipes store ────────────────────────────────────────────────────
export const recipes = sqliteTable("recipes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  uploadedBy: text("uploaded_by").notNull(),
  description: text("description"),
  prepTime: text("prep_time"),
  cookTime: text("cook_time"),
  totalTime: text("total_time"),
  servings: integer("servings"),
  category: text("category"),
  cuisine: text("cuisine"),
  keywords: text("keywords"),
  nutrition: text("nutrition"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),

  // properties for scraped recipes
  author: text("author"),
  scrapedAt: integer("scraped_at", { mode: "timestamp" }), // only for scraped recipes
  sourceUrl: text("source_url"),
  datePublished: integer("date_published", { mode: "timestamp" }),
});

// ─── Join table: which users have saved or uploaded recipes ─────────────────
export const userRecipes = sqliteTable("user_recipes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  recipeId: integer("recipe_id")
    .notNull()
    .references(() => recipes.id, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

// ─── Additional recipe detail tables ─────────────────────────────────────────
export const recipeImages = sqliteTable("recipe_images", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  recipeId: integer("recipe_id")
    .notNull()
    .references(() => recipes.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
});

export const recipeIngredients = sqliteTable("recipe_ingredients", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  recipeId: integer("recipe_id")
    .notNull()
    .references(() => recipes.id, { onDelete: "cascade" }),
  index: integer("index").notNull(),
  ingredient: text("ingredient").notNull(),
});

export const recipeInstructions = sqliteTable("recipe_instructions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  recipeId: integer("recipe_id")
    .notNull()
    .references(() => recipes.id, { onDelete: "cascade" }),
  index: integer("index").notNull(),
  instruction: text("instruction").notNull(),
});
