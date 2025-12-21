import {
  recipes,
  recipeImages,
  recipeIngredients,
  recipeInstructions,
  recipeCollections,
  collections,
  userLikes,
  shoppingLists,
  shoppingListRecipes,
  tags,
  user,
} from "@repo/db/schemas";
import { TRPCError } from "@trpc/server";
import { eq, and, inArray, sql } from "drizzle-orm";

import { parseIngredient } from "../../../utils/ingredientParser";
import { normalizeUnit } from "../../../utils/unitNormalizer";
import type { DbClient } from "../types";

// ─── Types ─────────────────────────────────────────────────────────────────

export interface CreateRecipeIngredient {
  index: number;
  ingredient?: string; // Unparsed format
  quantity?: string | null; // Parsed format
  unit?: string | null;
  name?: string;
}

export interface CreateRecipeInstruction {
  index: number;
  instruction: string;
  imageUrl?: string | null;
}

export interface CreateRecipeImage {
  url: string;
}

export interface CreateRecipeInput {
  name: string;
  ingredients: CreateRecipeIngredient[];
  instructions: CreateRecipeInstruction[];
  images: CreateRecipeImage[];
  sourceUrl?: string;
  categories?: string[];
  cuisines?: string[];
  description?: string;
  prepTime?: string;
  cookTime?: string;
  totalTime?: string;
  servings: number;
}

export type RecipeWithDetails = Omit<
  typeof recipes.$inferSelect,
  "uploadedBy"
> & {
  uploadedBy: Pick<typeof user.$inferSelect, "id" | "name" | "email" | "image">;
  images: Pick<typeof recipeImages.$inferSelect, "id" | "url">[];
  ingredients: Pick<
    typeof recipeIngredients.$inferSelect,
    "index" | "quantity" | "unit" | "name"
  >[];
  instructions: Pick<
    typeof recipeInstructions.$inferSelect,
    "index" | "instruction" | "imageUrl"
  >[];
  userRecipesCount: number;
  collectionIds: number[];
  isLiked: boolean;
  isInShoppingList: boolean;
  likeCount: number;
  saveCount: number;
};

// ─── Tag Validation ────────────────────────────────────────────────────────

/**
 * Validate that all categories and cuisines exist in the tags table
 */
export async function validateTags(
  db: DbClient,
  categories: string[] | undefined,
  cuisines: string[] | undefined,
): Promise<void> {
  // Parallelize validation queries
  const [existingCategoryTags, existingCuisineTags] = await Promise.all([
    categories && categories.length > 0
      ? db
          .select({ name: tags.name })
          .from(tags)
          .where(and(eq(tags.type, "category"), inArray(tags.name, categories)))
      : Promise.resolve([]),
    cuisines && cuisines.length > 0
      ? db
          .select({ name: tags.name })
          .from(tags)
          .where(and(eq(tags.type, "cuisine"), inArray(tags.name, cuisines)))
      : Promise.resolve([]),
  ]);

  // Validate categories
  if (categories && categories.length > 0) {
    const existingCategoryNames = existingCategoryTags.map((tag) => tag.name);
    const invalidCategories = categories.filter(
      (cat) => !existingCategoryNames.includes(cat),
    );

    if (invalidCategories.length > 0) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Invalid categories: ${invalidCategories.join(", ")}.`,
      });
    }
  }

  // Validate cuisines
  if (cuisines && cuisines.length > 0) {
    const existingCuisineNames = existingCuisineTags.map((tag) => tag.name);
    const invalidCuisines = cuisines.filter(
      (cuisine) => !existingCuisineNames.includes(cuisine),
    );

    if (invalidCuisines.length > 0) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Invalid cuisines: ${invalidCuisines.join(", ")}.`,
      });
    }
  }
}

// ─── Recipe Creation ───────────────────────────────────────────────────────

/**
 * Create a new recipe with ingredients, instructions, and images
 */
