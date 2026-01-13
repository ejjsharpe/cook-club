import type { DbType } from "../../index";
import {
  activityEvents,
  activityLikes,
  cookingReviews,
  cookingReviewImages,
  user,
  recipes,
  recipeImages,
} from "../../schemas";
import { inArray, and, eq } from "drizzle-orm";

import type { FeedItem, RecipeMetadata, SourceType } from "./feed-types";

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
