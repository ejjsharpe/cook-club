import {
  shoppingLists,
  shoppingListItems,
  shoppingListRecipes,
  recipes,
  recipeIngredients,
} from "@repo/db/schemas";
import { eq, and, desc } from "drizzle-orm";

import {
  parseIngredient,
  normalizeIngredientName,
} from "../../../utils/ingredientParser";

// Re-export for convenience
export { parseIngredient, normalizeIngredientName };
import { normalizeUnit } from "../../../utils/unitNormalizer";
import type { DbClient, TransactionClient } from "../types";

// ─── Types ─────────────────────────────────────────────────────────────────

export interface ShoppingListItem {
  ingredientName: string;
  displayName: string;
  quantity: number | null;
  unit: string | null;
  recipeIds: number[];
  recipeNames: string[];
  isChecked: boolean;
  itemIds: number[];
}

// ─── Database Helper Functions ─────────────────────────────────────────────

/**
 * Get or create a shopping list for a user
 * Ensures type safety by always returning a defined shopping list
 */
export async function getOrCreateShoppingList(db: DbClient, userId: string) {
  const existingList = await db
    .select()
    .from(shoppingLists)
    .where(eq(shoppingLists.userId, userId))
    .then((rows) => rows[0]);

  if (existingList) {
    return existingList;
  }

  const newList = await db
    .insert(shoppingLists)
    .values({
      userId,
      name: "Shopping List",
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  return newList[0]!;
}

/**
 * Insert a shopping list item for a specific recipe
 * NEW MODEL: Creates ONE row per recipe-ingredient combination
 * No aggregation at insert time - aggregation happens at query time
 */
export async function insertShoppingListItem(
  db: DbClient | TransactionClient,
  params: {
    shoppingListId: number;
    ingredientName: string;
    quantity: number | null;
    unit: string | null;
    displayName: string;
    sourceRecipeId?: number;
    sourceRecipeName?: string;
  },
) {
  const {
    shoppingListId,
    ingredientName,
    quantity,
    unit,
    displayName,
    sourceRecipeId,
    sourceRecipeName,
  } = params;

  const normalizedName = normalizeIngredientName(ingredientName);
  const normalizedUnit = normalizeUnit(unit); // Normalize units for better aggregation

  // Insert new item - one row per recipe
  const [newItem] = await db
    .insert(shoppingListItems)
    .values({
      shoppingListId,
      ingredientName: normalizedName,
      displayName,
      quantity: quantity?.toString() || null,
      unit: normalizedUnit,
      isChecked: false,
      sourceRecipeId: sourceRecipeId || null,
      sourceRecipeName: sourceRecipeName || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  return newItem!;
}

// ─── Ingredient Formatting Helper Functions ────────────────────────────────

/**
 * Format quantity for display
 */
export function formatQuantity(quantity: number | null): string {
  if (!quantity) return "";

  // Format quantity with up to 2 decimal places, removing trailing zeros
  return quantity % 1 === 0
    ? quantity.toString()
    : quantity.toFixed(2).replace(/\.?0+$/, "");
}
