import type { DbType } from "@repo/db";
import { user, userTagPreferences } from "@repo/db/schemas";
import { type } from "arktype";
import { eq, and } from "drizzle-orm";

import { router, authedProcedure } from "../trpc";

const UpdateProfileValidator = type({
  "name?": "string",
  "bio?": "string | null",
  "image?": "string | null",
});

const UploadAvatarValidator = type({
  imageKey: "string",
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

// Helper to sync preferences for a given type (works with db or transaction)
async function syncPreferences(
  tx: DbType,
  userId: string,
  tagIds: number[],
  preferenceType: string
) {
  // Delete existing preferences of this type
  await tx
    .delete(userTagPreferences)
    .where(
      and(
        eq(userTagPreferences.userId, userId),
        eq(userTagPreferences.preferenceType, preferenceType)
      )
    );

  // Insert new preferences
  if (tagIds.length > 0) {
    await tx.insert(userTagPreferences).values(
      tagIds.map((tagId) => ({
        userId,
        tagId,
        preferenceType,
      }))
    );
  }
}

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
      return await ctx.db.transaction(async (tx) => {
        // Update user profile
        const [updatedUser] = await tx
          .update(user)
          .set({
            ...(input.name !== undefined && { name: input.name }),
            ...(input.bio !== undefined && { bio: input.bio }),
            ...(input.image !== undefined && { image: input.image }),
            onboardingCompleted: true,
            updatedAt: new Date(),
          })
          .where(eq(user.id, ctx.user.id))
          .returning();

        // Sync all preferences to the junction table
        await Promise.all([
          syncPreferences(tx, ctx.user.id, input.cuisineLikes, "cuisine_like"),
          syncPreferences(tx, ctx.user.id, input.cuisineDislikes, "cuisine_dislike"),
          syncPreferences(tx, ctx.user.id, input.ingredientLikes, "ingredient_like"),
          syncPreferences(tx, ctx.user.id, input.ingredientDislikes, "ingredient_dislike"),
          syncPreferences(tx, ctx.user.id, input.dietaryRequirements, "dietary"),
        ]);

        return { user: updatedUser };
      });
    }),

  updatePreferences: authedProcedure
    .input(UpdatePreferencesValidator)
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.transaction(async (tx) => {
        // Update user's updatedAt timestamp
        const [updatedUser] = await tx
          .update(user)
          .set({ updatedAt: new Date() })
          .where(eq(user.id, ctx.user.id))
          .returning();

        // Sync only the preferences that were provided
        const syncPromises: Promise<void>[] = [];

        if (input.cuisineLikes !== undefined) {
          syncPromises.push(
            syncPreferences(tx, ctx.user.id, input.cuisineLikes, "cuisine_like")
          );
        }
        if (input.cuisineDislikes !== undefined) {
          syncPromises.push(
            syncPreferences(tx, ctx.user.id, input.cuisineDislikes, "cuisine_dislike")
          );
        }
        if (input.ingredientLikes !== undefined) {
          syncPromises.push(
            syncPreferences(tx, ctx.user.id, input.ingredientLikes, "ingredient_like")
          );
        }
        if (input.ingredientDislikes !== undefined) {
          syncPromises.push(
            syncPreferences(tx, ctx.user.id, input.ingredientDislikes, "ingredient_dislike")
          );
        }
        if (input.dietaryRequirements !== undefined) {
          syncPromises.push(
            syncPreferences(tx, ctx.user.id, input.dietaryRequirements, "dietary")
          );
        }

        await Promise.all(syncPromises);

        return { user: updatedUser };
      });
    }),

  /**
   * Upload a new avatar image.
   * Moves the image from temp storage to permanent avatar location.
   */
  uploadAvatar: authedProcedure
    .input(UploadAvatarValidator)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      const ext = input.imageKey.split(".").pop() || "jpg";
      const destinationKey = `avatars/${userId}.${ext}`;

      // Move from temp to permanent location
      await ctx.env.IMAGE_WORKER.move([
        {
          from: input.imageKey,
          to: destinationKey,
        },
      ]);

      // Construct public URL
      const imageUrl = `${ctx.env.IMAGE_PUBLIC_URL}/${destinationKey}`;

      // Update user record
      const [updatedUser] = await ctx.db
        .update(user)
        .set({ image: imageUrl, updatedAt: new Date() })
        .where(eq(user.id, userId))
        .returning();

      return { user: updatedUser };
    }),
});
