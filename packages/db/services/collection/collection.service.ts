import {
  collections,
  recipeCollections,
  recipes,
  recipeImages,
  user,
} from "../../schemas";
import { eq, and, desc, ilike, sql, inArray, isNotNull, ne } from "drizzle-orm";

import { ServiceError } from "../errors";
import type { DbClient } from "../types";

// ─── Types ─────────────────────────────────────────────────────────────────

export type DefaultCollectionType = "want_to_cook" | "cooked";

export interface DefaultCollections {
  wantToCook: typeof collections.$inferSelect;
  cooked: typeof collections.$inferSelect;
}

// ─── Collection Operations ─────────────────────────────────────────────────

/**
 * Get or create both default collections for a user.
 * Handles race conditions gracefully using onConflictDoNothing.
 */
export async function getOrCreateDefaultCollections(
  db: DbClient,
  userId: string,
): Promise<DefaultCollections> {
  // Query for existing default collections
  const existingDefaults = await db
    .select()
    .from(collections)
    .where(
      and(eq(collections.userId, userId), isNotNull(collections.defaultType)),
    );

  const wantToCook = existingDefaults.find(
    (c) => c.defaultType === "want_to_cook",
  );
  const cooked = existingDefaults.find((c) => c.defaultType === "cooked");

  // If both exist, return early
  if (wantToCook && cooked) {
    return { wantToCook, cooked };
  }

  // Build list of missing defaults to insert
  const now = new Date();
  const toInsert: Array<{
    userId: string;
    name: string;
    defaultType: string;
    createdAt: Date;
    updatedAt: Date;
  }> = [];

  if (!wantToCook) {
    toInsert.push({
      userId,
      name: "Want to cook",
      defaultType: "want_to_cook",
      createdAt: now,
      updatedAt: now,
    });
  }
  if (!cooked) {
    toInsert.push({
      userId,
      name: "Cooked",
      defaultType: "cooked",
      createdAt: now,
      updatedAt: now,
    });
  }

  // Batch insert with conflict handling for race conditions
  await db.insert(collections).values(toInsert).onConflictDoNothing();

  // Re-fetch to get final state (handles race condition where another request inserted)
  const finalDefaults = await db
    .select()
    .from(collections)
    .where(
      and(eq(collections.userId, userId), isNotNull(collections.defaultType)),
    );

  return {
    wantToCook: finalDefaults.find((c) => c.defaultType === "want_to_cook")!,
    cooked: finalDefaults.find((c) => c.defaultType === "cooked")!,
  };
}

// ─── User Collections With Metadata ─────────────────────────────────────────

export interface UserCollectionWithMetadata {
  id: number;
  name: string;
  defaultType: DefaultCollectionType | null;
  recipeCount: number;
  owner: {
    id: string;
    name: string;
    image: string | null;
  };
  previewImages: string[];
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
      defaultType: collections.defaultType,
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
    .orderBy(
      sql`CASE
        WHEN ${collections.defaultType} = 'want_to_cook' THEN 0
        WHEN ${collections.defaultType} = 'cooked' THEN 1
        ELSE 2
      END`,
      collections.createdAt,
    );

  // Get collection IDs
  const collectionIds = results.map((r) => r.id);

  // Fetch preview images for all collections (up to 4 per collection)
  let previewImagesMap: Map<number, string[]> = new Map();

  if (collectionIds.length > 0) {
    // Get the first image for each recipe in each collection (up to 4 recipes per collection)
    const previewData = await db
      .select({
        collectionId: recipeCollections.collectionId,
        imageUrl: recipeImages.url,
      })
      .from(recipeCollections)
      .innerJoin(recipes, eq(recipeCollections.recipeId, recipes.id))
      .innerJoin(recipeImages, eq(recipes.id, recipeImages.recipeId))
      .where(inArray(recipeCollections.collectionId, collectionIds))
      .orderBy(desc(recipeCollections.createdAt));

    // Group images by collection and limit to 4 per collection
    for (const row of previewData) {
      const images = previewImagesMap.get(row.collectionId) || [];
      if (images.length < 4) {
        // Avoid duplicate images
        if (!images.includes(row.imageUrl)) {
          images.push(row.imageUrl);
          previewImagesMap.set(row.collectionId, images);
        }
      }
    }
  }

  return results.map((row) => ({
    id: row.id,
    name: row.name,
    defaultType: row.defaultType as DefaultCollectionType | null,
    recipeCount: Number(row.recipeCount),
    owner: {
      id: row.ownerId,
      name: row.ownerName,
      image: row.ownerImage,
    },
    previewImages: previewImagesMap.get(row.id) || [],
    createdAt: row.createdAt,
  }));
}

// ─── Collection Detail ──────────────────────────────────────────────────────

export interface CollectionDetailResult {
  id: number;
  name: string;
  defaultType: DefaultCollectionType | null;
  recipeCount: number;
  createdAt: Date;
  recipes: {
    id: number;
    name: string;
    cookTime: number | null; // minutes
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
      defaultType: collections.defaultType,
      createdAt: collections.createdAt,
    })
    .from(collections)
    .where(
      and(eq(collections.id, collectionId), eq(collections.userId, userId)),
    )
    .then((rows) => rows[0]);

  if (!collection) {
    throw new ServiceError("NOT_FOUND", "Collection not found");
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
    defaultType: collection.defaultType as DefaultCollectionType | null,
    recipeCount: recipesInCollection.length,
    createdAt: collection.createdAt,
    recipes: recipesWithImages,
  };
}

