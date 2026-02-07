import {
  getOrCreateDefaultMealPlan,
  getMealPlans as getMealPlansService,
  createMealPlan as createMealPlanService,
  deleteMealPlan as deleteMealPlanService,
  getMealPlanEntries as getMealPlanEntriesService,
  addRecipeToMealPlan as addRecipeToMealPlanService,
  removeFromMealPlan as removeFromMealPlanService,
  moveEntry as moveEntryService,
  getShareableUsers as getShareableUsersService,
  inviteToMealPlan as inviteToMealPlanService,
  cancelMealPlanInvitation as cancelMealPlanInvitationService,
  acceptMealPlanInvitation as acceptMealPlanInvitationService,
  declineMealPlanInvitation as declineMealPlanInvitationService,
  removeMealPlanMember as removeMealPlanMemberService,
  getPendingMealPlanInvitations as getPendingMealPlanInvitationsService,
  getMealPlanInvitationStatus as getMealPlanInvitationStatusService,
  getShareStatus as getShareStatusService,
  createNotification,
} from "@repo/db/services";
import { TRPCError } from "@trpc/server";
import { type } from "arktype";

import { router, authedProcedure } from "../trpc";
import { mapServiceError } from "../utils";

const MealTypeValidator = type("'breakfast' | 'lunch' | 'dinner'");

