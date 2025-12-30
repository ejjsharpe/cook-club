import { user } from "@repo/db/schemas";
import { type } from "arktype";
import { eq } from "drizzle-orm";

import { router, authedProcedure } from "../trpc";

const UpdateProfileValidator = type({
  "name?": "string",
  "bio?": "string | null",
  "image?": "string | null",
});

const CompleteOnboardingValidator = type({
  "name?": "string",
  "bio?": "string | null",
  "image?": "string | null",
  cuisineLikes: "number[]",
  cuisineDislikes: "number[]",
  ingredientLikes: "number[]",
  ingredientDislikes: "number[]",
  dietaryRequirements: "number[]",
});

const UpdatePreferencesValidator = type({
  "cuisineLikes?": "number[]",
  "cuisineDislikes?": "number[]",
  "ingredientLikes?": "number[]",
  "ingredientDislikes?": "number[]",
  "dietaryRequirements?": "number[]",
});

export const userRouter = router({
  getUser: authedProcedure.query(async ({ ctx }) => {
    // Fetch full user from database to get all fields including onboardingCompleted
    const [dbUser] = await ctx.db
      .select()
      .from(user)
      .where(eq(user.id, ctx.user.id))
      .limit(1);

    return {
      user: dbUser ?? null,
    };
  }),

  updateProfile: authedProcedure
    .input(UpdateProfileValidator)
    .mutation(async ({ ctx, input }) => {
      const [updatedUser] = await ctx.db
        .update(user)
        .set({
          ...(input.name !== undefined && { name: input.name }),
          ...(input.bio !== undefined && { bio: input.bio }),
          ...(input.image !== undefined && { image: input.image }),
          updatedAt: new Date(),
        })
        .where(eq(user.id, ctx.user.id))
        .returning();

      return { user: updatedUser };
    }),

  completeOnboarding: authedProcedure
    .input(CompleteOnboardingValidator)
    .mutation(async ({ ctx, input }) => {
      const [updatedUser] = await ctx.db
        .update(user)
        .set({
          ...(input.name !== undefined && { name: input.name }),
          ...(input.bio !== undefined && { bio: input.bio }),
          ...(input.image !== undefined && { image: input.image }),
          cuisineLikes: input.cuisineLikes,
          cuisineDislikes: input.cuisineDislikes,
          ingredientLikes: input.ingredientLikes,
          ingredientDislikes: input.ingredientDislikes,
          dietaryRequirements: input.dietaryRequirements,
          onboardingCompleted: true,
          updatedAt: new Date(),
        })
        .where(eq(user.id, ctx.user.id))
        .returning();

      return { user: updatedUser };
    }),

  updatePreferences: authedProcedure
    .input(UpdatePreferencesValidator)
    .mutation(async ({ ctx, input }) => {
      const [updatedUser] = await ctx.db
        .update(user)
        .set({
          ...(input.cuisineLikes !== undefined && {
            cuisineLikes: input.cuisineLikes,
          }),
          ...(input.cuisineDislikes !== undefined && {
            cuisineDislikes: input.cuisineDislikes,
          }),
          ...(input.ingredientLikes !== undefined && {
            ingredientLikes: input.ingredientLikes,
          }),
          ...(input.ingredientDislikes !== undefined && {
            ingredientDislikes: input.ingredientDislikes,
          }),
          ...(input.dietaryRequirements !== undefined && {
            dietaryRequirements: input.dietaryRequirements,
          }),
          updatedAt: new Date(),
        })
        .where(eq(user.id, ctx.user.id))
        .returning();

      return { user: updatedUser };
    }),
});
