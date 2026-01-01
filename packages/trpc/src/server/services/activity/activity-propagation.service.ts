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

import type { TRPCEnv } from "../../env";
import type { FeedItem, RecipeMetadata, SourceType } from "../../types/feed";

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
  activityEventId: number,
): Promise<FeedItem | null> {
  // Fetch the activity event
  const activity = await db
    .select({
      id: activityEvents.id,
      type: activityEvents.type,
      userId: activityEvents.userId,
      recipeId: activityEvents.recipeId,
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

  // Recipe is required for current activity types
  if (!activity.recipeId) return null;

  // Fetch recipe info
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

  if (!recipe) return null;

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

  // Build recipe metadata based on source type
  const sourceType = recipe.sourceType as SourceType;
  let recipeMetadata: RecipeMetadata;

  if (sourceType === "url" && recipe.sourceUrl) {
    const sourceDomain = extractDomain(recipe.sourceUrl);
    recipeMetadata = {
      id: recipe.id,
      name: recipe.name,
      image: image?.url ?? null,
      sourceType: "url",
      sourceUrl: recipe.sourceUrl,
      sourceDomain: sourceDomain ?? recipe.sourceUrl,
    };
  } else {
    recipeMetadata = {
      id: recipe.id,
      name: recipe.name,
      image: image?.url ?? null,
      sourceType: sourceType === "url" ? "manual" : sourceType,
    };
  }

  // Build base item
  const baseItem = {
    id: activity.id.toString(),
    actor: {
      id: actor.id,
      name: actor.name,
      image: actor.image ?? null,
    },
    createdAt: activity.createdAt.getTime(),
  };

  // Return type-specific item
  if (activity.type === "cooking_review") {
    // Fetch review data
    const review = await db
      .select({
        id: cookingReviews.id,
        rating: cookingReviews.rating,
        reviewText: cookingReviews.reviewText,
      })
      .from(cookingReviews)
      .where(eq(cookingReviews.activityEventId, activityEventId))
      .then((rows) => rows[0]);

    if (!review) return null;

    const reviewImages = await db
      .select({ url: cookingReviewImages.url })
      .from(cookingReviewImages)
      .where(eq(cookingReviewImages.reviewId, review.id))
      .orderBy(cookingReviewImages.index);

    return {
      ...baseItem,
      type: "cooking_review",
      recipe: recipeMetadata,
      review: {
        rating: review.rating,
        text: review.reviewText,
        images: reviewImages.map((img) => img.url),
      },
    };
  } else {
    return {
      ...baseItem,
      type: "recipe_import",
      recipe: recipeMetadata,
    };
  }
}

/**
 * Propagate an activity to all followers of the user and to the user's own feed.
 */
export async function propagateActivityToFollowers(
  db: DbType,
  env: TRPCEnv,
  activityEventId: number,
  userId: string,
): Promise<void> {
  // Build the feed item
  const feedItem = await buildFeedItem(db, activityEventId);
  if (!feedItem) return;

  // Get all followers of the user
  const followers = await db
    .select({ followerId: follows.followerId })
    .from(follows)
    .where(eq(follows.followingId, userId));

  // Fan out to each follower's Feed DO and to the user's own feed
  const targetUserIds = [userId, ...followers.map((f) => f.followerId)];

  await Promise.all(
    targetUserIds.map(async (targetUserId) => {
      const feedDO = env.USER_FEED.get(env.USER_FEED.idFromName(targetUserId));
      await feedDO.fetch(
        new Request("http://do/addFeedItem", {
          method: "POST",
          body: JSON.stringify(feedItem),
          headers: { "Content-Type": "application/json" },
        }),
      );
    }),
  );
}

/**
 * Backfill a user's feed with recent activities from a newly followed user.
 */
export async function backfillFeedFromUser(
  db: DbType,
  env: TRPCEnv,
  currentUserId: string,
  followedUserId: string,
  limit: number = 10,
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
    await feedDO.fetch(
      new Request("http://do/addFeedItems", {
        method: "POST",
        body: JSON.stringify(feedItems),
        headers: { "Content-Type": "application/json" },
      }),
    );
  }
}

/**
 * Remove all items from a user after unfollowing.
 */
export async function removeUserFromFeed(
  env: TRPCEnv,
  currentUserId: string,
  unfollowedUserId: string,
): Promise<void> {
  const feedDO = env.USER_FEED.get(env.USER_FEED.idFromName(currentUserId));
  await feedDO.fetch(
    new Request("http://do/removeItemsFromUser", {
      method: "POST",
      body: JSON.stringify({ userId: unfollowedUserId }),
      headers: { "Content-Type": "application/json" },
    }),
  );
}

/**
 * Hydrate a user's feed from scratch based on who they follow and their own activities.
 * Useful for development/seeding or when DO state is lost.
 */
export async function hydrateFeed(
  db: DbType,
  env: TRPCEnv,
  userId: string,
  limitPerUser: number = 10,
): Promise<number> {
  // Get all users this person follows
  const following = await db
    .select({ followingId: follows.followingId })
    .from(follows)
    .where(eq(follows.followerId, userId));

  // Include the user's own activities plus followed users' activities
  const userIdsToFetch = [userId, ...following.map((f) => f.followingId)];

  // Collect all feed items from the user and followed users
  const allFeedItems: FeedItem[] = [];

  for (const targetUserId of userIdsToFetch) {
    const recentActivities = await db
      .select({ id: activityEvents.id })
      .from(activityEvents)
      .where(eq(activityEvents.userId, targetUserId))
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
    await feedDO.fetch(
      new Request("http://do/addFeedItems", {
        method: "POST",
        body: JSON.stringify(allFeedItems),
        headers: { "Content-Type": "application/json" },
      }),
    );
  }

  return allFeedItems.length;
}
