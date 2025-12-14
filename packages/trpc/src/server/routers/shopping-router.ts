import {
  shoppingLists,
  shoppingListItems,
  shoppingListRecipes,
  recipes,
  recipeIngredients,
  recipeImages,
} from "@repo/db/schemas";
import { TRPCError } from "@trpc/server";
import { type } from "arktype";
import { eq, and, desc, sql } from "drizzle-orm";
import { router, authedProcedure } from "../trpc";
import type { Context } from "../context";
import {
  parseIngredient,
  normalizeIngredientName,
} from "../../utils/ingredientParser";
import { normalizeUnit } from "../../utils/unitNormalizer";

// ─── Types ───────────────────────────────────────────────────────────────────

type DbClient = Context["db"];
type TransactionClient = Parameters<Parameters<DbClient["transaction"]>[0]>[0];

// ─── Database Helper Functions ───────────────────────────────────────────────

/**
 * Get or create a shopping list for a user
 * Ensures type safety by always returning a defined shopping list
 */
async function getOrCreateShoppingList(db: DbClient, userId: string) {
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
async function insertShoppingListItem(
  db: DbClient | TransactionClient,
  params: {
    shoppingListId: number;
    ingredientName: string;
    quantity: number | null;
    unit: string | null;
    displayName: string;
    sourceRecipeId?: number;
    sourceRecipeName?: string;
  }
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

// ─── Ingredient Formatting Helper Functions ─────────────────────────────────

/**
 * Format quantity for display
 */
function formatQuantity(quantity: number | null): string {
  if (!quantity) return "";

  // Format quantity with up to 2 decimal places, removing trailing zeros
  return quantity % 1 === 0
    ? quantity.toString()
    : quantity.toFixed(2).replace(/\.?0+$/, "");
}

// ─── Router ──────────────────────────────────────────────────────────────────

export const shoppingRouter = router({
  /**
   * Get user's shopping list with all items and recipes
   */
  getShoppingList: authedProcedure.query(async ({ ctx }) => {
    try {
      const shoppingList = await getOrCreateShoppingList(ctx.db, ctx.user.id);

      // Get all individual items (one row per recipe-ingredient)
      const rawItems = await ctx.db
        .select()
        .from(shoppingListItems)
        .where(eq(shoppingListItems.shoppingListId, shoppingList.id))
        .orderBy(desc(shoppingListItems.createdAt));

      // Aggregate items by ingredientName + unit
      const aggregatedItemsMap = new Map<
        string,
        {
          ingredientName: string;
          displayName: string;
          unit: string | null;
          totalQuantity: number;
          isChecked: boolean;
          items: Array<{
            id: number;
            quantity: number | null;
            sourceRecipeId: number | null;
            sourceRecipeName: string | null;
          }>;
        }
      >();

      for (const item of rawItems) {
        const key = `${item.ingredientName}::${item.unit || "null"}`;
        const quantity = item.quantity ? parseFloat(item.quantity) : 0;

        if (!aggregatedItemsMap.has(key)) {
          aggregatedItemsMap.set(key, {
            ingredientName: item.ingredientName,
            displayName: item.displayName,
            unit: item.unit,
            totalQuantity: quantity,
            isChecked: item.isChecked,
            items: [
              {
                id: item.id,
                quantity: quantity,
                sourceRecipeId: item.sourceRecipeId,
                sourceRecipeName: item.sourceRecipeName,
              },
            ],
          });
        } else {
          const existing = aggregatedItemsMap.get(key)!;
          existing.totalQuantity += quantity;
          existing.items.push({
            id: item.id,
            quantity: quantity,
            sourceRecipeId: item.sourceRecipeId,
            sourceRecipeName: item.sourceRecipeName,
          });
          // If ANY item is checked, mark the whole group as checked
          if (item.isChecked) {
            existing.isChecked = true;
          }
        }
      }

      // Convert map to array and format for display
      const items = Array.from(aggregatedItemsMap.values()).map((agg) => ({
        // We use the first item's ID as the group ID for operations
        id: agg.items[0]?.id || 0,
        ingredientName: agg.ingredientName,
        displayText: agg.unit
          ? `${formatQuantity(agg.totalQuantity)} ${agg.unit} ${agg.displayName}`
          : agg.totalQuantity
            ? `${formatQuantity(agg.totalQuantity)} ${agg.displayName}`
            : agg.displayName,
        quantity: agg.totalQuantity,
        unit: agg.unit,
        isChecked: agg.isChecked,
        // Return the underlying items for detailed view
        sourceItems: agg.items,
      }));

      // Sort: unchecked first, then by display text
      items.sort((a, b) => {
        if (a.isChecked !== b.isChecked) {
          return a.isChecked ? 1 : -1;
        }
        return a.displayText.localeCompare(b.displayText);
      });

      // Get all recipes in the shopping list
      const recipesList = await ctx.db
        .select({
          id: shoppingListRecipes.recipeId,
          name: shoppingListRecipes.recipeName,
          imageUrl: shoppingListRecipes.recipeImageUrl,
        })
        .from(shoppingListRecipes)
        .where(eq(shoppingListRecipes.shoppingListId, shoppingList.id))
        .orderBy(desc(shoppingListRecipes.createdAt));

      return {
        shoppingList,
        items,
        recipes: recipesList,
      };
    } catch (err) {
      console.error("Error fetching shopping list:", err);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch shopping list",
      });
    }
  }),

  /**
   * Add recipe ingredients to shopping list with optional scaling
   */
  addRecipeToShoppingList: authedProcedure
    .input(
      type({
        recipeId: "number",
        "servings?": "number", // Optional: scale recipe to this many servings
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { recipeId, servings } = input;

      try {
        const shoppingList = await getOrCreateShoppingList(ctx.db, ctx.user.id);

        // Check if recipe already in shopping list
        const existingRecipe = await ctx.db
          .select()
          .from(shoppingListRecipes)
          .where(
            and(
              eq(shoppingListRecipes.shoppingListId, shoppingList.id),
              eq(shoppingListRecipes.recipeId, recipeId)
            )
          )
          .then((rows) => rows[0]);

        if (existingRecipe) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Recipe already in shopping list",
          });
        }

        // Get recipe details
        const recipe = await ctx.db
          .select({
            id: recipes.id,
            name: recipes.name,
            servings: recipes.servings,
          })
          .from(recipes)
          .where(eq(recipes.id, recipeId))
          .then((rows) => rows[0]);

        if (!recipe) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Recipe not found",
          });
        }

        // Get first recipe image
        const firstImage = await ctx.db
          .select({ url: recipeImages.url })
          .from(recipeImages)
          .where(eq(recipeImages.recipeId, recipeId))
          .limit(1)
          .then((rows) => rows[0]);

        // Get recipe ingredients
        const ingredients = await ctx.db
          .select({
            quantity: recipeIngredients.quantity,
            unit: recipeIngredients.unit,
            name: recipeIngredients.name,
          })
          .from(recipeIngredients)
          .where(eq(recipeIngredients.recipeId, recipeId))
          .orderBy(recipeIngredients.index);

        // Calculate scaling factor if custom servings requested
        const scalingFactor =
          servings && recipe.servings ? servings / recipe.servings : 1;

        // Use a transaction for atomicity
        await ctx.db.transaction(async (tx) => {
          // Add recipe to shopping list recipes
          await tx.insert(shoppingListRecipes).values({
            shoppingListId: shoppingList.id,
            recipeId: recipe.id,
            recipeName: recipe.name,
            recipeImageUrl: firstImage?.url || null,
            createdAt: new Date(),
          });

          // Process each ingredient - create ONE row per ingredient
          for (const ing of ingredients) {
            // Parse quantity and apply scaling
            const baseQuantity = ing.quantity ? parseFloat(ing.quantity) : null;
            const scaledQuantity = baseQuantity
              ? baseQuantity * scalingFactor
              : null;

            await insertShoppingListItem(tx, {
              shoppingListId: shoppingList.id,
              ingredientName: ing.name,
              quantity: scaledQuantity,
              unit: ing.unit, // Will be normalized in insertShoppingListItem
              displayName: ing.name,
              sourceRecipeId: recipeId,
              sourceRecipeName: recipe.name,
            });
          }
        });

        return { success: true };
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        console.error("Error adding recipe to shopping list:", err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to add recipe to shopping list",
        });
      }
    }),

  /**
   * Toggle item checked status
   */
  toggleItemChecked: authedProcedure
    .input(
      type({
        itemId: "number",
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { itemId } = input;

      try {
        // Verify item belongs to user's shopping list
        const item = await ctx.db
          .select({
            item: shoppingListItems,
            list: shoppingLists,
          })
          .from(shoppingListItems)
          .innerJoin(
            shoppingLists,
            eq(shoppingListItems.shoppingListId, shoppingLists.id)
          )
          .where(
            and(
              eq(shoppingListItems.id, itemId),
              eq(shoppingLists.userId, ctx.user.id)
            )
          )
          .then((rows) => rows[0]);

        if (!item) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Item not found",
          });
        }

        // Toggle checked status
        const newChecked = !item.item.isChecked;
        await ctx.db
          .update(shoppingListItems)
          .set({
            isChecked: newChecked,
            updatedAt: new Date(),
          })
          .where(eq(shoppingListItems.id, itemId));

        return { success: true, isChecked: newChecked };
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        console.error("Error toggling item:", err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to toggle item",
        });
      }
    }),

  /**
   * Remove individual item from shopping list
   */
  removeItem: authedProcedure
    .input(
      type({
        itemId: "number",
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { itemId } = input;

      try {
        // Verify ownership before deleting
        const item = await ctx.db
          .select({ listId: shoppingListItems.shoppingListId })
          .from(shoppingListItems)
          .innerJoin(
            shoppingLists,
            eq(shoppingListItems.shoppingListId, shoppingLists.id)
          )
          .where(
            and(
              eq(shoppingListItems.id, itemId),
              eq(shoppingLists.userId, ctx.user.id)
            )
          )
          .then((rows) => rows[0]);

        if (!item) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Item not found",
          });
        }

        await ctx.db
          .delete(shoppingListItems)
          .where(eq(shoppingListItems.id, itemId));

        return { success: true };
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        console.error("Error removing item:", err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to remove item",
        });
      }
    }),

  /**
   * Clear all checked items
   */
  clearCheckedItems: authedProcedure.mutation(async ({ ctx }) => {
    try {
      // Get user's shopping list
      const shoppingList = await ctx.db
        .select({ id: shoppingLists.id })
        .from(shoppingLists)
        .where(eq(shoppingLists.userId, ctx.user.id))
        .then((rows) => rows[0]);

      if (!shoppingList) {
        return { success: true, deletedCount: 0 };
      }

      // Delete all checked items
      await ctx.db
        .delete(shoppingListItems)
        .where(
          and(
            eq(shoppingListItems.shoppingListId, shoppingList.id),
            eq(shoppingListItems.isChecked, true)
          )
        );

      return { success: true };
    } catch (err) {
      console.error("Error clearing checked items:", err);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to clear checked items",
      });
    }
  }),

  /**
   * Remove all items from a specific recipe
   * NEW MODEL: Simply delete all rows with matching sourceRecipeId
   */
  removeRecipeFromList: authedProcedure
    .input(
      type({
        recipeId: "number",
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { recipeId } = input;

      try {
        // Get user's shopping list
        const shoppingList = await ctx.db
          .select({ id: shoppingLists.id })
          .from(shoppingLists)
          .where(eq(shoppingLists.userId, ctx.user.id))
          .then((rows) => rows[0]);

        if (!shoppingList) {
          return { success: true };
        }

        await ctx.db.transaction(async (tx) => {
          // Remove recipe from shopping list recipes
          await tx
            .delete(shoppingListRecipes)
            .where(
              and(
                eq(shoppingListRecipes.shoppingListId, shoppingList.id),
                eq(shoppingListRecipes.recipeId, recipeId)
              )
            );

          // Delete all items from this recipe
          // This is MUCH simpler now - just delete rows with matching sourceRecipeId
          await tx
            .delete(shoppingListItems)
            .where(
              and(
                eq(shoppingListItems.shoppingListId, shoppingList.id),
                eq(shoppingListItems.sourceRecipeId, recipeId)
              )
            );
        });

        return { success: true };
      } catch (err) {
        console.error("Error removing recipe items:", err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to remove recipe items",
        });
      }
    }),

  /**
   * Add manual item to shopping list
   */
  addManualItem: authedProcedure
    .input(
      type({
        ingredientText: "string",
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { ingredientText } = input;

      if (!ingredientText || !ingredientText.trim()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Ingredient text is required",
        });
      }

      try {
        const shoppingList = await getOrCreateShoppingList(ctx.db, ctx.user.id);

        // Parse ingredient
        const parsed = parseIngredient(ingredientText.trim());

        // Insert the item (manual items have no sourceRecipeId)
        const item = await insertShoppingListItem(ctx.db, {
          shoppingListId: shoppingList.id,
          ingredientName: parsed.name,
          quantity: parsed.quantity,
          unit: parsed.unit,
          displayName: parsed.name,
          // No source recipe for manual items - don't include optional fields
        });

        return {
          success: true,
          item: {
            id: item.id,
            displayName: item.displayName,
          },
        };
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        console.error("Error adding manual item:", err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to add manual item",
        });
      }
    }),

  /**
   * Edit an ingredient's quantity - this UNLINKS it from all recipes
   * When a user edits an aggregated item, we:
   * 1. Delete all recipe-linked items for this ingredient
   * 2. Create a new manual (unlinked) item with the user's specified quantity
   */
  editIngredientQuantity: authedProcedure
    .input(
      type({
        ingredientName: "string",
        unit: "string | null",
        newQuantity: "number",
        displayName: "string",
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { ingredientName, unit, newQuantity, displayName } = input;

      try {
        const shoppingList = await getOrCreateShoppingList(ctx.db, ctx.user.id);
        const normalizedName = normalizeIngredientName(ingredientName);

        await ctx.db.transaction(async (tx) => {
          // Delete ALL items (recipe-linked and manual) for this ingredient+unit combination
          await tx
            .delete(shoppingListItems)
            .where(
              and(
                eq(shoppingListItems.shoppingListId, shoppingList.id),
                eq(shoppingListItems.ingredientName, normalizedName),
                unit
                  ? eq(shoppingListItems.unit, unit)
                  : sql`${shoppingListItems.unit} IS NULL`
              )
            );

          // Create a new MANUAL item (no sourceRecipeId) with the user's quantity
          await tx.insert(shoppingListItems).values({
            shoppingListId: shoppingList.id,
            ingredientName: normalizedName,
            displayName,
            quantity: newQuantity.toString(),
            unit,
            isChecked: false,
            sourceRecipeId: null, // Explicitly unlinked from recipes
            sourceRecipeName: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        });

        return { success: true };
      } catch (err) {
        console.error("Error editing ingredient quantity:", err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to edit ingredient quantity",
        });
      }
    }),
});
