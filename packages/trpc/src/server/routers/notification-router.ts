import {
  getNotifications,
  getUnreadCount,
  markAsRead,
} from "@repo/db/services";
import { TRPCError } from "@trpc/server";
import { type } from "arktype";

import { router, authedProcedure } from "../trpc";

export const notificationRouter = router({
  // Get paginated notifications
  getNotifications: authedProcedure
    .input(
      type({
        "cursor?": "number",
        "limit?": "number",
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const params: {
          userId: string;
          cursor?: number;
          limit?: number;
        } = {
          userId: ctx.user.id,
          limit: input.limit ?? 20,
        };
        if (input.cursor !== undefined) {
          params.cursor = input.cursor;
        }
        return await getNotifications(ctx.db, params);
      } catch (err) {
        console.error("Error fetching notifications:", err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch notifications",
        });
      }
    }),

  // Get unread notification count
  getUnreadCount: authedProcedure.query(async ({ ctx }) => {
    try {
      const count = await getUnreadCount(ctx.db, ctx.user.id);
      return { count };
    } catch (err) {
      console.error("Error fetching unread count:", err);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch unread count",
      });
    }
  }),

  // Mark notifications as read
  markAsRead: authedProcedure
    .input(
      type({
        "notificationIds?": "number[]",
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const params: {
          userId: string;
          notificationIds?: number[];
        } = {
          userId: ctx.user.id,
        };
        if (input.notificationIds !== undefined) {
          params.notificationIds = input.notificationIds;
        }
        return await markAsRead(ctx.db, params);
      } catch (err) {
        console.error("Error marking notifications as read:", err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to mark notifications as read",
        });
      }
    }),
});
