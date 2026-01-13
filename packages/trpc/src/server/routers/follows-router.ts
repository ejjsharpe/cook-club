import { follows, user } from "@repo/db/schemas";
import {
  followUser as followUserService,
  unfollowUser as unfollowUserService,
  getFollowList,
} from "@repo/db/services";
import { TRPCError } from "@trpc/server";
import { type } from "arktype";
import { eq, and, or, ne, like, sql } from "drizzle-orm";

import { router, authedProcedure } from "../trpc";
import { mapServiceError } from "../utils";
import {
  backfillFeedFromUser,
  removeUserFromFeed,
} from "../services/activity";

export const followsRouter = router({
  // Follow a user
  followUser: authedProcedure
    .input(
      type({
        userId: "string",
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await followUserService(
          ctx.db,
          ctx.user.id,
          input.userId,
        );

        // Backfill feed with recent activities from the followed user
        backfillFeedFromUser(
          ctx.db,
          ctx.env,
          ctx.user.id,
          input.userId,
          10,
        ).catch((err) => {
          console.error("Error backfilling feed:", err);
        });

        return result;
      } catch (err) {
        throw mapServiceError(err);
      }
    }),

  // Unfollow a user
  unfollowUser: authedProcedure
    .input(
      type({
        userId: "string",
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await unfollowUserService(
          ctx.db,
          ctx.user.id,
          input.userId,
        );

        // Remove unfollowed user's items from feed
        removeUserFromFeed(ctx.db, ctx.env, ctx.user.id, input.userId).catch(
          (err) => {
            console.error("Error removing user from feed:", err);
          },
        );

        return result;
      } catch (err) {
        throw mapServiceError(err);
      }
    }),

  // Get users I'm following
  getFollowing: authedProcedure.query(async ({ ctx }) => {
    try {
      return await getFollowList(ctx.db, {
        userId: ctx.user.id,
        type: "following",
      });
    } catch (err) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch following list",
      });
    }
  }),

  // Get my followers
  getFollowers: authedProcedure.query(async ({ ctx }) => {
    try {
      return await getFollowList(ctx.db, {
        userId: ctx.user.id,
        type: "followers",
      });
    } catch (err) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch followers list",
      });
    }
  }),

  // Search for users to follow
  searchUsers: authedProcedure
    .input(
      type({
        query: "string",
        limit: "number = 10",
      }),
    )
    .query(async ({ ctx, input }) => {
      const { query, limit } = input;

      if (query.length < 2) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Search query must be at least 2 characters",
        });
      }

      try {
        const users = await ctx.db
          .select({
            id: user.id,
            name: user.name,
            email: user.email,
            image: user.image,
          })
          .from(user)
          .where(
            and(
              ne(user.id, ctx.user.id), // Exclude current user
              or(like(user.name, `%${query}%`), like(user.email, `%${query}%`)),
            ),
          )
          .limit(limit);

        return users;
      } catch (err) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to search users",
        });
      }
    }),

  // Get user profile with follow status
  getUserProfile: authedProcedure
    .input(
      type({
        userId: "string",
      }),
    )
    .query(async ({ ctx, input }) => {
      const { userId } = input;
      const currentUserId = ctx.user.id;

      try {
        // Single query with subqueries for all profile data
        // Note: We use "user"."id" explicitly in subqueries because Drizzle's ${user.id}
        // emits just "id" which would resolve to the subquery's table (e.g., follows.id)
        const profileData = await ctx.db
          .select({
            id: user.id,
            name: user.name,
            email: user.email,
            image: user.image,
            createdAt: user.createdAt,
            followersCount: sql<number>`(
              SELECT COUNT(*)::int FROM follows WHERE following_id = "user"."id"
            )`,
            followingCount: sql<number>`(
              SELECT COUNT(*)::int FROM follows WHERE follower_id = "user"."id"
            )`,
            recipeCount: sql<number>`(
              SELECT COUNT(*)::int FROM recipes WHERE owner_id = "user"."id"
            )`,
            isFollowing: sql<boolean>`EXISTS(
              SELECT 1 FROM follows
              WHERE follower_id = ${currentUserId} AND following_id = "user"."id"
            )`,
            followsMe: sql<boolean>`EXISTS(
              SELECT 1 FROM follows
              WHERE follower_id = "user"."id" AND following_id = ${currentUserId}
            )`,
          })
          .from(user)
          .where(eq(user.id, userId))
          .then((rows) => rows[0]);

        if (!profileData) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "User not found",
          });
        }

        return {
          user: {
            id: profileData.id,
            name: profileData.name,
            email: profileData.email,
            image: profileData.image,
            createdAt: profileData.createdAt,
          },
          isFollowing: profileData.isFollowing,
          followsMe: profileData.followsMe,
          followersCount: profileData.followersCount,
          followingCount: profileData.followingCount,
          recipeCount: profileData.recipeCount,
        };
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch user profile",
        });
      }
    }),

  // Get a specific user's followers
  getUserFollowers: authedProcedure
    .input(
      type({
        userId: "string",
      }),
    )
    .query(async ({ ctx, input }) => {
      const { userId } = input;

      try {
        const followersList = await ctx.db
          .select({
            follow: follows,
            user,
          })
          .from(follows)
          .innerJoin(user, eq(follows.followerId, user.id))
          .where(eq(follows.followingId, userId));

        return followersList.map((item) => ({
          followId: item.follow.id,
          user: {
            id: item.user.id,
            name: item.user.name,
            email: item.user.email,
            image: item.user.image,
          },
          followedAt: item.follow.createdAt,
        }));
      } catch (err) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch user followers list",
        });
      }
    }),

  // Get a specific user's following
  getUserFollowing: authedProcedure
    .input(
      type({
        userId: "string",
      }),
    )
    .query(async ({ ctx, input }) => {
      const { userId } = input;

      try {
        const followingList = await ctx.db
          .select({
            follow: follows,
            user,
          })
          .from(follows)
          .innerJoin(user, eq(follows.followingId, user.id))
          .where(eq(follows.followerId, userId));

        return followingList.map((item) => ({
          followId: item.follow.id,
          user: {
            id: item.user.id,
            name: item.user.name,
            email: item.user.email,
            image: item.user.image,
          },
          followedAt: item.follow.createdAt,
        }));
      } catch (err) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch user following list",
        });
      }
    }),
});
