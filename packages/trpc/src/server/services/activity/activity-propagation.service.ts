import type { DbType } from "@repo/db";
import {
  activityEvents,
  activityLikes,
  cookingReviews,
  cookingReviewImages,
  follows,
  user,
  recipes,
  recipeImages,
} from "@repo/db/schemas";
import { eq, desc, inArray, and } from "drizzle-orm";

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

// ─── Propagation Functions (send IDs to DOs) ─────────────────────────────────

/**
 * Propagate an activity ID to all followers and the user's own feed.
 * Now sends only the activity ID, not the full item.
 */
export async function propagateActivityToFollowers(
  db: DbType,
  env: TRPCEnv,
  activityEventId: number,
  userId: string,
  createdAt: Date,
): Promise<void> {
  // Get all followers of the user
  const followers = await db
    .select({ followerId: follows.followerId })
    .from(follows)
    .where(eq(follows.followingId, userId));

  // Fan out to each follower's Feed DO and to the user's own feed
  const targetUserIds = [userId, ...followers.map((f) => f.followerId)];

  const entry = {
    activityEventId,
    createdAt: createdAt.getTime(),
  };

  await Promise.all(
    targetUserIds.map(async (targetUserId) => {
      const feedDO = env.USER_FEED.get(env.USER_FEED.idFromName(targetUserId));
      await feedDO.fetch(
        new Request("http://do/addActivityId", {
          method: "POST",
          body: JSON.stringify(entry),
          headers: { "Content-Type": "application/json" },
        }),
      );
    }),
  );
}

/**
 * Backfill a user's feed with activity IDs from a newly followed user.
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
    .select({
      id: activityEvents.id,
      createdAt: activityEvents.createdAt,
    })
    .from(activityEvents)
    .where(eq(activityEvents.userId, followedUserId))
    .orderBy(desc(activityEvents.createdAt))
    .limit(limit);

  if (recentActivities.length === 0) return;

  const entries = recentActivities.map((a) => ({
    activityEventId: a.id,
    createdAt: a.createdAt.getTime(),
  }));

  const feedDO = env.USER_FEED.get(env.USER_FEED.idFromName(currentUserId));
  await feedDO.fetch(
    new Request("http://do/addActivityIds", {
      method: "POST",
      body: JSON.stringify(entries),
      headers: { "Content-Type": "application/json" },
    }),
  );
}

/**
 * Remove all activities from a user after unfollowing.
 * Now looks up activity IDs from DB since DO no longer stores user info.
 */
export async function removeUserFromFeed(
  db: DbType,
  env: TRPCEnv,
  currentUserId: string,
  unfollowedUserId: string,
): Promise<void> {
  // Get activity IDs for the unfollowed user
  const activities = await db
    .select({ id: activityEvents.id })
    .from(activityEvents)
    .where(eq(activityEvents.userId, unfollowedUserId));

  const activityIds = activities.map((a) => a.id);

  if (activityIds.length === 0) return;

  const feedDO = env.USER_FEED.get(env.USER_FEED.idFromName(currentUserId));
  await feedDO.fetch(
    new Request("http://do/removeActivityIds", {
      method: "POST",
      body: JSON.stringify({ activityIds }),
      headers: { "Content-Type": "application/json" },
    }),
  );
}

/**
 * Hydrate a user's feed from scratch with activity IDs.
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

  const userIdsToFetch = [userId, ...following.map((f) => f.followingId)];

  const allEntries: { activityEventId: number; createdAt: number }[] = [];

  for (const targetUserId of userIdsToFetch) {
    const recentActivities = await db
      .select({
        id: activityEvents.id,
        createdAt: activityEvents.createdAt,
      })
      .from(activityEvents)
      .where(eq(activityEvents.userId, targetUserId))
      .orderBy(desc(activityEvents.createdAt))
      .limit(limitPerUser);

    for (const activity of recentActivities) {
      allEntries.push({
        activityEventId: activity.id,
        createdAt: activity.createdAt.getTime(),
      });
    }
  }

  if (allEntries.length > 0) {
    const feedDO = env.USER_FEED.get(env.USER_FEED.idFromName(userId));
    await feedDO.fetch(
      new Request("http://do/addActivityIds", {
        method: "POST",
        body: JSON.stringify(allEntries),
        headers: { "Content-Type": "application/json" },
      }),
    );
  }

  return allEntries.length;
}

// ─── Hydration Functions (convert IDs to FeedItems) ──────────────────────────

/**
 * Hydrate activity IDs into full FeedItem objects.
 * This is the new read path - DO returns IDs, we hydrate from DB.
 */
