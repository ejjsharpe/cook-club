import type { DbType } from "@repo/db";
import {
  activityEvents,
  cookingReviews,
  cookingReviewImages,
  follows,
  user,
  recipes,
  recipeImages,
} from "@repo/db/schemas";
import { eq, desc } from "drizzle-orm";

import type { Env } from "../../../../../../apps/server/src/types";
import type { FeedItem } from "../../types/feed";

/**
 * Extract domain from a URL.
 */
function extractDomain(url: string | null): string | null {
  if (!url) return null;
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace("www.", "");
  } catch {
    return null;
  }
}

/**
 * Build a feed item from an activity event for propagation.
 */
export async function buildFeedItem(
  db: DbType,
  activityEventId: number
): Promise<FeedItem | null> {
  // Fetch the activity event with related data
  const activity = await db
    .select({
      id: activityEvents.id,
      type: activityEvents.type,
      userId: activityEvents.userId,
      recipeId: activityEvents.recipeId,
      batchImportCount: activityEvents.batchImportCount,
      batchImportSource: activityEvents.batchImportSource,
      createdAt: activityEvents.createdAt,
    })
    .from(activityEvents)
    .where(eq(activityEvents.id, activityEventId))
    .then((rows) => rows[0]);

  if (!activity) return null;

  // Fetch actor (user) info
  const actor = await db
    .select({
      id: user.id,
      name: user.name,
      image: user.image,
    })
    .from(user)
    .where(eq(user.id, activity.userId))
    .then((rows) => rows[0]);

  if (!actor) return null;

  // Fetch recipe info if there's a recipeId
  let recipeData: {
    id: number;
    name: string;
    sourceUrl: string | null;
    sourceType: string;
    coverImage: string | null;
  } | null = null;

  if (activity.recipeId) {
    const recipe = await db
      .select({
        id: recipes.id,
        name: recipes.name,
        sourceUrl: recipes.sourceUrl,
        sourceType: recipes.sourceType,
      })
      .from(recipes)
      .where(eq(recipes.id, activity.recipeId))
      .then((rows) => rows[0]);

    if (recipe) {
      // Filter out image-sourced recipes from feed
      if (recipe.sourceType === "image") {
        return null;
      }

      // Get first image
      const image = await db
        .select({ url: recipeImages.url })
        .from(recipeImages)
        .where(eq(recipeImages.recipeId, recipe.id))
        .limit(1)
        .then((rows) => rows[0]);

      recipeData = {
        id: recipe.id,
        name: recipe.name,
        sourceUrl: recipe.sourceUrl,
        sourceType: recipe.sourceType,
        coverImage: image?.url ?? null,
      };
    }
  }

  // For cooking reviews, fetch review data
  let reviewData: {
    rating: number;
    reviewText: string | null;
    images: string[];
  } | null = null;

  if (activity.type === "cooking_review") {
    const review = await db
      .select({
        id: cookingReviews.id,
        rating: cookingReviews.rating,
        reviewText: cookingReviews.reviewText,
      })
      .from(cookingReviews)
      .where(eq(cookingReviews.activityEventId, activityEventId))
      .then((rows) => rows[0]);

    if (review) {
      const images = await db
        .select({ url: cookingReviewImages.url })
        .from(cookingReviewImages)
        .where(eq(cookingReviewImages.reviewId, review.id))
        .orderBy(cookingReviewImages.index);

      reviewData = {
        rating: review.rating,
        reviewText: review.reviewText,
        images: images.map((img) => img.url),
      };
    }
  }

  const sourceType = (recipeData?.sourceType ?? "manual") as "url" | "image" | "text" | "ai" | "manual" | "user";
  const isExternalRecipe = !!recipeData?.sourceUrl;
  const sourceDomain = extractDomain(recipeData?.sourceUrl ?? null);
  // Users can view full recipe for text, ai, and manual sources (not url-scraped)
  const canViewFullRecipe = sourceType !== "url";

  return {
    id: activity.id.toString(),
    type: activity.type as "recipe_import" | "cooking_review",
    actorId: actor.id,
    actorName: actor.name,
    actorImage: actor.image ?? null,
    recipeId: recipeData?.id ?? null,
    recipeName: recipeData?.name ?? null,
    recipeImage: recipeData?.coverImage ?? null,
    sourceUrl: recipeData?.sourceUrl ?? null,
    sourceDomain,
    sourceType,
    isExternalRecipe,
    canViewFullRecipe,
    batchCount: activity.batchImportCount,
    batchSource: activity.batchImportSource,
    rating: reviewData?.rating ?? null,
    reviewText: reviewData?.reviewText ?? null,
    reviewImages: reviewData?.images ?? [],
    createdAt: activity.createdAt.getTime(),
  };
}

