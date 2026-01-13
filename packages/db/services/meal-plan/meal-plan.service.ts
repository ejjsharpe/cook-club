import {
  mealPlans,
  mealPlanEntries,
  mealPlanShares,
  recipes,
  recipeImages,
  follows,
  user,
} from "../../schemas";
import { eq, and, or, between, inArray } from "drizzle-orm";

import { ServiceError } from "../errors";
import type { DbClient } from "../types";

// ─── Types ─────────────────────────────────────────────────────────────────

export type MealType = "breakfast" | "lunch" | "dinner";

export interface MealPlanWithMeta {
  id: number;
  name: string;
  isDefault: boolean;
  isOwner: boolean;
  canEdit: boolean;
  owner: {
    id: string;
    name: string;
    image: string | null;
  };
  createdAt: Date;
}

export interface MealPlanEntry {
  id: number;
  date: string;
  mealType: MealType;
  recipeId: number;
  recipeName: string;
  recipeImageUrl: string | null;
}

// ─── Meal Plan Operations ─────────────────────────────────────────────────

/**
 * Get or create the default meal plan for a user.
 * Handles race conditions gracefully using onConflictDoNothing.
 */
export async function getOrCreateDefaultMealPlan(db: DbClient, userId: string) {
  // Look for default meal plan
  const defaultPlan = await db
    .select()
    .from(mealPlans)
    .where(and(eq(mealPlans.userId, userId), eq(mealPlans.isDefault, true)))
    .then((rows) => rows[0]);

  if (defaultPlan) {
    return defaultPlan;
  }

  // Try to create default meal plan with conflict handling for race conditions
  await db
    .insert(mealPlans)
    .values({
      userId,
      name: "My Meal Plan",
      isDefault: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .onConflictDoNothing();

  // Re-fetch to get final state (handles race condition where another request inserted)
  const finalPlan = await db
    .select()
    .from(mealPlans)
    .where(and(eq(mealPlans.userId, userId), eq(mealPlans.isDefault, true)))
    .then((rows) => rows[0]);

  return finalPlan!;
}

/**
 * Get all meal plans the user has access to (owned + shared with them)
 */
export async function getMealPlans(
  db: DbClient,
  userId: string
): Promise<MealPlanWithMeta[]> {
  // Get user's own plans
  const ownPlans = await db
    .select({
      id: mealPlans.id,
      name: mealPlans.name,
      isDefault: mealPlans.isDefault,
      createdAt: mealPlans.createdAt,
      ownerId: mealPlans.userId,
      ownerName: user.name,
      ownerImage: user.image,
    })
    .from(mealPlans)
    .innerJoin(user, eq(mealPlans.userId, user.id))
    .where(eq(mealPlans.userId, userId));

  // Get plans shared with the user
  const sharedPlans = await db
    .select({
      id: mealPlans.id,
      name: mealPlans.name,
      isDefault: mealPlans.isDefault,
      createdAt: mealPlans.createdAt,
      ownerId: mealPlanShares.ownerUserId,
      ownerName: mealPlanShares.ownerName,
      ownerImage: mealPlanShares.ownerImage,
      canEdit: mealPlanShares.canEdit,
    })
    .from(mealPlanShares)
    .innerJoin(mealPlans, eq(mealPlanShares.mealPlanId, mealPlans.id))
    .where(eq(mealPlanShares.sharedWithUserId, userId));

  // Combine and format
  const result: MealPlanWithMeta[] = [
    ...ownPlans.map((plan) => ({
      id: plan.id,
      name: plan.name,
      isDefault: plan.isDefault,
      isOwner: true,
      canEdit: true,
      owner: {
        id: plan.ownerId,
        name: plan.ownerName,
        image: plan.ownerImage,
      },
      createdAt: plan.createdAt,
    })),
    ...sharedPlans.map((plan) => ({
      id: plan.id,
      name: plan.name,
      isDefault: plan.isDefault,
      isOwner: false,
      canEdit: plan.canEdit,
      owner: {
        id: plan.ownerId,
        name: plan.ownerName,
        image: plan.ownerImage,
      },
      createdAt: plan.createdAt,
    })),
  ];

  // Sort: default plan first, then by name
  result.sort((a, b) => {
    if (a.isDefault && a.isOwner) return -1;
    if (b.isDefault && b.isOwner) return 1;
    return a.name.localeCompare(b.name);
  });

  return result;
}

/**
 * Create a new meal plan
 */
export async function createMealPlan(
  db: DbClient,
  params: { userId: string; name: string }
): Promise<typeof mealPlans.$inferSelect> {
  const { userId, name } = params;

  const newPlan = await db
    .insert(mealPlans)
    .values({
      userId,
      name,
      isDefault: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning()
    .then((rows) => rows[0]);

  return newPlan!;
}

/**
 * Delete a meal plan (owner only, not default)
 */
export async function deleteMealPlan(
  db: DbClient,
  params: { userId: string; mealPlanId: number }
): Promise<{ success: boolean }> {
  const { userId, mealPlanId } = params;

  // Verify plan exists and belongs to user
  const plan = await db
    .select()
    .from(mealPlans)
    .where(and(eq(mealPlans.id, mealPlanId), eq(mealPlans.userId, userId)))
    .then((rows) => rows[0]);

  if (!plan) {
    throw new ServiceError("NOT_FOUND", "Meal plan not found");
  }

  if (plan.isDefault) {
    throw new ServiceError("BAD_REQUEST", "Cannot delete your default meal plan");
  }

  await db.delete(mealPlans).where(eq(mealPlans.id, mealPlanId));

  return { success: true };
}

// ─── Access Control ─────────────────────────────────────────────────────────

/**
 * Check if user can access a meal plan (owner or shared with them)
 */
export async function canUserAccessMealPlan(
  db: DbClient,
  userId: string,
  mealPlanId: number
): Promise<boolean> {
  // Check if owner
  const ownPlan = await db
    .select({ id: mealPlans.id })
    .from(mealPlans)
    .where(and(eq(mealPlans.id, mealPlanId), eq(mealPlans.userId, userId)))
    .then((rows) => rows[0]);

  if (ownPlan) return true;

  // Check if shared
  const shared = await db
    .select({ id: mealPlanShares.id })
    .from(mealPlanShares)
    .where(
      and(
        eq(mealPlanShares.mealPlanId, mealPlanId),
        eq(mealPlanShares.sharedWithUserId, userId)
      )
    )
    .then((rows) => rows[0]);

  return !!shared;
}

/**
 * Check if user can edit a meal plan (owner or shared with canEdit=true)
 */
export async function canUserEditMealPlan(
  db: DbClient,
  userId: string,
  mealPlanId: number
): Promise<boolean> {
  // Check if owner
  const ownPlan = await db
    .select({ id: mealPlans.id })
    .from(mealPlans)
    .where(and(eq(mealPlans.id, mealPlanId), eq(mealPlans.userId, userId)))
    .then((rows) => rows[0]);

  if (ownPlan) return true;

  // Check if shared with edit permission
  const shared = await db
    .select({ canEdit: mealPlanShares.canEdit })
    .from(mealPlanShares)
    .where(
      and(
        eq(mealPlanShares.mealPlanId, mealPlanId),
        eq(mealPlanShares.sharedWithUserId, userId)
      )
    )
    .then((rows) => rows[0]);

  return shared?.canEdit ?? false;
}

// ─── Entry Operations ─────────────────────────────────────────────────────

/**
 * Get entries for a meal plan within a date range
 */
export async function getMealPlanEntries(
  db: DbClient,
  params: {
    userId: string;
    mealPlanId: number;
    startDate: string;
    endDate: string;
  }
): Promise<MealPlanEntry[]> {
  const { userId, mealPlanId, startDate, endDate } = params;

  // Verify access
  const hasAccess = await canUserAccessMealPlan(db, userId, mealPlanId);
  if (!hasAccess) {
    throw new ServiceError("FORBIDDEN", "You do not have access to this meal plan");
  }

  const entries = await db
    .select({
      id: mealPlanEntries.id,
      date: mealPlanEntries.date,
      mealType: mealPlanEntries.mealType,
      recipeId: mealPlanEntries.recipeId,
      recipeName: mealPlanEntries.recipeName,
      recipeImageUrl: mealPlanEntries.recipeImageUrl,
    })
    .from(mealPlanEntries)
    .where(
      and(
        eq(mealPlanEntries.mealPlanId, mealPlanId),
        between(mealPlanEntries.date, startDate, endDate)
      )
    );

  return entries.map((entry) => ({
    ...entry,
    mealType: entry.mealType as MealType,
  }));
}

/**
 * Add a recipe to a meal slot
 */
export async function addRecipeToMealPlan(
  db: DbClient,
  params: {
    userId: string;
    mealPlanId: number;
    recipeId: number;
    date: string;
    mealType: MealType;
  }
) {
  const { userId, mealPlanId, recipeId, date, mealType } = params;

  // Verify edit access
  const canEdit = await canUserEditMealPlan(db, userId, mealPlanId);
  if (!canEdit) {
    throw new ServiceError(
      "FORBIDDEN",
      "You do not have permission to edit this meal plan"
    );
  }

  // Verify recipe exists and belongs to user's library
  const recipe = await db
    .select({
      id: recipes.id,
      name: recipes.name,
      ownerId: recipes.ownerId,
    })
    .from(recipes)
    .where(eq(recipes.id, recipeId))
    .then((rows) => rows[0]);

  if (!recipe) {
    throw new ServiceError("NOT_FOUND", "Recipe not found");
  }

  if (recipe.ownerId !== userId) {
    throw new ServiceError(
      "FORBIDDEN",
      "You can only add recipes from your own library"
    );
  }

  // Get first image for caching
  const firstImage = await db
    .select({ url: recipeImages.url })
    .from(recipeImages)
    .where(eq(recipeImages.recipeId, recipeId))
    .limit(1)
    .then((rows) => rows[0]);

  // Delete existing entry for this slot if any (replace behavior)
  await db
    .delete(mealPlanEntries)
    .where(
      and(
        eq(mealPlanEntries.mealPlanId, mealPlanId),
        eq(mealPlanEntries.date, date),
        eq(mealPlanEntries.mealType, mealType)
      )
    );

  // Insert new entry
  const entry = await db
    .insert(mealPlanEntries)
    .values({
      mealPlanId,
      date,
      mealType,
      recipeId,
      recipeName: recipe.name,
      recipeImageUrl: firstImage?.url ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning()
    .then((rows) => rows[0]);

  return entry!;
}

/**
 * Remove an entry from meal plan
 */
export async function removeFromMealPlan(
  db: DbClient,
  params: { userId: string; entryId: number }
): Promise<{ success: boolean }> {
  const { userId, entryId } = params;

  // Get entry and verify access
  const entry = await db
    .select({
      id: mealPlanEntries.id,
      mealPlanId: mealPlanEntries.mealPlanId,
    })
    .from(mealPlanEntries)
    .where(eq(mealPlanEntries.id, entryId))
    .then((rows) => rows[0]);

  if (!entry) {
    throw new ServiceError("NOT_FOUND", "Entry not found");
  }

  const canEdit = await canUserEditMealPlan(db, userId, entry.mealPlanId);
  if (!canEdit) {
    throw new ServiceError(
      "FORBIDDEN",
      "You do not have permission to edit this meal plan"
    );
  }

  await db.delete(mealPlanEntries).where(eq(mealPlanEntries.id, entryId));

  return { success: true };
}

/**
 * Move an entry to a different slot
 */
export async function moveEntry(
  db: DbClient,
  params: {
    userId: string;
    entryId: number;
    newDate: string;
    newMealType: MealType;
  }
): Promise<typeof mealPlanEntries.$inferSelect> {
  const { userId, entryId, newDate, newMealType } = params;

  // Get entry and verify access
  const entry = await db
    .select()
    .from(mealPlanEntries)
    .where(eq(mealPlanEntries.id, entryId))
    .then((rows) => rows[0]);

  if (!entry) {
    throw new ServiceError("NOT_FOUND", "Entry not found");
  }

  const canEdit = await canUserEditMealPlan(db, userId, entry.mealPlanId);
  if (!canEdit) {
    throw new ServiceError(
      "FORBIDDEN",
      "You do not have permission to edit this meal plan"
    );
  }

  // Delete any existing entry at the target slot
  await db
    .delete(mealPlanEntries)
    .where(
      and(
        eq(mealPlanEntries.mealPlanId, entry.mealPlanId),
        eq(mealPlanEntries.date, newDate),
        eq(mealPlanEntries.mealType, newMealType)
      )
    );

  // Update the entry
  const updated = await db
    .update(mealPlanEntries)
    .set({
      date: newDate,
      mealType: newMealType,
      updatedAt: new Date(),
    })
    .where(eq(mealPlanEntries.id, entryId))
    .returning()
    .then((rows) => rows[0]);

  return updated!;
}

// ─── Sharing Operations ─────────────────────────────────────────────────────

/**
 * Get users the current user can share with (friends only)
 */
export async function getShareableUsers(db: DbClient, userId: string) {
  // Get users with any follow relationship (either direction)
  const friendIds = await db
    .select({
      userId: follows.followingId,
    })
    .from(follows)
    .where(eq(follows.followerId, userId))
    .union(
      db
        .select({
          userId: follows.followerId,
        })
        .from(follows)
        .where(eq(follows.followingId, userId))
    );

  const uniqueFriendIds = Array.from(new Set(friendIds.map((f) => f.userId)));

  if (uniqueFriendIds.length === 0) {
    return [];
  }

  // Get user details
  const friends = await db
    .select({
      id: user.id,
      name: user.name,
      image: user.image,
    })
    .from(user)
    .where(inArray(user.id, uniqueFriendIds));

  return friends;
}

/**
 * Share a meal plan with a friend
 */
export async function shareMealPlan(
  db: DbClient,
  params: {
    userId: string;
    mealPlanId: number;
    sharedWithUserId: string;
    canEdit: boolean;
  }
) {
  const { userId, mealPlanId, sharedWithUserId, canEdit } = params;

  // Verify ownership
  const plan = await db
    .select({
      id: mealPlans.id,
      name: mealPlans.name,
    })
    .from(mealPlans)
    .where(and(eq(mealPlans.id, mealPlanId), eq(mealPlans.userId, userId)))
    .then((rows) => rows[0]);

  if (!plan) {
    throw new ServiceError(
      "NOT_FOUND",
      "Meal plan not found or you are not the owner"
    );
  }

  // Can't share with yourself
  if (sharedWithUserId === userId) {
    throw new ServiceError("BAD_REQUEST", "Cannot share with yourself");
  }

  // Verify target user is a friend
  const isFriend = await db
    .select({ id: follows.id })
    .from(follows)
    .where(
      or(
        and(
          eq(follows.followerId, userId),
          eq(follows.followingId, sharedWithUserId)
        ),
        and(
          eq(follows.followerId, sharedWithUserId),
          eq(follows.followingId, userId)
        )
      )
    )
    .then((rows) => rows[0]);

  if (!isFriend) {
    throw new ServiceError("BAD_REQUEST", "You can only share with friends");
  }

  // Get owner info for caching
  const owner = await db
    .select({
      id: user.id,
      name: user.name,
      image: user.image,
    })
    .from(user)
    .where(eq(user.id, userId))
    .then((rows) => rows[0]);

  // Check for existing share
  const existing = await db
    .select()
    .from(mealPlanShares)
    .where(
      and(
        eq(mealPlanShares.mealPlanId, mealPlanId),
        eq(mealPlanShares.sharedWithUserId, sharedWithUserId)
      )
    )
    .then((rows) => rows[0]);

  if (existing) {
    // Update existing share
    const updated = await db
      .update(mealPlanShares)
      .set({ canEdit })
      .where(eq(mealPlanShares.id, existing.id))
      .returning()
      .then((rows) => rows[0]);
    return updated!;
  }

  // Create new share
  const share = await db
    .insert(mealPlanShares)
    .values({
      mealPlanId,
      sharedWithUserId,
      canEdit,
      ownerUserId: userId,
      ownerName: owner!.name,
      ownerImage: owner!.image,
      createdAt: new Date(),
    })
    .returning()
    .then((rows) => rows[0]);

  return share!;
}

/**
 * Remove sharing with a user
 */
export async function unshareMealPlan(
  db: DbClient,
  params: {
    userId: string;
    mealPlanId: number;
    sharedWithUserId: string;
  }
): Promise<{ success: boolean }> {
  const { userId, mealPlanId, sharedWithUserId } = params;

  // Verify ownership
  const plan = await db
    .select({ id: mealPlans.id })
    .from(mealPlans)
    .where(and(eq(mealPlans.id, mealPlanId), eq(mealPlans.userId, userId)))
    .then((rows) => rows[0]);

  if (!plan) {
    throw new ServiceError(
      "NOT_FOUND",
      "Meal plan not found or you are not the owner"
    );
  }

  await db
    .delete(mealPlanShares)
    .where(
      and(
        eq(mealPlanShares.mealPlanId, mealPlanId),
        eq(mealPlanShares.sharedWithUserId, sharedWithUserId)
      )
    );

  return { success: true };
}

/**
 * Get share status for a meal plan
 */
export async function getShareStatus(
  db: DbClient,
  params: { userId: string; mealPlanId: number }
) {
  const { userId, mealPlanId } = params;

  // Verify ownership
  const plan = await db
    .select({ id: mealPlans.id })
    .from(mealPlans)
    .where(and(eq(mealPlans.id, mealPlanId), eq(mealPlans.userId, userId)))
    .then((rows) => rows[0]);

  if (!plan) {
    throw new ServiceError(
      "NOT_FOUND",
      "Meal plan not found or you are not the owner"
    );
  }

  // Get all shares
  const shares = await db
    .select({
      id: mealPlanShares.id,
      userId: mealPlanShares.sharedWithUserId,
      canEdit: mealPlanShares.canEdit,
      userName: user.name,
      userImage: user.image,
      createdAt: mealPlanShares.createdAt,
    })
    .from(mealPlanShares)
    .innerJoin(user, eq(mealPlanShares.sharedWithUserId, user.id))
    .where(eq(mealPlanShares.mealPlanId, mealPlanId));

  return shares;
}
