import { follows, user } from "@repo/db/schemas";
import { TRPCError } from "@trpc/server";
import { type } from "arktype";
import { eq, and, or, ne, like } from "drizzle-orm";

import { router, authedProcedure } from "../trpc";

export const followsRouter = router({
  // Follow a user
  followUser: authedProcedure
    .input(
      type({
        userId: "string",
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { userId } = input;

      if (userId === ctx.user.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot follow yourself",
        });
      }

      try {
        // Check if already following
        const existingFollow = await ctx.db
          .select()
          .from(follows)
          .where(
            and(
              eq(follows.followerId, ctx.user.id),
              eq(follows.followingId, userId)
            )
          )
          .then((rows) => rows[0]);

        if (existingFollow) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Already following this user",
          });
        }

        // Check if target user exists
        const targetUser = await ctx.db
          .select({ id: user.id })
          .from(user)
          .where(eq(user.id, userId))
          .then((rows) => rows[0]);

        if (!targetUser) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "User not found",
          });
        }

        // Create follow relationship
        const follow = await ctx.db
          .insert(follows)
          .values({
            followerId: ctx.user.id,
            followingId: userId,
            createdAt: new Date(),
          })
          .returning()
          .then((rows) => rows[0]);

        return follow;
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to follow user",
        });
      }
    }),

  // Unfollow a user
  unfollowUser: authedProcedure
    .input(
      type({
        userId: "string",
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { userId } = input;

      try {
        const follow = await ctx.db
          .select()
          .from(follows)
          .where(
            and(
              eq(follows.followerId, ctx.user.id),
              eq(follows.followingId, userId)
            )
          )
          .then((rows) => rows[0]);

        if (!follow) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Not following this user",
          });
        }

        await ctx.db.delete(follows).where(eq(follows.id, follow.id));

        return { success: true };
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to unfollow user",
        });
      }
    }),

  // Get users I'm following
  getFollowing: authedProcedure.query(async ({ ctx }) => {
    try {
      const followingList = await ctx.db
        .select({
          follow: follows,
          user: user,
        })
        .from(follows)
        .innerJoin(user, eq(follows.followingId, user.id))
        .where(eq(follows.followerId, ctx.user.id));

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
        message: "Failed to fetch following list",
      });
    }
  }),

  // Get my followers
  getFollowers: authedProcedure.query(async ({ ctx }) => {
    try {
      const followersList = await ctx.db
        .select({
          follow: follows,
          user: user,
        })
        .from(follows)
        .innerJoin(user, eq(follows.followerId, user.id))
        .where(eq(follows.followingId, ctx.user.id));

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
      })
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
              or(like(user.name, `%${query}%`), like(user.email, `%${query}%`))
            )
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
      })
    )
    .query(async ({ ctx, input }) => {
      const { userId } = input;

      try {
        // Get user info
        const targetUser = await ctx.db
          .select({
            id: user.id,
            name: user.name,
            email: user.email,
            image: user.image,
            createdAt: user.createdAt,
          })
          .from(user)
          .where(eq(user.id, userId))
          .then((rows) => rows[0]);

        if (!targetUser) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "User not found",
          });
        }

        // Check if I'm following this user
        const followRelation = await ctx.db
          .select()
          .from(follows)
          .where(
            and(
              eq(follows.followerId, ctx.user.id),
              eq(follows.followingId, userId)
            )
          )
          .then((rows) => rows[0]);

        // Check if they're following me
        const followsMe = await ctx.db
          .select()
          .from(follows)
          .where(
            and(
              eq(follows.followerId, userId),
              eq(follows.followingId, ctx.user.id)
            )
          )
          .then((rows) => rows[0]);

        // Get follower/following counts
        const [followersCount, followingCount] = await Promise.all([
          ctx.db
            .select({ count: follows.id })
            .from(follows)
            .where(eq(follows.followingId, userId)),
          ctx.db
            .select({ count: follows.id })
            .from(follows)
            .where(eq(follows.followerId, userId)),
        ]);

        return {
          user: targetUser,
          isFollowing: !!followRelation,
          followsMe: !!followsMe,
          followersCount: followersCount.length,
          followingCount: followingCount.length,
        };
      } catch (err) {
        console.log({ err });
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
      })
    )
    .query(async ({ ctx, input }) => {
      const { userId } = input;

      try {
        const followersList = await ctx.db
          .select({
            follow: follows,
            user: user,
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
      })
    )
    .query(async ({ ctx, input }) => {
      const { userId } = input;

      try {
        const followingList = await ctx.db
          .select({
            follow: follows,
            user: user,
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
