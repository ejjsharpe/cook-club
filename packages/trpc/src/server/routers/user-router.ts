import { user } from "@repo/db/schemas";
import { type } from "arktype";
import { eq, and, ne } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

import { router, authedProcedure } from "../trpc";

const RESERVED_USERNAMES = [
  "admin",
  "support",
  "help",
  "cookclub",
  "cook_club",
  "system",
  "mod",
  "moderator",
  "official",
  "null",
  "undefined",
  "settings",
  "profile",
  "api",
];

const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;

const UpdateProfileValidator = type({
  "name?": "string",
  "username?": "string",
  "bio?": "string | null",
  "image?": "string | null",
  "measurementPreference?": "string",
});

const UploadAvatarValidator = type({
  imageKey: "string",
});

const CheckUsernameValidator = type({
  username: "string",
});

const CompleteOnboardingValidator = type({
  username: "string",
  "name?": "string",
  "bio?": "string | null",
  "image?": "string | null",
  "measurementPreference?": "string",
});

function validateUsername(username: string): { valid: boolean; reason: string | null } {
  if (!USERNAME_REGEX.test(username)) {
    if (username.length < 3) {
      return { valid: false, reason: "Username must be at least 3 characters" };
    }
    if (username.length > 20) {
      return { valid: false, reason: "Username must be 20 characters or less" };
    }
    return { valid: false, reason: "Only lowercase letters, numbers, and underscores" };
  }

  if (RESERVED_USERNAMES.includes(username)) {
    return { valid: false, reason: "This username is reserved" };
  }

  return { valid: true, reason: null };
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

  checkUsername: authedProcedure
    .input(CheckUsernameValidator)
    .query(async ({ ctx, input }) => {
      const { username } = input;

      const validation = validateUsername(username);
      if (!validation.valid) {
        return { available: false, reason: validation.reason };
      }

      // Check DB uniqueness (exclude current user in case they already own it)
      const [existing] = await ctx.db
        .select({ id: user.id })
        .from(user)
        .where(and(eq(user.username, username), ne(user.id, ctx.user.id)))
        .limit(1);

      if (existing) {
        return { available: false, reason: "Username is already taken" };
      }

      return { available: true, reason: null };
    }),

  updateProfile: authedProcedure
    .input(UpdateProfileValidator)
    .mutation(async ({ ctx, input }) => {
      // Validate username if provided
      if (input.username !== undefined) {
        const validation = validateUsername(input.username);
        if (!validation.valid) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: validation.reason ?? "Invalid username",
          });
        }

        const [existing] = await ctx.db
          .select({ id: user.id })
          .from(user)
          .where(and(eq(user.username, input.username), ne(user.id, ctx.user.id)))
          .limit(1);

        if (existing) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Username is already taken",
          });
        }
      }

      const [updatedUser] = await ctx.db
        .update(user)
        .set({
          ...(input.name !== undefined && { name: input.name }),
          ...(input.username !== undefined && { username: input.username }),
          ...(input.bio !== undefined && { bio: input.bio }),
          ...(input.image !== undefined && { image: input.image }),
          ...(input.measurementPreference !== undefined && {
            measurementPreference: input.measurementPreference,
          }),
          updatedAt: new Date(),
        })
        .where(eq(user.id, ctx.user.id))
        .returning();

      return { user: updatedUser };
    }),

  completeOnboarding: authedProcedure
    .input(CompleteOnboardingValidator)
    .mutation(async ({ ctx, input }) => {
      // Validate username
      const validation = validateUsername(input.username);
      if (!validation.valid) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: validation.reason ?? "Invalid username",
        });
      }

      // Check uniqueness
      const [existing] = await ctx.db
        .select({ id: user.id })
        .from(user)
        .where(and(eq(user.username, input.username), ne(user.id, ctx.user.id)))
        .limit(1);

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Username is already taken",
        });
      }

      const [updatedUser] = await ctx.db
        .update(user)
        .set({
          username: input.username,
          ...(input.name !== undefined && { name: input.name }),
          ...(input.bio !== undefined && { bio: input.bio }),
          ...(input.image !== undefined && { image: input.image }),
          ...(input.measurementPreference !== undefined && {
            measurementPreference: input.measurementPreference,
          }),
          onboardingCompleted: true,
          updatedAt: new Date(),
        })
        .where(eq(user.id, ctx.user.id))
        .returning();

      return { user: updatedUser };
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
