import {
  recipes,
  recipeImages,
  recipeCollections,
  collections,
  userLikes,
  recipeTags,
  tags,
  follows,
  user,
} from "@repo/db/schemas";
import {
  eq,
  and,
  ilike,
  like,
  desc,
  min,
  countDistinct,
  sql,
  inArray,
  gte,
} from "drizzle-orm";

import type { DbClient } from "../types";

// ─── Types ─────────────────────────────────────────────────────────────────

export interface RecipeQueryFilters {
  search?: string | undefined;
  tagIds?: number[] | undefined;
  maxTotalTime?: string | undefined;
}

export interface RecipeQueryCursor {
  id: number;
  score: number;
}

export type RecipeListItem = Omit<typeof recipes.$inferSelect, "uploadedBy"> & {
  uploadedBy: {
    id: string;
    name: string;
    email: string;
    image: string | null;
  };
  coverImage: string | null;
  saveCount: number;
  likeCount: number;
  collectionIds: number[];
  isLiked: boolean;
  isFollowing: boolean;
  tags: (typeof tags.$inferSelect)[];
  relevanceScore: number;
};

export interface PaginatedRecipeResult {
  items: RecipeListItem[];
  nextCursor?: RecipeQueryCursor | undefined;
}

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

// ─── Main Query Function ───────────────────────────────────────────────────

/**
 * Unified recipe list query with optional filters
 * Replaces both getRecommendedRecipes and searchAllRecipes
 */
export async function queryRecipeList(
  db: DbClient,
  userId: string,
  options: {
    filters?: RecipeQueryFilters | undefined;
    cursor?: RecipeQueryCursor | undefined;
    limit: number;
  },
): Promise<PaginatedRecipeResult> {
  const { filters = {}, cursor, limit } = options;
  const { search, tagIds, maxTotalTime } = filters;

  // Relevance score expression (shared by all queries)
  const relevanceScoreExpr = sql<number>`
    ${countDistinct(userLikes.id)} +
    ${countDistinct(recipeCollections.id)} +
    CASE WHEN ${follows.id} IS NOT NULL THEN 10 ELSE 0 END
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
      likeCount: countDistinct(userLikes.id),
      relevanceScore: relevanceScoreExpr,
      isFollowing: sql<boolean>`${follows.id} IS NOT NULL`,
      isLiked: sql<boolean>`EXISTS(
        SELECT 1 FROM ${userLikes}
        WHERE ${userLikes.recipeId} = ${recipes.id}
        AND ${userLikes.userId} = ${userId}
      )`,
    })
    .from(recipes)
    .innerJoin(user, eq(recipes.uploadedBy, user.id))
    .leftJoin(recipeImages, eq(recipes.id, recipeImages.recipeId))
    .leftJoin(recipeCollections, eq(recipes.id, recipeCollections.recipeId))
    .leftJoin(userLikes, eq(recipes.id, userLikes.recipeId))
    .leftJoin(recipeTags, eq(recipes.id, recipeTags.recipeId))
    .leftJoin(
      follows,
      and(
        eq(follows.followingId, recipes.uploadedBy),
        eq(follows.followerId, userId),
      ),
    )
    .where(
      and(
        // Optional search filter
        search ? ilike(recipes.name, `%${search}%`) : undefined,
        // Optional time filter
        maxTotalTime ? like(recipes.totalTime, `%${maxTotalTime}%`) : undefined,
      ),
    )
    .groupBy(recipes.id, user.id, user.name, user.email, user.image, follows.id)
    .having(
      and(
        // Optional tag filter (post-aggregation)
        tagIds && tagIds.length > 0
          ? sql`COUNT(DISTINCT CASE WHEN ${inArray(recipeTags.tagId, tagIds)} THEN ${recipeTags.tagId} END) > 0`
          : undefined,
        // Cursor pagination
        cursor
          ? sql`(${relevanceScoreExpr} < ${cursor.score} OR (${relevanceScoreExpr} = ${cursor.score} AND ${recipes.id} < ${cursor.id}))`
          : undefined,
      ),
    )
    .orderBy(desc(relevanceScoreExpr), desc(recipes.id))
    .limit(limit + 1);

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

  // Process results
  const hasMore = queryResults.length > limit;
  const resultsToReturn = hasMore ? queryResults.slice(0, limit) : queryResults;

  const items = resultsToReturn.map((item) => ({
    ...item.recipe,
    uploadedBy: item.uploader,
    coverImage: item.firstImage,
    saveCount: item.saveCount,
    likeCount: item.likeCount,
    collectionIds: collectionsByRecipe[item.recipe.id] || [],
    isLiked: item.isLiked,
    isFollowing: item.isFollowing,
    tags: tagsByRecipe[item.recipe.id] || [],
    relevanceScore: Number(item.relevanceScore),
  }));

  const lastItem = resultsToReturn[resultsToReturn.length - 1];
  const nextCursor: RecipeQueryCursor | undefined =
    hasMore && lastItem
      ? { id: lastItem.recipe.id, score: Number(lastItem.relevanceScore) }
      : undefined;

  return { items, nextCursor };
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

  // Count recent engagement (likes and saves within past 7 days)
  const recentEngagementExpr = sql<number>`
    COUNT(DISTINCT CASE WHEN ${userLikes.createdAt} >= ${sevenDaysAgo} THEN ${userLikes.id} END) +
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
      likeCount: countDistinct(userLikes.id),
      recentEngagement: recentEngagementExpr,
      isFollowing: sql<boolean>`${follows.id} IS NOT NULL`,
      isLiked: sql<boolean>`EXISTS(
        SELECT 1 FROM ${userLikes}
        WHERE ${userLikes.recipeId} = ${recipes.id}
        AND ${userLikes.userId} = ${userId}
      )`,
    })
    .from(recipes)
    .innerJoin(user, eq(recipes.uploadedBy, user.id))
    .leftJoin(recipeImages, eq(recipes.id, recipeImages.recipeId))
    .leftJoin(recipeCollections, eq(recipes.id, recipeCollections.recipeId))
    .leftJoin(userLikes, eq(recipes.id, userLikes.recipeId))
    .leftJoin(
      follows,
      and(
        eq(follows.followingId, recipes.uploadedBy),
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
    uploadedBy: item.uploader,
    coverImage: item.firstImage,
    saveCount: item.saveCount,
    likeCount: item.likeCount,
    collectionIds: collectionsByRecipe[item.recipe.id] || [],
    isLiked: item.isLiked,
    isFollowing: item.isFollowing,
    tags: tagsByRecipe[item.recipe.id] || [],
    relevanceScore: Number(item.recentEngagement),
  }));
}