export async function hydrateActivityIds(
  db: DbType,
  activityIds: number[],
  currentUserId: string,
): Promise<FeedItem[]> {
  if (activityIds.length === 0) return [];

  // Batch fetch all activity events
  const activities = await db
    .select({
      id: activityEvents.id,
      type: activityEvents.type,
      userId: activityEvents.userId,
      recipeId: activityEvents.recipeId,
      likeCount: activityEvents.likeCount,
      commentCount: activityEvents.commentCount,
      createdAt: activityEvents.createdAt,
    })
    .from(activityEvents)
    .where(inArray(activityEvents.id, activityIds));

  if (activities.length === 0) return [];

  // Batch fetch users
  const userIds = [...new Set(activities.map((a) => a.userId))];
  const users = await db
    .select({
      id: user.id,
      name: user.name,
      image: user.image,
    })
    .from(user)
    .where(inArray(user.id, userIds));
  const userMap = new Map(users.map((u) => [u.id, u]));

  // Batch fetch recipes
  const recipeIds = [
    ...new Set(
      activities.filter((a) => a.recipeId).map((a) => a.recipeId as number)
    ),
  ];

  const recipesData =
    recipeIds.length > 0
      ? await db
          .select({
            id: recipes.id,
            name: recipes.name,
            sourceUrl: recipes.sourceUrl,
            sourceType: recipes.sourceType,
          })
          .from(recipes)
          .where(inArray(recipes.id, recipeIds))
      : [];
  const recipeMap = new Map(recipesData.map((r) => [r.id, r]));

  // Batch fetch recipe images (first image per recipe)
  const recipeImagesData =
    recipeIds.length > 0
      ? await db
          .select({
            recipeId: recipeImages.recipeId,
            url: recipeImages.url,
          })
          .from(recipeImages)
          .where(inArray(recipeImages.recipeId, recipeIds))
      : [];

  const recipeImageMap = new Map<number, string>();
  for (const img of recipeImagesData) {
    if (!recipeImageMap.has(img.recipeId)) {
      recipeImageMap.set(img.recipeId, img.url);
    }
  }

  // Batch fetch cooking reviews for review activities
  const reviewActivityIds = activities
    .filter((a) => a.type === "cooking_review")
    .map((a) => a.id);

  const reviewsData =
    reviewActivityIds.length > 0
      ? await db
          .select({
            activityEventId: cookingReviews.activityEventId,
            id: cookingReviews.id,
            rating: cookingReviews.rating,
            reviewText: cookingReviews.reviewText,
          })
          .from(cookingReviews)
          .where(inArray(cookingReviews.activityEventId, reviewActivityIds))
      : [];

  const reviewMap = new Map(
    reviewsData.map((r) => [r.activityEventId as number, r])
  );

  // Batch fetch review images
  const reviewIds = reviewsData.map((r) => r.id);
  const reviewImagesData =
    reviewIds.length > 0
      ? await db
          .select({
            reviewId: cookingReviewImages.reviewId,
            url: cookingReviewImages.url,
            index: cookingReviewImages.index,
          })
          .from(cookingReviewImages)
          .where(inArray(cookingReviewImages.reviewId, reviewIds))
          .orderBy(cookingReviewImages.index)
      : [];

  const reviewImageMap = new Map<number, string[]>();
  for (const img of reviewImagesData) {
    if (!reviewImageMap.has(img.reviewId)) {
      reviewImageMap.set(img.reviewId, []);
    }
    reviewImageMap.get(img.reviewId)!.push(img.url);
  }

  // Batch fetch like status for current user
  const likesData = await db
    .select({ activityEventId: activityLikes.activityEventId })
    .from(activityLikes)
    .where(
      and(
        inArray(activityLikes.activityEventId, activityIds),
        eq(activityLikes.userId, currentUserId)
      )
    );
  const likedSet = new Set(likesData.map((l) => l.activityEventId));

  // Build feed items
  const feedItems: FeedItem[] = [];

  for (const activity of activities) {
    const actor = userMap.get(activity.userId);
    if (!actor) continue;

    if (!activity.recipeId) continue;
    const recipe = recipeMap.get(activity.recipeId);
    if (!recipe) continue;

    // Filter out image-sourced recipes from feed
    if (recipe.sourceType === "image") continue;

    const recipeImage = recipeImageMap.get(recipe.id) ?? null;

    // Build recipe metadata
    const sourceType = recipe.sourceType as SourceType;
    let recipeMetadata: RecipeMetadata;

    if (sourceType === "url" && recipe.sourceUrl) {
      const sourceDomain = extractDomain(recipe.sourceUrl);
      recipeMetadata = {
        id: recipe.id,
        name: recipe.name,
        image: recipeImage,
        sourceType: "url",
        sourceUrl: recipe.sourceUrl,
        sourceDomain: sourceDomain ?? recipe.sourceUrl,
      };
    } else {
      recipeMetadata = {
        id: recipe.id,
        name: recipe.name,
        image: recipeImage,
        sourceType: sourceType === "url" ? "manual" : sourceType,
      };
    }

    const baseItem = {
      id: activity.id.toString(),
      actor: {
        id: actor.id,
        name: actor.name,
        image: actor.image ?? null,
      },
      createdAt: activity.createdAt.getTime(),
      likeCount: activity.likeCount,
      commentCount: activity.commentCount,
      isLiked: likedSet.has(activity.id),
    };

    if (activity.type === "cooking_review") {
      const review = reviewMap.get(activity.id);
      if (!review) continue;

      const reviewImages = reviewImageMap.get(review.id) ?? [];

      feedItems.push({
        ...baseItem,
        type: "cooking_review",
        recipe: recipeMetadata,
        review: {
          rating: review.rating,
          text: review.reviewText,
          images: reviewImages,
        },
      });
    } else {
      feedItems.push({
        ...baseItem,
        type: "recipe_import",
        recipe: recipeMetadata,
      });
    }
  }

  // Sort by original order (activityIds array order for pagination consistency)
  const idOrder = new Map(activityIds.map((id, idx) => [id, idx]));
  feedItems.sort(
    (a, b) =>
      (idOrder.get(parseInt(a.id)) ?? 0) - (idOrder.get(parseInt(b.id)) ?? 0)
  );

  return feedItems;
}

// ─── Legacy buildFeedItem (kept for getUserActivities) ───────────────────────

/**
 * Build a single feed item from an activity event.
 * Used by getUserActivities which doesn't go through the DO.
 */
export async function buildFeedItem(
  db: DbType,
  activityEventId: number,
  currentUserId?: string,
): Promise<FeedItem | null> {
  const items = await hydrateActivityIds(
    db,
    [activityEventId],
    currentUserId ?? ""
  );
  return items[0] ?? null;
}
