import {
  recipes,
  recipeImages,
  recipeCollections,
  collections,
  recipeTags,
  tags,
  follows,
  user,
} from "@repo/db/schemas";
import {
  eq,
  and,
  desc,
  min,
  countDistinct,
  sql,
  inArray,
} from "drizzle-orm";

import type { DbClient } from "../types";

// ─── Types ─────────────────────────────────────────────────────────────────

export type RecipeListItem = Omit<typeof recipes.$inferSelect, "ownerId"> & {
  owner: {
    id: string;
    name: string;
    email: string;
    image: string | null;
  };
  coverImage: string | null;
  saveCount: number;
  collectionIds: number[];
  isFollowing: boolean;
  tags: (typeof tags.$inferSelect)[];
  relevanceScore: number;
};

// ─── Helper Functions ──────────────────────────────────────────────────────

/**
 * Group tags by recipe ID for batch assignment
 */
export function groupTagsByRecipeId(
  tagsData: { recipeId: number; tag: typeof tags.$inferSelect | null }[],
): Record<number, (typeof tags.$inferSelect)[]> {
  return tagsData.reduce(
    (acc, item) => {
      if (!acc[item.recipeId]) {
        acc[item.recipeId] = [];
      }
      if (item.tag) {
        acc[item.recipeId]!.push(item.tag);
      }
      return acc;
    },
    {} as Record<number, (typeof tags.$inferSelect)[]>,
  );
}

/**
 * Group collection IDs by recipe ID for batch assignment
 */
export function groupCollectionsByRecipeId(
  collectionsData: { recipeId: number; collectionId: number }[],
): Record<number, number[]> {
  return collectionsData.reduce(
    (acc, item) => {
      if (!acc[item.recipeId]) {
        acc[item.recipeId] = [];
      }
      acc[item.recipeId]!.push(item.collectionId);
      return acc;
    },
    {} as Record<number, number[]>,
  );
}

// ─── Popular This Week Query ────────────────────────────────────────────────

/**
 * Get recipes with engagement (likes/saves) in the past 7 days
 * Returns a flat list ordered by recent engagement
 */
export async function queryPopularRecipesThisWeek(
  db: DbClient,
  userId: string,
  limit: number = 10,
): Promise<RecipeListItem[]> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Count recent engagement (saves within past 7 days)
  const recentEngagementExpr = sql<number>`
    COUNT(DISTINCT CASE WHEN ${recipeCollections.createdAt} >= ${sevenDaysAgo} THEN ${recipeCollections.id} END)
  `;

  // Build the query
  const queryResults = await db
    .select({
      recipe: recipes,
      uploader: {
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
      },
      firstImage: min(recipeImages.url),
      saveCount: countDistinct(recipeCollections.id),
      recentEngagement: recentEngagementExpr,
      isFollowing: sql<boolean>`${follows.id} IS NOT NULL`,
    })
    .from(recipes)
    .innerJoin(user, eq(recipes.ownerId, user.id))
    .leftJoin(recipeImages, eq(recipes.id, recipeImages.recipeId))
    .leftJoin(recipeCollections, eq(recipes.id, recipeCollections.recipeId))
    .leftJoin(
      follows,
      and(
        eq(follows.followingId, recipes.ownerId),
        eq(follows.followerId, userId),
      ),
    )
    .groupBy(recipes.id, user.id, user.name, user.email, user.image, follows.id)
    .having(sql`${recentEngagementExpr} > 0`)
    .orderBy(desc(recentEngagementExpr), desc(recipes.id))
    .limit(limit);

  // Fetch related data
  const recipeIds = queryResults.map((item) => item.recipe.id);

  const [tagsData, collectionsData] = await Promise.all([
    recipeIds.length > 0
      ? db
          .select({
            recipeId: recipeTags.recipeId,
            tag: tags,
          })
          .from(recipeTags)
          .innerJoin(tags, eq(recipeTags.tagId, tags.id))
          .where(inArray(recipeTags.recipeId, recipeIds))
      : [],
    recipeIds.length > 0
      ? db
          .select({
            recipeId: recipeCollections.recipeId,
            collectionId: recipeCollections.collectionId,
          })
          .from(recipeCollections)
          .innerJoin(
            collections,
            eq(recipeCollections.collectionId, collections.id),
          )
          .where(
            and(
              inArray(recipeCollections.recipeId, recipeIds),
              eq(collections.userId, userId),
            ),
          )
      : [],
  ]);

  // Group related data
  const tagsByRecipe = groupTagsByRecipeId(tagsData);
  const collectionsByRecipe = groupCollectionsByRecipeId(collectionsData);

  return queryResults.map((item) => ({
    ...item.recipe,
    owner: item.uploader,
    coverImage: item.firstImage,
    saveCount: item.saveCount,
    collectionIds: collectionsByRecipe[item.recipe.id] || [],
    isFollowing: item.isFollowing,
    tags: tagsByRecipe[item.recipe.id] || [],
    relevanceScore: Number(item.recentEngagement),
  }));
}