export const mealPlanRouter = router({
  // Get all meal plans the user has access to (owned + shared)
  getMealPlans: authedProcedure.query(async ({ ctx }) => {
    try {
      // Ensure user has at least a default plan
      await getOrCreateDefaultMealPlan(ctx.db, ctx.user.id);
      return await getMealPlansService(ctx.db, ctx.user.id);
    } catch (err) {
      if (err instanceof TRPCError) throw err;
      console.error("Error fetching meal plans:", err);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch meal plans",
      });
    }
  }),

  // Create a new meal plan
  createMealPlan: authedProcedure
    .input(
      type({
        name: "string",
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await createMealPlanService(ctx.db, {
          userId: ctx.user.id,
          name: input.name,
        });
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        console.error("Error creating meal plan:", err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create meal plan",
        });
      }
    }),

  // Delete a meal plan
  deleteMealPlan: authedProcedure
    .input(
      type({
        mealPlanId: "number",
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await deleteMealPlanService(ctx.db, {
          userId: ctx.user.id,
          mealPlanId: input.mealPlanId,
        });
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        console.error("Error deleting meal plan:", err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete meal plan",
        });
      }
    }),

  // Get entries for a meal plan within a date range
  getEntries: authedProcedure
    .input(
      type({
        mealPlanId: "number",
        startDate: "string", // ISO date string YYYY-MM-DD
        endDate: "string", // ISO date string YYYY-MM-DD
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        return await getMealPlanEntriesService(ctx.db, {
          userId: ctx.user.id,
          mealPlanId: input.mealPlanId,
          startDate: input.startDate,
          endDate: input.endDate,
        });
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        console.error("Error fetching meal plan entries:", err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch meal plan entries",
        });
      }
    }),

  // Add a recipe to a meal slot
  addRecipe: authedProcedure
    .input(
      type({
        mealPlanId: "number",
        recipeId: "number",
        date: "string", // ISO date string YYYY-MM-DD
        mealType: MealTypeValidator,
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await addRecipeToMealPlanService(ctx.db, {
          userId: ctx.user.id,
          mealPlanId: input.mealPlanId,
          recipeId: input.recipeId,
          date: input.date,
          mealType: input.mealType,
        });
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        console.error("Error adding recipe to meal plan:", err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to add recipe to meal plan",
        });
      }
    }),

  // Remove an entry from meal plan
  removeEntry: authedProcedure
    .input(
      type({
        entryId: "number",
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await removeFromMealPlanService(ctx.db, {
          userId: ctx.user.id,
          entryId: input.entryId,
        });
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        console.error("Error removing meal plan entry:", err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to remove meal plan entry",
        });
      }
    }),

  // Move an entry to a different slot
  moveEntry: authedProcedure
    .input(
      type({
        entryId: "number",
        newDate: "string",
        newMealType: MealTypeValidator,
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await moveEntryService(ctx.db, {
          userId: ctx.user.id,
          entryId: input.entryId,
          newDate: input.newDate,
          newMealType: input.newMealType,
        });
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        console.error("Error moving meal plan entry:", err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to move meal plan entry",
        });
      }
    }),

  // Get users that can be shared with (friends only)
  getShareableUsers: authedProcedure.query(async ({ ctx }) => {
    try {
      return await getShareableUsersService(ctx.db, ctx.user.id);
    } catch (err) {
      if (err instanceof TRPCError) throw err;
      console.error("Error fetching shareable users:", err);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch shareable users",
      });
    }
  }),

  // Invite a friend to a meal plan
  inviteToMealPlan: authedProcedure
    .input(
      type({
        mealPlanId: "number",
        userId: "string",
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await inviteToMealPlanService(ctx.db, {
          userId: ctx.user.id,
          mealPlanId: input.mealPlanId,
          invitedUserId: input.userId,
        });

        // Create notification for the invited user
        createNotification(ctx.db, {
          recipientId: input.userId,
          actorId: ctx.user.id,
          type: "meal_plan_invite",
          mealPlanId: input.mealPlanId,
        }).catch((err) => {
          console.error("Error creating meal plan invite notification:", err);
        });

        return result;
      } catch (err) {
        throw mapServiceError(err);
      }
    }),

  // Cancel a pending invitation (owner only)
  cancelMealPlanInvitation: authedProcedure
    .input(
      type({
        mealPlanId: "number",
        userId: "string",
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await cancelMealPlanInvitationService(ctx.db, {
          userId: ctx.user.id,
          mealPlanId: input.mealPlanId,
          invitedUserId: input.userId,
        });
      } catch (err) {
        throw mapServiceError(err);
      }
    }),

  // Accept a meal plan invitation
  acceptMealPlanInvitation: authedProcedure
    .input(
      type({
        invitationId: "number",
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await acceptMealPlanInvitationService(ctx.db, {
          userId: ctx.user.id,
          invitationId: input.invitationId,
        });
      } catch (err) {
        throw mapServiceError(err);
      }
    }),

  // Decline a meal plan invitation
  declineMealPlanInvitation: authedProcedure
    .input(
      type({
        invitationId: "number",
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await declineMealPlanInvitationService(ctx.db, {
          userId: ctx.user.id,
          invitationId: input.invitationId,
        });
      } catch (err) {
        throw mapServiceError(err);
      }
    }),

  // Remove an accepted member from a meal plan (owner only)
  removeMealPlanMember: authedProcedure
    .input(
      type({
        mealPlanId: "number",
        userId: "string",
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await removeMealPlanMemberService(ctx.db, {
          userId: ctx.user.id,
          mealPlanId: input.mealPlanId,
          memberId: input.userId,
        });
      } catch (err) {
        throw mapServiceError(err);
      }
    }),

  // Get pending invitations for the current user
  getPendingMealPlanInvitations: authedProcedure.query(async ({ ctx }) => {
    try {
      return await getPendingMealPlanInvitationsService(ctx.db, ctx.user.id);
    } catch (err) {
      throw mapServiceError(err);
    }
  }),

  // Get invitation status for a meal plan (for share sheet)
  getMealPlanInvitationStatus: authedProcedure
    .input(
      type({
        mealPlanId: "number",
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        return await getMealPlanInvitationStatusService(ctx.db, {
          userId: ctx.user.id,
          mealPlanId: input.mealPlanId,
        });
      } catch (err) {
        throw mapServiceError(err);
      }
    }),

  // Get share status for a meal plan (accepted members)
  getShareStatus: authedProcedure
    .input(
      type({
        mealPlanId: "number",
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        return await getShareStatusService(ctx.db, {
          userId: ctx.user.id,
          mealPlanId: input.mealPlanId,
        });
      } catch (err) {
        throw mapServiceError(err);
      }
    }),
});
