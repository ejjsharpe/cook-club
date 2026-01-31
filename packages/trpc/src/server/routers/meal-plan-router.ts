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
  shareMealPlan as shareMealPlanService,
  unshareMealPlan as unshareMealPlanService,
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

  // Share a meal plan with a friend
  shareMealPlan: authedProcedure
    .input(
      type({
        mealPlanId: "number",
        userId: "string",
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await shareMealPlanService(ctx.db, {
          userId: ctx.user.id,
          mealPlanId: input.mealPlanId,
          sharedWithUserId: input.userId,
        });

        // Create notification for the user receiving the share
        createNotification(ctx.db, {
          recipientId: input.userId,
          actorId: ctx.user.id,
          type: "meal_plan_share",
          mealPlanId: input.mealPlanId,
        }).catch((err) => {
          console.error("Error creating meal plan share notification:", err);
        });

        return result;
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        console.error("Error sharing meal plan:", err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to share meal plan",
        });
      }
    }),

  // Remove sharing with a user
  unshareMealPlan: authedProcedure
    .input(
      type({
        mealPlanId: "number",
        userId: "string",
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await unshareMealPlanService(ctx.db, {
          userId: ctx.user.id,
          mealPlanId: input.mealPlanId,
          sharedWithUserId: input.userId,
        });
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        console.error("Error unsharing meal plan:", err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to unshare meal plan",
        });
      }
    }),

  // Get share status for a meal plan
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
        if (err instanceof TRPCError) throw err;
        console.error("Error fetching share status:", err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch share status",
        });
      }
    }),
});
