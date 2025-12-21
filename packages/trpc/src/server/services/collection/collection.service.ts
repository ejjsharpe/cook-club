import { collections, recipeCollections, recipes } from "@repo/db/schemas";
import { TRPCError } from "@trpc/server";
import { eq, and, desc } from "drizzle-orm";

import type { DbClient } from "../types";

// ─── Collection Operations ─────────────────────────────────────────────────

/**
 * Get or create the default collection for a user
 */
export async function getOrCreateDefaultCollection(
  db: DbClient,
  userId: string,
) {
  // Look for default collection
  const defaultCollection = await db
    .select()
    .from(collections)
    .where(and(eq(collections.userId, userId), eq(collections.isDefault, true)))
    .then((rows) => rows[0]);

  if (defaultCollection) {
    return defaultCollection;
  }

  // Create default collection
  const newCollection = await db
    .insert(collections)
    .values({
      userId,
      name: "Saved Recipes",
      isDefault: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning()
    .then((rows) => rows[0]);

  return newCollection!;
}

/**
 * Toggle a recipe in a collection
 */
export async function toggleRecipeInCollection(
  db: DbClient,
  params: {
    userId: string;
    recipeId: number;
    collectionId?: number | undefined;
  },
) {
  const { userId, recipeId, collectionId: inputCollectionId } = params;

  // Verify recipe exists
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

  // Get or use default collection
  let collectionId = inputCollectionId;
  if (!collectionId) {
    const defaultCollection = await getOrCreateDefaultCollection(db, userId);
    collectionId = defaultCollection.id;
  }

  // Verify collection exists and belongs to user
  const collection = await db
    .select({ id: collections.id, name: collections.name })
    .from(collections)
    .where(and(eq(collections.id, collectionId), eq(collections.userId, userId)))
    .then((rows) => rows[0]);

  if (!collection) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Collection not found",
    });
  }

  // Check if recipe is already in collection
  const existing = await db
    .select()
    .from(recipeCollections)
    .where(
      and(
        eq(recipeCollections.recipeId, recipeId),
        eq(recipeCollections.collectionId, collectionId),
      ),
    )
    .then((rows) => rows[0]);

  if (existing) {
    // Remove from collection
    await db
      .delete(recipeCollections)
      .where(
        and(
          eq(recipeCollections.recipeId, recipeId),
          eq(recipeCollections.collectionId, collectionId),
        ),
      );
  } else {
    // Add to collection
    await db.insert(recipeCollections).values({
      recipeId,
      collectionId,
      createdAt: new Date(),
    });
  }

  // Get all collections this recipe is in
  const allRecipeCollections = await db
    .select({ collectionId: recipeCollections.collectionId })
    .from(recipeCollections)
    .where(eq(recipeCollections.recipeId, recipeId));

  const collectionIds = allRecipeCollections.map((rc) => rc.collectionId);

  // Get all user's collections with hasRecipe flag
  const userCollections = await db
    .select({
      id: collections.id,
      name: collections.name,
      isDefault: collections.isDefault,
    })
    .from(collections)
    .where(eq(collections.userId, userId))
    .orderBy(desc(collections.isDefault), collections.createdAt);

  const collectionsWithStatus = userCollections.map((col) => ({
    ...col,
    hasRecipe: collectionIds.includes(col.id),
  }));

  return {
    success: true,
    inCollection: collectionIds.includes(collectionId),
    collectionIds,
    collections: collectionsWithStatus,
  };
}