export async function createRecipe(
  db: DbClient,
  userId: string,
  input: CreateRecipeInput,
) {
  // Use transaction to ensure all inserts succeed or all fail
  return await db.transaction(async (tx) => {
    // Insert recipe
    const recipe = await tx
      .insert(recipes)
      .values({
        name: input.name,
        description: input.description || null,
        sourceUrl: input.sourceUrl || null,
        prepTime: input.prepTime || null,
        cookTime: input.cookTime || null,
        totalTime: input.totalTime || null,
        servings: input.servings,
        createdAt: new Date(),
        updatedAt: new Date(),
        uploadedBy: userId,
      })
      .returning()
      .then((rows) => rows[0]);

    if (!recipe) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to create recipe",
      });
    }

    // Parse ingredients if needed (support both formats)
    const parsedIngredients = input.ingredients.map((ing) => {
      // Check if ingredient is in unparsed format (has 'ingredient' field)
      if (ing.ingredient) {
        // Parse the ingredient text
        const parsed = parseIngredient(ing.ingredient);
        return {
          index: ing.index,
          quantity: parsed.quantity?.toString() || null,
          unit: normalizeUnit(parsed.unit),
          name: parsed.name,
        };
      }
      // Already parsed - just normalize the unit
      return {
        index: ing.index,
        quantity: ing.quantity || null,
        unit: normalizeUnit(ing.unit || null),
        name: ing.name || "",
      };
    });

    // Insert ingredients
    const insertedIngredients = await tx
      .insert(recipeIngredients)
      .values(
        parsedIngredients.map((ingredient) => ({
          ...ingredient,
          recipeId: recipe.id,
        })),
      )
      .returning({
        index: recipeIngredients.index,
        quantity: recipeIngredients.quantity,
        unit: recipeIngredients.unit,
        name: recipeIngredients.name,
      });

    // Insert instructions
    const insertedInstructions = await tx
      .insert(recipeInstructions)
      .values(
        input.instructions.map((instruction) => ({
          index: instruction.index,
          instruction: instruction.instruction,
          imageUrl: instruction.imageUrl || null,
          recipeId: recipe.id,
        })),
      )
      .returning({
        index: recipeInstructions.index,
        instruction: recipeInstructions.instruction,
        imageUrl: recipeInstructions.imageUrl,
      });

    // Insert images (required)
    const images = await tx
      .insert(recipeImages)
      .values(
        input.images.map((image) => ({
          recipeId: recipe.id,
          url: image.url,
        })),
      )
      .returning({
        url: recipeImages.url,
      });

    return {
      ...recipe,
      ingredients: insertedIngredients,
      instructions: insertedInstructions,
      images,
    };
  });
}

// ─── Recipe Detail ─────────────────────────────────────────────────────────

/**
 * Get detailed information about a recipe including all related data
 */
