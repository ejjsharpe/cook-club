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

// ─── Helper Functions ────────────────────────────────────────────────────────

interface ParsedIngredient {
  quantity: number | null;
  unit: string | null;
  name: string;
}

/**
 * Parse ingredient text to extract quantity, unit, and ingredient name
 * Used for manually added items
 */
function parseIngredient(ingredientText: string): ParsedIngredient {
  if (!ingredientText || typeof ingredientText !== "string") {
    return { quantity: null, unit: null, name: ingredientText || "" };
  }

  // Regex matches: [quantity] [unit] [ingredient name]
  // Examples: "2 cups flour", "1/2 tsp salt", "3 large carrots"
  const match = ingredientText.match(
    /^(\d+(?:\/\d+)?|\d*\.?\d+)\s*([a-zA-Z\s]*?)\s+(.+)$/
  );

  if (match) {
    const quantityStr = match[1];
    const unit = match[2]?.trim() || null;
    const name = match[3]?.trim() || ingredientText;

    // Convert fractions to decimals (e.g., "1/2" -> 0.5)
    let quantity: number | null = null;
    if (quantityStr) {
      if (quantityStr.includes("/")) {
        const [numerator, denominator] = quantityStr.split("/");
        quantity = parseFloat(numerator) / parseFloat(denominator);
      } else {
        quantity = parseFloat(quantityStr);
      }
    }

    return { quantity, unit, name };
  }

  // If no match, treat entire text as ingredient name
  return { quantity: null, unit: null, name: ingredientText.trim() };
}

/**
 * Normalize ingredient name for grouping (lowercase, trimmed)
 */
function normalizeIngredientName(name: string): string {
  return name.toLowerCase().trim();
}

/**
 * Format display text from parsed components
 */
function formatDisplayText(
  quantity: number | null,
  unit: string | null,
  name: string
): string {
  if (!quantity) {
    return name;
  }

  // Format quantity with up to 2 decimal places, removing trailing zeros
  const formattedQuantity =
    quantity % 1 === 0
      ? quantity.toString()
      : quantity.toFixed(2).replace(/\.?0+$/, "");

  if (unit) {
    return `${formattedQuantity} ${unit} ${name}`;
  }

  return `${formattedQuantity} ${name}`;
}

// ─── Router ──────────────────────────────────────────────────────────────────

