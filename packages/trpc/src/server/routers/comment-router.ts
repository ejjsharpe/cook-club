import { comments, user } from "@repo/db/schemas";
import { TRPCError } from "@trpc/server";
import { type } from "arktype";
import { eq, and, isNull, asc } from "drizzle-orm";

import { router, authedProcedure, publicProcedure } from "../trpc";

export const commentRouter = router({
  // Get all comments for an activity event
  getComments: publicProcedure
    .input(
      type({
        activityEventId: "number",
      }),
    )
    .query(async ({ ctx, input }) => {
      const { activityEventId } = input;

      try {
        // Fetch all comments with user info
        const allComments = await ctx.db
          .select({
            id: comments.id,
            content: comments.content,
            parentCommentId: comments.parentCommentId,
            createdAt: comments.createdAt,
            user: {
              id: user.id,
              name: user.name,
              image: user.image,
            },
          })
          .from(comments)
          .innerJoin(user, eq(comments.userId, user.id))
          .where(eq(comments.activityEventId, activityEventId))
          .orderBy(asc(comments.createdAt));

        // Group comments: top-level and replies
        const topLevelComments = allComments.filter(
          (c) => c.parentCommentId === null,
        );
        const replies = allComments.filter((c) => c.parentCommentId !== null);

        // Build nested structure
        const commentsWithReplies = topLevelComments.map((comment) => ({
          ...comment,
          replies: replies.filter((r) => r.parentCommentId === comment.id),
        }));

        return commentsWithReplies;
      } catch (err) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch comments",
        });
      }
    }),

  // Create a new comment
  createComment: authedProcedure
    .input(
      type({
        activityEventId: "number",
        "parentCommentId?": "number",
        content: "string",
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { activityEventId, parentCommentId, content } = input;

      if (content.trim().length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Comment cannot be empty",
        });
      }

      try {
        const now = new Date();

        const [newComment] = await ctx.db
          .insert(comments)
          .values({
            userId: ctx.user.id,
            activityEventId,
            parentCommentId: parentCommentId ?? null,
            content: content.trim(),
            createdAt: now,
            updatedAt: now,
          })
          .returning();

        return {
          ...newComment,
          user: {
            id: ctx.user.id,
            name: ctx.user.name,
            image: ctx.user.image,
          },
        };
      } catch (err) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create comment",
        });
      }
    }),

  // Delete a comment (only own comments)
  deleteComment: authedProcedure
    .input(
      type({
        commentId: "number",
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { commentId } = input;

      try {
        // Check if comment exists and belongs to user
        const [comment] = await ctx.db
          .select()
          .from(comments)
          .where(eq(comments.id, commentId));

        if (!comment) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Comment not found",
          });
        }

        if (comment.userId !== ctx.user.id) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You can only delete your own comments",
          });
        }

        // Delete comment (cascades to replies)
        await ctx.db.delete(comments).where(eq(comments.id, commentId));

        return { success: true };
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete comment",
        });
      }
    }),
});