export async function getRecipeDetail(
  db: DbClient,
  recipeId: number,
  userId: string,
): Promise<RecipeWithDetails> {
  // Single query with all aggregations and checks using Drizzle helpers
  const recipeData = await db
    .select({
      recipe: recipes,
      uploader: {
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
      },
      // Scalar subquery: count of likes for this recipe
      // Note: Must use CAST to INTEGER for Neon database to return number type
      likeCount: sql<number>`(
        SELECT CAST(COUNT(*) AS INTEGER)
        FROM ${userLikes}
        WHERE ${userLikes.recipeId} = ${recipes.id}
      )`,
      // Scalar subquery: count of saves for this recipe
      saveCount: sql<number>`(
        SELECT CAST(COUNT(DISTINCT ${recipeCollections.id}) AS INTEGER)
        FROM ${recipeCollections}
        WHERE ${recipeCollections.recipeId} = ${recipes.id}
      )`,
      // Scalar subquery: total recipes by this uploader
      uploaderRecipeCount: sql<number>`(
        SELECT CAST(COUNT(*) AS INTEGER)
        FROM ${recipes} r
        WHERE r.uploaded_by = ${recipes.uploadedBy}
      )`,
      // EXISTS: check if current user has liked this recipe
      isLiked: sql<boolean>`EXISTS(
        SELECT 1 FROM ${userLikes}
        WHERE ${userLikes.recipeId} = ${recipes.id}
        AND ${userLikes.userId} = ${userId}
      )`,
      // EXISTS: check if recipe is in current user's shopping list
      isInShoppingList: sql<boolean>`EXISTS(
        SELECT 1 FROM ${shoppingListRecipes}
        INNER JOIN ${shoppingLists} ON ${shoppingListRecipes.shoppingListId} = ${shoppingLists.id}
        WHERE ${shoppingListRecipes.recipeId} = ${recipes.id}
        AND ${shoppingLists.userId} = ${userId}
      )`,
    })
    .from(recipes)
    .innerJoin(user, eq(recipes.uploadedBy, user.id))
    .where(eq(recipes.id, recipeId))
    .then((rows) => rows[0]);

  if (!recipeData) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Recipe not found",
    });
  }

  // Get collection IDs for this recipe and current user
  const userRecipeCollections = await db
    .select({ collectionId: recipeCollections.collectionId })
    .from(recipeCollections)
    .innerJoin(collections, eq(recipeCollections.collectionId, collections.id))
    .where(
      and(
        eq(recipeCollections.recipeId, recipeId),
        eq(collections.userId, userId),
      ),
    );

  const collectionIds = userRecipeCollections.map((rc) => rc.collectionId);

  // Parallelize remaining queries
  const [images, ingredients, instructions] = await Promise.all([
    db
      .select({ id: recipeImages.id, url: recipeImages.url })
      .from(recipeImages)
      .where(eq(recipeImages.recipeId, recipeId)),

    db
      .select({
        index: recipeIngredients.index,
        quantity: recipeIngredients.quantity,
        unit: recipeIngredients.unit,
        name: recipeIngredients.name,
      })
      .from(recipeIngredients)
      .where(eq(recipeIngredients.recipeId, recipeId))
      .orderBy(recipeIngredients.index),

    db
      .select({
        index: recipeInstructions.index,
        instruction: recipeInstructions.instruction,
        imageUrl: recipeInstructions.imageUrl,
      })
      .from(recipeInstructions)
      .where(eq(recipeInstructions.recipeId, recipeId))
      .orderBy(recipeInstructions.index),
  ]);

  return {
    ...recipeData.recipe,
    uploadedBy: recipeData.uploader,
    images,
    ingredients,
    instructions,
    userRecipesCount: recipeData.uploaderRecipeCount,
    collectionIds,
    isLiked: recipeData.isLiked,
    isInShoppingList: recipeData.isInShoppingList,
    likeCount: recipeData.likeCount,
    saveCount: recipeData.saveCount,
  };
}

// ─── Like/Unlike Recipe ────────────────────────────────────────────────────

/**
 * Toggle like status for a recipe
 */
export async function toggleRecipeLike(
  db: DbClient,
  recipeId: number,
  userId: string,
): Promise<{ success: boolean; liked: boolean }> {
  // Check if recipe exists
  const recipe = await db
    .select({ id: recipes.id })
    .from(recipes)
    .where(eq(recipes.id, recipeId))
    .then((rows) => rows[0]);

  if (!recipe) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Recipe not found",
    });
  }

  // Check if already liked
  const existingLike = await db
    .select()
    .from(userLikes)
    .where(and(eq(userLikes.userId, userId), eq(userLikes.recipeId, recipeId)))
    .then((rows) => rows[0]);

  if (existingLike) {
    // Unlike - remove the like
    await db
      .delete(userLikes)
      .where(
        and(eq(userLikes.userId, userId), eq(userLikes.recipeId, recipeId)),
      );
    return { success: true, liked: false };
  }

  // Like the recipe
  await db.insert(userLikes).values({
    userId,
    recipeId,
    createdAt: new Date(),
  });

  return { success: true, liked: true };
}
