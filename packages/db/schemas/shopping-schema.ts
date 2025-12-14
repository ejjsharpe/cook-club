import {
  pgTable,
  text,
  integer,
  serial,
  timestamp,
  boolean,
  index,
  numeric,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";
import { recipes } from "./recipe-schema";

// ─── Shopping Lists: user's shopping list ──────────────────────────────────
export const shoppingLists = pgTable(
  "shopping_lists",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull().default("Shopping List"),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
  },
  (table) => [index("shopping_lists_user_id_idx").on(table.userId)]
);

// ─── Shopping List Items: individual recipe-ingredient rows ──────────────
// Each row represents ONE recipe's contribution OR a manual item
// Items with the same ingredientName + unit are aggregated at query time for display
export const shoppingListItems = pgTable(
  "shopping_list_items",
  {
    id: serial("id").primaryKey(),
    shoppingListId: integer("shopping_list_id")
      .notNull()
      .references(() => shoppingLists.id, { onDelete: "cascade" }),
    // Normalized ingredient name for grouping (lowercase, trimmed)
    ingredientName: text("ingredient_name").notNull(),
    // Original display name (preserves casing, e.g. "Chicken Breast")
    displayName: text("display_name").notNull(),
    // Quantity for this specific recipe or manual entry
    quantity: numeric("quantity"),
    // Parsed unit (e.g., "cups", "tsp")
    unit: text("unit"),
    // Whether the item is checked off
    isChecked: boolean("is_checked").notNull().default(false),
    // Source recipe ID (null for manual items or user-edited/unlinked items)
    // Only ONE recipe per row - this is the key change from the old model
    sourceRecipeId: integer("source_recipe_id"),
    // Source recipe name for display (null for manual items)
    sourceRecipeName: text("source_recipe_name"),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
  },
  (table) => [
    index("shopping_list_items_shopping_list_id_idx").on(table.shoppingListId),
    index("shopping_list_items_is_checked_idx").on(table.isChecked),
    index("shopping_list_items_shopping_list_ingredient_idx").on(
      table.shoppingListId,
      table.ingredientName
    ),
    // Index for finding items by recipe for efficient removal
    index("shopping_list_items_source_recipe_idx").on(table.sourceRecipeId),
  ]
);

// ─── Shopping List Recipes: tracks which recipes are in shopping list ─────
export const shoppingListRecipes = pgTable(
  "shopping_list_recipes",
  {
    id: serial("id").primaryKey(),
    shoppingListId: integer("shopping_list_id")
      .notNull()
      .references(() => shoppingLists.id, { onDelete: "cascade" }),
    recipeId: integer("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    // Cached for display to avoid joins
    recipeName: text("recipe_name").notNull(),
    // Cached first image URL for thumbnail
    recipeImageUrl: text("recipe_image_url"),
    createdAt: timestamp("created_at").notNull(),
  },
  (table) => [
    index("shopping_list_recipes_shopping_list_id_idx").on(
      table.shoppingListId
    ),
    index("shopping_list_recipes_recipe_id_idx").on(table.recipeId),
    index("shopping_list_recipes_shopping_list_recipe_idx").on(
      table.shoppingListId,
      table.recipeId
    ),
  ]
);