// ─── Delete Collection ────────────────────────────────────────────────────────

/**
 * Delete a collection.
 * Moves any orphan recipes (only in this collection) to "Want to cook" first.
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
      defaultType: collections.defaultType,
    })
    .from(collections)
    .where(
      and(eq(collections.id, collectionId), eq(collections.userId, userId)),
    )
    .then((rows) => rows[0]);

  if (!collection) {
    throw new ServiceError("NOT_FOUND", "Collection not found");
  }

  // Prevent deleting default collections
  if (collection.defaultType !== null) {
    throw new ServiceError("BAD_REQUEST", "Cannot delete default collections");
  }

  // Find recipes that are in this collection and belong to the user
  const recipesInCollection = await db
    .select({ recipeId: recipeCollections.recipeId })
    .from(recipeCollections)
    .innerJoin(recipes, eq(recipeCollections.recipeId, recipes.id))
    .where(
      and(
        eq(recipeCollections.collectionId, collectionId),
        eq(recipes.ownerId, userId),
      ),
    );

  const recipeIdsInCollection = recipesInCollection.map((r) => r.recipeId);

  if (recipeIdsInCollection.length > 0) {
    // Find which of these recipes are also in other collections
    const recipesWithOtherCollections = await db
      .select({ recipeId: recipeCollections.recipeId })
      .from(recipeCollections)
      .where(
        and(
          inArray(recipeCollections.recipeId, recipeIdsInCollection),
          ne(recipeCollections.collectionId, collectionId),
        ),
      );

    const recipesWithOtherCollectionsSet = new Set(
      recipesWithOtherCollections.map((r) => r.recipeId),
    );

    // Orphan recipes are those only in this collection
    const orphanRecipeIds = recipeIdsInCollection.filter(
      (id) => !recipesWithOtherCollectionsSet.has(id),
    );

    // Move orphan recipes to "Want to cook" collection
    if (orphanRecipeIds.length > 0) {
      const defaultCollections = await getOrCreateDefaultCollections(db, userId);
      await db
        .insert(recipeCollections)
        .values(
          orphanRecipeIds.map((recipeId) => ({
            recipeId,
            collectionId: defaultCollections.wantToCook.id,
            createdAt: new Date(),
          })),
        )
        .onConflictDoNothing();
    }
  }

  // Delete collection (cascade will handle recipeCollections)
  await db.delete(collections).where(eq(collections.id, collectionId));

  return { success: true };
}

// ─── Update Recipe Collections (Batch) ─────────────────────────────────────────

/**
 * Replace all collection memberships for a recipe.
 * If collectionIds is empty, the recipe will be removed from all collections.
 */
export async function updateRecipeCollections(
  db: DbClient,
  params: {
    userId: string;
    recipeId: number;
    collectionIds: number[];
  },
): Promise<{ collectionIds: number[] }> {
  const { userId, recipeId, collectionIds } = params;

  // Verify recipe exists and belongs to user
  const recipe = await db
    .select({ id: recipes.id, ownerId: recipes.ownerId })
    .from(recipes)
    .where(eq(recipes.id, recipeId))
    .then((rows) => rows[0]);

  if (!recipe) {
    throw new ServiceError("NOT_FOUND", "Recipe not found");
  }

  if (recipe.ownerId !== userId) {
    throw new ServiceError(
      "FORBIDDEN",
      "You can only modify collections for your own recipes",
    );
  }

  // If collectionIds provided, verify they all belong to user
  if (collectionIds.length > 0) {
    const userCollections = await db
      .select({ id: collections.id })
      .from(collections)
      .where(
        and(
          eq(collections.userId, userId),
          inArray(collections.id, collectionIds),
        ),
      );

    const validIds = new Set(userCollections.map((c) => c.id));
    const invalidIds = collectionIds.filter((id) => !validIds.has(id));

    if (invalidIds.length > 0) {
      throw new ServiceError(
        "BAD_REQUEST",
        "One or more collections not found",
      );
    }
  }

  // Get current collection memberships for this recipe (only user's collections)
  const currentMemberships = await db
    .select({ collectionId: recipeCollections.collectionId })
    .from(recipeCollections)
    .innerJoin(collections, eq(recipeCollections.collectionId, collections.id))
    .where(
      and(
        eq(recipeCollections.recipeId, recipeId),
        eq(collections.userId, userId),
      ),
    );

  const currentIds = new Set(currentMemberships.map((m) => m.collectionId));
  const newIds = new Set(collectionIds);

  // Calculate IDs to add and remove
  const toAdd = collectionIds.filter((id) => !currentIds.has(id));
  const toRemove = [...currentIds].filter((id) => !newIds.has(id));

  // Remove memberships
  if (toRemove.length > 0) {
    await db
      .delete(recipeCollections)
      .where(
        and(
          eq(recipeCollections.recipeId, recipeId),
          inArray(recipeCollections.collectionId, toRemove),
        ),
      );
  }

  // Add new memberships
  if (toAdd.length > 0) {
    await db
      .insert(recipeCollections)
      .values(
        toAdd.map((collectionId) => ({
          recipeId,
          collectionId,
          createdAt: new Date(),
        })),
      )
      .onConflictDoNothing();
  }

  return { collectionIds };
}
