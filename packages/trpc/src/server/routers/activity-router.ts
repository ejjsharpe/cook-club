import {
  activityEvents,
  cookingReviews,
  cookingReviewImages,
  recipes,
  user,
} from "@repo/db/schemas";
import { TRPCError } from "@trpc/server";
import { type } from "arktype";
import { eq, desc, lt, and } from "drizzle-orm";

import {
  propagateActivityToFollowers,
  hydrateFeed,
  buildFeedItem,
} from "../services/activity/activity-propagation.service";
import { router, authedProcedure } from "../trpc";
import type { GetFeedResponse } from "../types/feed";

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

        const url = new URL("http://do/getFeed");
        if (cursor) url.searchParams.set("cursor", cursor);
        url.searchParams.set("limit", limit.toString());

        const response = await feedDO.fetch(new Request(url.toString()));
        let result = (await response.json()) as GetFeedResponse;

        // Auto-hydrate feed if empty and no cursor (first page request)
        if (result.items.length === 0 && !cursor) {
          await hydrateFeed(ctx.db, ctx.env, ctx.user.id);
          // Re-fetch after hydration
          const hydratedResponse = await feedDO.fetch(
            new Request(url.toString()),
          );
          result = (await hydratedResponse.json()) as GetFeedResponse;
        }

        return {
          items: result.items,
          nextCursor: result.nextCursor,
        };
      } catch (err) {
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
        // Build base query with cursor support
        const baseQuery = ctx.db
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
          .where(eq(cookingReviews.recipeId, recipeId))
          .orderBy(desc(cookingReviews.createdAt))
          .limit(limit + 1);

        const results = await baseQuery;

        // If cursor is provided, filter results (simple approach)
        let filteredResults = results;
        if (cursor) {
          const cursorIndex = results.findIndex((r) => r.review.id === cursor);
          if (cursorIndex !== -1) {
            filteredResults = results.slice(cursorIndex + 1);
          }
        }

        // Check if there's a next page
        const hasMore = filteredResults.length > limit;
        const items = hasMore
          ? filteredResults.slice(0, limit)
          : filteredResults;

        // Fetch images for each review
        const reviewsWithImages = await Promise.all(
          items.map(async (item) => {
            const images = await ctx.db
              .select({ url: cookingReviewImages.url })
              .from(cookingReviewImages)
              .where(eq(cookingReviewImages.reviewId, item.review.id))
              .orderBy(cookingReviewImages.index);

            return {
              id: item.review.id,
              rating: item.review.rating,
              reviewText: item.review.reviewText,
              images: images.map((img) => img.url),
              createdAt: item.review.createdAt,
              user: item.user,
            };
          }),
        );

        const lastItem = items[items.length - 1];
        return {
          items: reviewsWithImages,
          nextCursor: hasMore && lastItem ? lastItem.review.id : null,
        };
      } catch (err) {
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
      } catch (err) {
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
    } catch (err) {
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

        // Build feed items for each activity
        const items = [];
        for (const activity of activitySlice) {
          const feedItem = await buildFeedItem(ctx.db, activity.id);
          if (feedItem) {
            items.push(feedItem);
          }
        }

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
});
