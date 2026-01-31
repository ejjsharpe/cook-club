import {
  activityEvents,
  activityLikes,
  cookingReviews,
  cookingReviewImages,
  recipes,
  user,
} from "@repo/db/schemas";
import { hydrateActivityIds, createNotification } from "@repo/db/services";
import { TRPCError } from "@trpc/server";
import { type } from "arktype";
import { eq, desc, lt, and, sql, inArray } from "drizzle-orm";

import { router, authedProcedure } from "../trpc";
import { propagateActivityToFollowers, hydrateFeed } from "../services/activity";

interface GetFeedIdsResponse {
  activityIds: number[];
  nextCursor: string | null;
}

export const activityRouter = router({
  // Get the user's activity feed from their Durable Object
  getFeed: authedProcedure
    .input(
      type({
        cursor: "string?",
        limit: "number = 20",
      }),
    )
    .query(async ({ ctx, input }) => {
      const { cursor, limit } = input;

      try {
        const feedDO = ctx.env.USER_FEED.get(
          ctx.env.USER_FEED.idFromName(ctx.user.id),
        );

        const url = new URL("http://do/getFeedIds");
        if (cursor) url.searchParams.set("cursor", cursor);
        url.searchParams.set("limit", limit.toString());

        const response = await feedDO.fetch(new Request(url.toString()));
        let result = (await response.json()) as GetFeedIdsResponse;

        // Auto-hydrate feed if empty and no cursor (first page request)
        if (result.activityIds.length === 0 && !cursor) {
          await hydrateFeed(ctx.db, ctx.env, ctx.user.id);
          // Re-fetch after hydration
          const hydratedResponse = await feedDO.fetch(
            new Request(url.toString()),
          );
          result = (await hydratedResponse.json()) as GetFeedIdsResponse;
        }

        // Hydrate activity IDs into full FeedItems
        const items = await hydrateActivityIds(
          ctx.db,
          result.activityIds,
          ctx.user.id,
        );

        return {
          items,
          nextCursor: result.nextCursor,
        };
      } catch (err) {
        console.error("getFeed error:", err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch activity feed",
        });
      }
    }),

  // Create a cooking review (also creates activity event and fans out)
  createCookingReview: authedProcedure
    .input(
      type({
        recipeId: "number",
        rating: "1 <= number <= 5",
        reviewText: "string?",
        imageUrls: "string[]?",
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { recipeId, rating, reviewText, imageUrls } = input;

      try {
        // Verify recipe exists
        const recipe = await ctx.db
          .select({ id: recipes.id, name: recipes.name })
          .from(recipes)
          .where(eq(recipes.id, recipeId))
          .then((rows) => rows[0]);

        if (!recipe) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Recipe not found",
          });
        }

        const now = new Date();

        // Create activity event
        const activityEventResult = await ctx.db
          .insert(activityEvents)
          .values({
            userId: ctx.user.id,
            type: "cooking_review",
            recipeId,
            createdAt: now,
          })
          .returning();

        const activityEvent = activityEventResult[0];
        if (!activityEvent) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create activity event",
          });
        }

        // Create cooking review
        const reviewResult = await ctx.db
          .insert(cookingReviews)
          .values({
            userId: ctx.user.id,
            recipeId,
            activityEventId: activityEvent.id,
            rating: Math.round(rating), // Ensure integer
            reviewText: reviewText ?? null,
            createdAt: now,
            updatedAt: now,
          })
          .returning();

        const review = reviewResult[0];
        if (!review) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create review",
          });
        }

        // Create review images if provided
        if (imageUrls && imageUrls.length > 0) {
          await ctx.db.insert(cookingReviewImages).values(
            imageUrls.map((url, index) => ({
              reviewId: review.id,
              url,
              index,
            })),
          );
        }

        // Propagate to followers
        await propagateActivityToFollowers(
          ctx.db,
          ctx.env,
          activityEvent.id,
          ctx.user.id,
          now,
        );

        return {
          id: review.id,
          activityEventId: activityEvent.id,
        };
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create cooking review",
        });
      }
    }),

  // Get reviews for a specific recipe
  getRecipeReviews: authedProcedure
    .input(
      type({
        recipeId: "number",
        cursor: "number?",
        limit: "number = 20",
      }),
    )
    .query(async ({ ctx, input }) => {
      const { recipeId, cursor, limit } = input;

      try {
        // Build query with proper SQL cursor pagination
        const conditions = cursor
          ? and(
              eq(cookingReviews.recipeId, recipeId),
              lt(cookingReviews.id, cursor)
            )
          : eq(cookingReviews.recipeId, recipeId);

        const results = await ctx.db
          .select({
            review: cookingReviews,
            user: {
              id: user.id,
              name: user.name,
              image: user.image,
            },
          })
          .from(cookingReviews)
          .innerJoin(user, eq(cookingReviews.userId, user.id))
          .where(conditions)
          .orderBy(desc(cookingReviews.id))
          .limit(limit + 1);

        // Check if there's a next page
        const hasMore = results.length > limit;
        const items = hasMore ? results.slice(0, limit) : results;

        // Batch fetch all images in one query (fixes N+1)
        const reviewIds = items.map((item) => item.review.id);
        const allImages =
          reviewIds.length > 0
            ? await ctx.db
                .select({
                  reviewId: cookingReviewImages.reviewId,
                  url: cookingReviewImages.url,
                })
                .from(cookingReviewImages)
                .where(inArray(cookingReviewImages.reviewId, reviewIds))
                .orderBy(cookingReviewImages.reviewId, cookingReviewImages.index)
            : [];

        // Group images by reviewId
        const imagesByReview = new Map<number, typeof allImages>();
        for (const img of allImages) {
          const existing = imagesByReview.get(img.reviewId) ?? [];
          existing.push(img);
          imagesByReview.set(img.reviewId, existing);
        }

        // Map to results with images
        const reviewsWithImages = items.map((item) => ({
          id: item.review.id,
          rating: item.review.rating,
          reviewText: item.review.reviewText,
          images: (imagesByReview.get(item.review.id) ?? []).map(
            (img) => img.url
          ),
          createdAt: item.review.createdAt,
          user: item.user,
        }));

        const lastItem = items[items.length - 1];
        return {
          items: reviewsWithImages,
          nextCursor: hasMore && lastItem ? lastItem.review.id : null,
        };
      } catch {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch recipe reviews",
        });
      }
    }),

  // Get the average rating for a recipe
  getRecipeRating: authedProcedure
    .input(
      type({
        recipeId: "number",
      }),
    )
    .query(async ({ ctx, input }) => {
      const { recipeId } = input;

      try {
        const reviews = await ctx.db
          .select({ rating: cookingReviews.rating })
          .from(cookingReviews)
          .where(eq(cookingReviews.recipeId, recipeId));

        if (reviews.length === 0) {
          return { averageRating: null, reviewCount: 0 };
        }

        const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
        const averageRating = sum / reviews.length;

        return {
          averageRating: Math.round(averageRating * 10) / 10, // Round to 1 decimal
          reviewCount: reviews.length,
        };
      } catch {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch recipe rating",
        });
      }
    }),

  // Hydrate the user's feed from the database (useful for dev/seeding)
  hydrateFeed: authedProcedure.mutation(async ({ ctx }) => {
    try {
      const itemCount = await hydrateFeed(ctx.db, ctx.env, ctx.user.id);
      return { success: true, itemCount };
    } catch {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to hydrate feed",
      });
    }
  }),

  // Get activities for a specific user (for profile pages)
  getUserActivities: authedProcedure
    .input(
      type({
        userId: "string",
        cursor: "number?",
        limit: "number = 20",
      }),
    )
    .query(async ({ ctx, input }) => {
      const { userId, cursor, limit } = input;

      try {
        // Build query conditions
        const conditions = cursor
          ? and(
              eq(activityEvents.userId, userId),
              lt(activityEvents.id, cursor),
            )
          : eq(activityEvents.userId, userId);

        // Fetch activity events for the user
        const activities = await ctx.db
          .select({ id: activityEvents.id })
          .from(activityEvents)
          .where(conditions)
          .orderBy(desc(activityEvents.createdAt))
          .limit(limit + 1);

        // Check if there's a next page
        const hasMore = activities.length > limit;
        const activitySlice = hasMore ? activities.slice(0, limit) : activities;

        // Hydrate activity IDs into full FeedItems
        const activityIds = activitySlice.map((a) => a.id);
        const items = await hydrateActivityIds(ctx.db, activityIds, ctx.user.id);

        // Get next cursor from the last item
        const lastActivity = activitySlice[activitySlice.length - 1];
        const nextCursor = hasMore && lastActivity ? lastActivity.id : null;

        return {
          items,
          nextCursor,
        };
      } catch {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch user activities",
        });
      }
    }),

  // Toggle like on an activity (like/unlike)
  toggleLike: authedProcedure
    .input(
      type({
        activityEventId: "number",
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { activityEventId } = input;

      try {
        // Check if activity exists and get owner
        const activity = await ctx.db
          .select({
            id: activityEvents.id,
            userId: activityEvents.userId,
            likeCount: activityEvents.likeCount,
          })
          .from(activityEvents)
          .where(eq(activityEvents.id, activityEventId))
          .then((rows) => rows[0]);

        if (!activity) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Activity not found",
          });
        }

        // Check if user already liked
        const existingLike = await ctx.db
          .select({ id: activityLikes.id })
          .from(activityLikes)
          .where(
            and(
              eq(activityLikes.userId, ctx.user.id),
              eq(activityLikes.activityEventId, activityEventId),
            ),
          )
          .then((rows) => rows[0]);

        if (existingLike) {
          // Unlike - delete the like and decrement count
          await ctx.db
            .delete(activityLikes)
            .where(eq(activityLikes.id, existingLike.id));

          const updated = await ctx.db
            .update(activityEvents)
            .set({ likeCount: sql`GREATEST(${activityEvents.likeCount} - 1, 0)` })
            .where(eq(activityEvents.id, activityEventId))
            .returning({ likeCount: activityEvents.likeCount });

          return {
            liked: false,
            likeCount: updated[0]?.likeCount ?? Math.max(activity.likeCount - 1, 0),
          };
        } else {
          // Like - insert new like and increment count
          await ctx.db.insert(activityLikes).values({
            userId: ctx.user.id,
            activityEventId,
          });

          const updated = await ctx.db
            .update(activityEvents)
            .set({ likeCount: sql`${activityEvents.likeCount} + 1` })
            .where(eq(activityEvents.id, activityEventId))
            .returning({ likeCount: activityEvents.likeCount });

          // Create notification for the activity owner
          createNotification(ctx.db, {
            recipientId: activity.userId,
            actorId: ctx.user.id,
            type: "activity_like",
            activityEventId,
          }).catch((err) => {
            console.error("Error creating like notification:", err);
          });

          return {
            liked: true,
            likeCount: updated[0]?.likeCount ?? activity.likeCount + 1,
          };
        }
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to toggle like",
        });
      }
    }),
});