/**
 * Propagate an activity to all followers of the user.
 */
export async function propagateActivityToFollowers(
  db: DbType,
  env: Env,
  activityEventId: number,
  userId: string
): Promise<void> {
  // Build the feed item
  const feedItem = await buildFeedItem(db, activityEventId);
  if (!feedItem) return;

  // Get all followers of the user
  const followers = await db
    .select({ followerId: follows.followerId })
    .from(follows)
    .where(eq(follows.followingId, userId));

  // Fan out to each follower's Feed DO
  await Promise.all(
    followers.map(async (follower) => {
      const feedDO = env.USER_FEED.get(
        env.USER_FEED.idFromName(follower.followerId)
      );
      await feedDO.fetch(new Request("http://do/addFeedItem", {
        method: "POST",
        body: JSON.stringify(feedItem),
        headers: { "Content-Type": "application/json" },
      }));
    })
  );
}

/**
 * Backfill a user's feed with recent activities from a newly followed user.
 */
export async function backfillFeedFromUser(
  db: DbType,
  env: Env,
  currentUserId: string,
  followedUserId: string,
  limit: number = 10
): Promise<void> {
  // Get recent activities from the followed user
  const recentActivities = await db
    .select({ id: activityEvents.id })
    .from(activityEvents)
    .where(eq(activityEvents.userId, followedUserId))
    .orderBy(desc(activityEvents.createdAt))
    .limit(limit);

  // Build feed items
  const feedItems: FeedItem[] = [];
  for (const activity of recentActivities) {
    const feedItem = await buildFeedItem(db, activity.id);
    if (feedItem) {
      feedItems.push(feedItem);
    }
  }

  if (feedItems.length > 0) {
    // Add to the current user's feed
    const feedDO = env.USER_FEED.get(env.USER_FEED.idFromName(currentUserId));
    await feedDO.fetch(new Request("http://do/addFeedItems", {
      method: "POST",
      body: JSON.stringify(feedItems),
      headers: { "Content-Type": "application/json" },
    }));
  }
}

/**
 * Remove all items from a user after unfollowing.
 */
export async function removeUserFromFeed(
  env: Env,
  currentUserId: string,
  unfollowedUserId: string
): Promise<void> {
  const feedDO = env.USER_FEED.get(env.USER_FEED.idFromName(currentUserId));
  await feedDO.fetch(new Request("http://do/removeItemsFromUser", {
    method: "POST",
    body: JSON.stringify({ userId: unfollowedUserId }),
    headers: { "Content-Type": "application/json" },
  }));
}

/**
 * Hydrate a user's feed from scratch based on who they follow.
 * Useful for development/seeding or when DO state is lost.
 */
export async function hydrateFeed(
  db: DbType,
  env: Env,
  userId: string,
  limitPerUser: number = 10
): Promise<number> {
  // Get all users this person follows
  const following = await db
    .select({ followingId: follows.followingId })
    .from(follows)
    .where(eq(follows.followerId, userId));

  if (following.length === 0) {
    return 0;
  }

  // Collect all feed items from followed users
  const allFeedItems: FeedItem[] = [];

  for (const { followingId } of following) {
    const recentActivities = await db
      .select({ id: activityEvents.id })
      .from(activityEvents)
      .where(eq(activityEvents.userId, followingId))
      .orderBy(desc(activityEvents.createdAt))
      .limit(limitPerUser);

    for (const activity of recentActivities) {
      const feedItem = await buildFeedItem(db, activity.id);
      if (feedItem) {
        allFeedItems.push(feedItem);
      }
    }
  }

  if (allFeedItems.length > 0) {
    // Add all items to the user's feed DO
    const feedDO = env.USER_FEED.get(env.USER_FEED.idFromName(userId));
    await feedDO.fetch(new Request("http://do/addFeedItems", {
      method: "POST",
      body: JSON.stringify(allFeedItems),
      headers: { "Content-Type": "application/json" },
    }));
  }

  return allFeedItems.length;
}