export const shoppingRouter = router({
  /**
   * Get user's shopping list with all items and recipes
   */
  getShoppingList: authedProcedure.query(async ({ ctx }) => {
    try {
      // Get or create shopping list
      let shoppingList = await ctx.db
        .select()
        .from(shoppingLists)
        .where(eq(shoppingLists.userId, ctx.user.id))
        .then((rows) => rows[0]);

      if (!shoppingList) {
        [shoppingList] = await ctx.db
          .insert(shoppingLists)
          .values({
            userId: ctx.user.id,
            name: "Shopping List",
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();
      }

      // Get all items (unchecked first, then by created date)
      const items = await ctx.db
        .select()
        .from(shoppingListItems)
        .where(eq(shoppingListItems.shoppingListId, shoppingList.id))
        .orderBy(shoppingListItems.isChecked, desc(shoppingListItems.createdAt));

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
   * Add recipe ingredients to shopping list with aggregation
   */
  addRecipeToShoppingList: authedProcedure
    .input(
      type({
        recipeId: "number",
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { recipeId } = input;

      try {
        // Get or create shopping list
        let shoppingList = await ctx.db
          .select()
          .from(shoppingLists)
          .where(eq(shoppingLists.userId, ctx.user.id))
          .then((rows) => rows[0]);

        if (!shoppingList) {
          [shoppingList] = await ctx.db
            .insert(shoppingLists)
            .values({
              userId: ctx.user.id,
              name: "Shopping List",
              createdAt: new Date(),
              updatedAt: new Date(),
            })
            .returning();
        }

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

        // Get recipe ingredients (now structured!)
        const ingredients = await ctx.db
          .select({
            quantity: recipeIngredients.quantity,
            unit: recipeIngredients.unit,
            name: recipeIngredients.name,
          })
          .from(recipeIngredients)
          .where(eq(recipeIngredients.recipeId, recipeId))
          .orderBy(recipeIngredients.index);

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

          // Process each ingredient
          for (const ing of ingredients) {
            const normalizedName = normalizeIngredientName(ing.name);
            const quantity = ing.quantity ? parseFloat(ing.quantity) : null;

            // Check if item with same normalized name and unit already exists
            const existingItem = await tx
              .select()
              .from(shoppingListItems)
              .where(
                and(
                  eq(shoppingListItems.shoppingListId, shoppingList.id),
                  eq(shoppingListItems.ingredientName, normalizedName),
                  ing.unit
                    ? eq(shoppingListItems.unit, ing.unit)
                    : sql`${shoppingListItems.unit} IS NULL`
                )
              )
              .then((rows) => rows[0]);

            if (existingItem && quantity !== null) {
              // Aggregate: add quantities together
              const existingQuantity = existingItem.quantity
                ? parseFloat(existingItem.quantity)
                : 0;
              const newQuantity = existingQuantity + quantity;

              // Update source recipe IDs and names
              const sourceIds = existingItem.sourceRecipeIds
                ? `${existingItem.sourceRecipeIds},${recipeId}`
                : `${recipeId}`;
              const sourceNames = existingItem.sourceRecipeNames
                ? `${existingItem.sourceRecipeNames},${recipe.name}`
                : recipe.name;

              await tx
                .update(shoppingListItems)
                .set({
                  quantity: newQuantity.toString(),
                  displayText: formatDisplayText(newQuantity, ing.unit, ing.name),
                  sourceRecipeIds: sourceIds,
                  sourceRecipeNames: sourceNames,
                  updatedAt: new Date(),
                })
                .where(eq(shoppingListItems.id, existingItem.id));
            } else {
              // Insert new item
              await tx.insert(shoppingListItems).values({
                shoppingListId: shoppingList.id,
                ingredientName: normalizedName,
                quantity: quantity?.toString() || null,
                unit: ing.unit,
                displayText: formatDisplayText(quantity, ing.unit, ing.name),
                isChecked: false,
                sourceRecipeIds: `${recipeId}`,
                sourceRecipeNames: recipe.name,
                createdAt: new Date(),
                updatedAt: new Date(),
              });
            }
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

          // Get all items that contain this recipe
          const items = await tx
            .select()
            .from(shoppingListItems)
            .where(eq(shoppingListItems.shoppingListId, shoppingList.id));

          for (const item of items) {
            if (!item.sourceRecipeIds) continue;

            const recipeIds = item.sourceRecipeIds
              .split(",")
              .map((id) => id.trim());
            const recipeNames =
              item.sourceRecipeNames?.split(",").map((name) => name.trim()) ||
              [];

            // Find index of recipe to remove
            const indexToRemove = recipeIds.indexOf(recipeId.toString());
            if (indexToRemove === -1) continue;

            // Remove recipe ID and name from arrays
            recipeIds.splice(indexToRemove, 1);
            recipeNames.splice(indexToRemove, 1);

            if (recipeIds.length === 0) {
              // No more recipes contributing to this item, delete it
              await tx
                .delete(shoppingListItems)
                .where(eq(shoppingListItems.id, item.id));
            } else {
              // Update source recipe lists
              await tx
                .update(shoppingListItems)
                .set({
                  sourceRecipeIds: recipeIds.join(","),
                  sourceRecipeNames: recipeNames.join(","),
                  updatedAt: new Date(),
                })
                .where(eq(shoppingListItems.id, item.id));
            }
          }
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
        // Get or create shopping list
        let shoppingList = await ctx.db
          .select()
          .from(shoppingLists)
          .where(eq(shoppingLists.userId, ctx.user.id))
          .then((rows) => rows[0]);

        if (!shoppingList) {
          [shoppingList] = await ctx.db
            .insert(shoppingLists)
            .values({
              userId: ctx.user.id,
              name: "Shopping List",
              createdAt: new Date(),
              updatedAt: new Date(),
            })
            .returning();
        }

        // Parse ingredient
        const parsed = parseIngredient(ingredientText.trim());
        const normalizedName = normalizeIngredientName(parsed.name);

        // Check if item with same normalized name and unit already exists
        const existingItem = await ctx.db
          .select()
          .from(shoppingListItems)
          .where(
            and(
              eq(shoppingListItems.shoppingListId, shoppingList.id),
              eq(shoppingListItems.ingredientName, normalizedName),
              parsed.unit
                ? eq(shoppingListItems.unit, parsed.unit)
                : sql`${shoppingListItems.unit} IS NULL`
            )
          )
          .then((rows) => rows[0]);

        let item;

        if (existingItem && parsed.quantity !== null) {
          // Add to existing quantity
          const existingQuantity = existingItem.quantity
            ? parseFloat(existingItem.quantity)
            : 0;
          const newQuantity = existingQuantity + parsed.quantity;

          [item] = await ctx.db
            .update(shoppingListItems)
            .set({
              quantity: newQuantity.toString(),
              displayText: formatDisplayText(
                newQuantity,
                parsed.unit,
                parsed.name
              ),
              updatedAt: new Date(),
            })
            .where(eq(shoppingListItems.id, existingItem.id))
            .returning();
        } else {
          // Insert new item
          [item] = await ctx.db
            .insert(shoppingListItems)
            .values({
              shoppingListId: shoppingList.id,
              ingredientName: normalizedName,
              quantity: parsed.quantity?.toString() || null,
              unit: parsed.unit,
              displayText: formatDisplayText(
                parsed.quantity,
                parsed.unit,
                parsed.name
              ),
              isChecked: false,
              sourceRecipeIds: null,
              sourceRecipeNames: null,
              createdAt: new Date(),
              updatedAt: new Date(),
            })
            .returning();
        }

        return {
          success: true,
          item: {
            id: item.id,
            displayText: item.displayText,
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
});
