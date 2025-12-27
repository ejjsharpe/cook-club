import {
  collections,
  recipeCollections,
  recipes,
  recipeImages,
  user,
} from "@repo/db/schemas";
import { TRPCError } from "@trpc/server";
import { eq, and, desc, ilike, sql, inArray } from "drizzle-orm";

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

  // Verify recipe exists and belongs to user
  const recipe = await db
    .select({ id: recipes.id, uploadedBy: recipes.uploadedBy })
    .from(recipes)
    .where(eq(recipes.id, recipeId))
    .then((rows) => rows[0]);

  if (!recipe) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Recipe not found",
    });
  }

  // Verify user owns the recipe - users can only add their own recipes to collections
  if (recipe.uploadedBy !== userId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message:
        "You can only add your own recipes to collections. Import this recipe first.",
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
    .where(
      and(eq(collections.id, collectionId), eq(collections.userId, userId)),
    )
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

// ─── User Collections With Metadata ─────────────────────────────────────────

export interface UserCollectionWithMetadata {
  id: number;
  name: string;
  isDefault: boolean;
  recipeCount: number;
  owner: {
    id: string;
    name: string;
    image: string | null;
  };
  createdAt: Date;
}

/**
 * Get user's collections with recipe count and owner metadata
 */
export async function getUserCollectionsWithMetadata(
  db: DbClient,
  params: {
    userId: string;
    search?: string;
  },
): Promise<UserCollectionWithMetadata[]> {
  const { userId, search } = params;

  // Build the recipe count subquery
  const recipeCountSubquery = db
    .select({
      collectionId: recipeCollections.collectionId,
      count: sql<number>`count(*)`.as("recipe_count"),
    })
    .from(recipeCollections)
    .groupBy(recipeCollections.collectionId)
    .as("recipe_counts");

  // Build the main query
  const results = await db
    .select({
      id: collections.id,
      name: collections.name,
      isDefault: collections.isDefault,
      createdAt: collections.createdAt,
      recipeCount: sql<number>`coalesce(${recipeCountSubquery.count}, 0)`,
      ownerId: user.id,
      ownerName: user.name,
      ownerImage: user.image,
    })
    .from(collections)
    .innerJoin(user, eq(collections.userId, user.id))
    .leftJoin(
      recipeCountSubquery,
      eq(collections.id, recipeCountSubquery.collectionId),
    )
    .where(
      and(
        eq(collections.userId, userId),
        search ? ilike(collections.name, `%${search}%`) : undefined,
      ),
    )
    .orderBy(desc(collections.isDefault), collections.createdAt);

  return results.map((row) => ({
    id: row.id,
    name: row.name,
    isDefault: row.isDefault,
    recipeCount: Number(row.recipeCount),
    owner: {
      id: row.ownerId,
      name: row.ownerName,
      image: row.ownerImage,
    },
    createdAt: row.createdAt,
  }));
}

// ─── Collection Detail ──────────────────────────────────────────────────────

export interface CollectionDetailResult {
  id: number;
  name: string;
  isDefault: boolean;
  recipeCount: number;
  createdAt: Date;
  recipes: {
    id: number;
    name: string;
    cookTime: string | null;
    servings: number | null;
    sourceUrl: string | null;
    images: { id: number; url: string }[];
    createdAt: Date;
  }[];
}

/**
 * Get collection detail with all recipes
 */
export async function getCollectionDetail(
  db: DbClient,
  params: {
    userId: string;
    collectionId: number;
  },
): Promise<CollectionDetailResult> {
  const { userId, collectionId } = params;

  // Verify collection exists and belongs to user
  const collection = await db
    .select({
      id: collections.id,
      name: collections.name,
      isDefault: collections.isDefault,
      createdAt: collections.createdAt,
    })
    .from(collections)
    .where(
      and(eq(collections.id, collectionId), eq(collections.userId, userId)),
    )
    .then((rows) => rows[0]);

  if (!collection) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Collection not found",
    });
  }

  // Get all recipes in the collection
  const recipesInCollection = await db
    .select({
      id: recipes.id,
      name: recipes.name,
      cookTime: recipes.cookTime,
      servings: recipes.servings,
      sourceUrl: recipes.sourceUrl,
      createdAt: recipes.createdAt,
    })
    .from(recipeCollections)
    .innerJoin(recipes, eq(recipeCollections.recipeId, recipes.id))
    .where(eq(recipeCollections.collectionId, collectionId))
    .orderBy(desc(recipeCollections.createdAt));

  // Get images for all recipes in this collection
  const recipeIds = recipesInCollection.map((r) => r.id);
  let allRecipeImages: { id: number; recipeId: number; url: string }[] = [];

  if (recipeIds.length > 0) {
    allRecipeImages = await db
      .select()
      .from(recipeImages)
      .where(inArray(recipeImages.recipeId, recipeIds));
  }

  // Map recipes with their images
  const recipesWithImages = recipesInCollection.map((recipe) => ({
    ...recipe,
    images: allRecipeImages
      .filter((img) => img.recipeId === recipe.id)
      .map((img) => ({ id: img.id, url: img.url })),
  }));

  return {
    id: collection.id,
    name: collection.name,
    isDefault: collection.isDefault,
    recipeCount: recipesInCollection.length,
    createdAt: collection.createdAt,
    recipes: recipesWithImages,
  };
}

// ─── Delete Collection ────────────────────────────────────────────────────────

/**
 * Delete a collection
 */
export async function deleteCollection(
  db: DbClient,
  params: {
    userId: string;
    collectionId: number;
  },
): Promise<{ success: boolean }> {
  const { userId, collectionId } = params;

  // Verify collection exists and belongs to user
  const collection = await db
    .select({
      id: collections.id,
      isDefault: collections.isDefault,
    })
    .from(collections)
    .where(
      and(eq(collections.id, collectionId), eq(collections.userId, userId)),
    )
    .then((rows) => rows[0]);

  if (!collection) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Collection not found",
    });
  }

  // Prevent deleting default collection
  if (collection.isDefault) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Cannot delete your default collection",
    });
  }

  // Delete collection (cascade will handle recipeCollections)
  await db.delete(collections).where(eq(collections.id, collectionId));

  return { success: true };
}
