import {
  shoppingLists,
  shoppingListItems,
  shoppingListInvitations,
  follows,
  user,
} from "../../schemas";
import { classifyIngredientAisle } from "@repo/shared";
import { eq, and, or, gt, inArray } from "drizzle-orm";
import { ServiceError } from "../errors";

import {
  parseIngredient,
  normalizeIngredientName,
  parseIngredients,
} from "../../utils/ingredientParser";
import { normalizeUnit } from "../../utils/unitNormalizer";
import type { DbClient, TransactionClient } from "../types";

// Re-export for convenience
export { parseIngredient, normalizeIngredientName, parseIngredients };

// ─── Types ─────────────────────────────────────────────────────────────────

export interface ShoppingListItem {
  ingredientName: string;
  displayName: string;
  quantity: number | null;
  unit: string | null;
  recipeIds: number[];
  recipeNames: string[];
  isChecked: boolean;
  itemIds: number[];
  aisle: string;
}

// ─── Database Helper Functions ─────────────────────────────────────────────

/**
 * Get or create a shopping list for a user
 * Ensures type safety by always returning a defined shopping list
 */
export async function getOrCreateShoppingList(db: DbClient, userId: string) {
  const existingList = await db
    .select()
    .from(shoppingLists)
    .where(eq(shoppingLists.userId, userId))
    .then((rows) => rows[0]);

  if (existingList) {
    return existingList;
  }

  const newList = await db
    .insert(shoppingLists)
    .values({
      userId,
      name: "Shopping List",
      isDefault: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  return newList[0]!;
}

/**
 * Insert a shopping list item for a specific recipe
 * NEW MODEL: Creates ONE row per recipe-ingredient combination
 * No aggregation at insert time - aggregation happens at query time
 */
export async function insertShoppingListItem(
  db: DbClient | TransactionClient,
  params: {
    shoppingListId: number;
    ingredientName: string;
    quantity: number | null;
    unit: string | null;
    displayName: string;
    sourceRecipeId?: number;
    sourceRecipeName?: string;
  },
) {
  const {
    shoppingListId,
    ingredientName,
    quantity,
    unit,
    displayName,
    sourceRecipeId,
    sourceRecipeName,
  } = params;

  const normalizedName = normalizeIngredientName(ingredientName);
  const normalizedUnit = normalizeUnit(unit); // Normalize units for better aggregation
  const aisle = classifyIngredientAisle(normalizedName); // Classify into supermarket aisle

  // Insert new item - one row per recipe
  const [newItem] = await db
    .insert(shoppingListItems)
    .values({
      shoppingListId,
      ingredientName: normalizedName,
      displayName,
      quantity: quantity?.toString() || null,
      unit: normalizedUnit,
      isChecked: false,
      sourceRecipeId: sourceRecipeId || null,
      sourceRecipeName: sourceRecipeName || null,
      aisle,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  return newItem!;
}

// ─── Ingredient Formatting Helper Functions ────────────────────────────────

/**
 * Format quantity for display
 */
export function formatQuantity(quantity: number | null): string {
  if (!quantity) return "";

  // Format quantity with up to 2 decimal places, removing trailing zeros
  return quantity % 1 === 0
    ? quantity.toString()
    : quantity.toFixed(2).replace(/\.?0+$/, "");
}

// ─── Access Control ─────────────────────────────────────────────────────────

const INVITATION_EXPIRY_DAYS = 7;

/**
 * Check if user can access a shopping list (owner or accepted member)
 */
export async function canUserAccessShoppingList(
  db: DbClient,
  userId: string,
  shoppingListId: number,
): Promise<boolean> {
  // Check if owner
  const ownList = await db
    .select({ id: shoppingLists.id })
    .from(shoppingLists)
    .where(and(eq(shoppingLists.id, shoppingListId), eq(shoppingLists.userId, userId)))
    .then((rows) => rows[0]);

  if (ownList) return true;

  // Check if accepted member
  const member = await db
    .select({ id: shoppingListInvitations.id })
    .from(shoppingListInvitations)
    .where(
      and(
        eq(shoppingListInvitations.shoppingListId, shoppingListId),
        eq(shoppingListInvitations.invitedUserId, userId),
        eq(shoppingListInvitations.status, "accepted"),
      ),
    )
    .then((rows) => rows[0]);

  return !!member;
}

/**
 * Check if user can edit a shopping list (same as access — all members can edit)
 */
export async function canUserEditShoppingList(
  db: DbClient,
  userId: string,
  shoppingListId: number,
): Promise<boolean> {
  return canUserAccessShoppingList(db, userId, shoppingListId);
}

// ─── Shopping List Retrieval ─────────────────────────────────────────────────

/**
 * Get all shopping lists the user has access to (owned + shared)
 */
export async function getShoppingLists(db: DbClient, userId: string) {
  // Own lists
  const ownLists = await db
    .select({
      id: shoppingLists.id,
      name: shoppingLists.name,
      isDefault: shoppingLists.isDefault,
      isOwner: shoppingLists.id, // placeholder — mapped below
      ownerId: shoppingLists.userId,
      ownerName: user.name,
      ownerImage: user.image,
      createdAt: shoppingLists.createdAt,
    })
    .from(shoppingLists)
    .innerJoin(user, eq(shoppingLists.userId, user.id))
    .where(eq(shoppingLists.userId, userId));

  // Shared lists (accepted invitations)
  const sharedLists = await db
    .select({
      id: shoppingLists.id,
      name: shoppingLists.name,
      isOwner: shoppingLists.id, // placeholder
      ownerId: shoppingListInvitations.invitedByUserId,
      ownerName: shoppingListInvitations.inviterName,
      ownerImage: shoppingListInvitations.inviterImage,
      createdAt: shoppingLists.createdAt,
    })
    .from(shoppingListInvitations)
    .innerJoin(shoppingLists, eq(shoppingListInvitations.shoppingListId, shoppingLists.id))
    .where(
      and(
        eq(shoppingListInvitations.invitedUserId, userId),
        eq(shoppingListInvitations.status, "accepted"),
      ),
    );

  return [
    ...ownLists.map((l) => ({
      id: l.id,
      name: l.name,
      isDefault: l.isDefault,
      isOwner: true as const,
      owner: { id: l.ownerId, name: l.ownerName, image: l.ownerImage },
      createdAt: l.createdAt,
    })),
    ...sharedLists.map((l) => ({
      id: l.id,
      name: l.name,
      isDefault: false as const,
      isOwner: false as const,
      owner: { id: l.ownerId, name: l.ownerName, image: l.ownerImage },
      createdAt: l.createdAt,
    })),
  ];
}

// ─── Shopping List Invitation Operations ─────────────────────────────────────

/**
 * Get users the current user can invite (friends only)
 */
export async function getShoppingListShareableUsers(db: DbClient, userId: string) {
  const friendIds = await db
    .select({ userId: follows.followingId })
    .from(follows)
    .where(eq(follows.followerId, userId))
    .union(
      db
        .select({ userId: follows.followerId })
        .from(follows)
        .where(eq(follows.followingId, userId)),
    );

  const uniqueFriendIds = Array.from(new Set(friendIds.map((f) => f.userId)));
  if (uniqueFriendIds.length === 0) return [];

  return db
    .select({ id: user.id, name: user.name, image: user.image })
    .from(user)
    .where(inArray(user.id, uniqueFriendIds));
}

/**
 * Invite a friend to a shopping list
 */
export async function inviteToShoppingList(
  db: DbClient,
  params: {
    userId: string;
    shoppingListId: number;
    invitedUserId: string;
  },
) {
  const { userId, shoppingListId, invitedUserId } = params;

  // Verify ownership
  const list = await db
    .select({ id: shoppingLists.id, name: shoppingLists.name, isDefault: shoppingLists.isDefault })
    .from(shoppingLists)
    .where(and(eq(shoppingLists.id, shoppingListId), eq(shoppingLists.userId, userId)))
    .then((rows) => rows[0]);

  if (!list) {
    throw new ServiceError("NOT_FOUND", "Shopping list not found or you are not the owner");
  }

  if (list.isDefault) {
    throw new ServiceError("BAD_REQUEST", "Cannot share your default shopping list");
  }

  if (invitedUserId === userId) {
    throw new ServiceError("BAD_REQUEST", "Cannot invite yourself");
  }

  // Verify friendship
  const isFriend = await db
    .select({ id: follows.id })
    .from(follows)
    .where(
      or(
        and(eq(follows.followerId, userId), eq(follows.followingId, invitedUserId)),
        and(eq(follows.followerId, invitedUserId), eq(follows.followingId, userId)),
      ),
    )
    .then((rows) => rows[0]);

  if (!isFriend) {
    throw new ServiceError("BAD_REQUEST", "You can only invite friends");
  }

  // Check existing invitation
  const existing = await db
    .select()
    .from(shoppingListInvitations)
    .where(
      and(
        eq(shoppingListInvitations.shoppingListId, shoppingListId),
        eq(shoppingListInvitations.invitedUserId, invitedUserId),
      ),
    )
    .then((rows) => rows[0]);

  if (existing) {
    if (existing.status === "accepted") {
      throw new ServiceError("CONFLICT", "User already has access to this shopping list");
    }
    const expiresAt = new Date(existing.createdAt);
    expiresAt.setDate(expiresAt.getDate() + INVITATION_EXPIRY_DAYS);
    if (expiresAt > new Date()) {
      throw new ServiceError("CONFLICT", "An invitation is already pending");
    }
    // Expired — delete to allow re-invite
    await db.delete(shoppingListInvitations).where(eq(shoppingListInvitations.id, existing.id));
  }

  // Get inviter info
  const inviter = await db
    .select({ name: user.name, image: user.image })
    .from(user)
    .where(eq(user.id, userId))
    .then((rows) => rows[0]);

  const invitation = await db
    .insert(shoppingListInvitations)
    .values({
      shoppingListId,
      invitedUserId,
      invitedByUserId: userId,
      status: "pending",
      inviterName: inviter!.name,
      inviterImage: inviter!.image,
      shoppingListName: list.name,
      createdAt: new Date(),
    })
    .returning()
    .then((rows) => rows[0]);

  return invitation!;
}

/**
 * Cancel a pending shopping list invitation (owner only)
 */
export async function cancelShoppingListInvitation(
  db: DbClient,
  params: { userId: string; shoppingListId: number; invitedUserId: string },
): Promise<{ success: boolean }> {
  const { userId, shoppingListId, invitedUserId } = params;

  const list = await db
    .select({ id: shoppingLists.id })
    .from(shoppingLists)
    .where(and(eq(shoppingLists.id, shoppingListId), eq(shoppingLists.userId, userId)))
    .then((rows) => rows[0]);

  if (!list) {
    throw new ServiceError("NOT_FOUND", "Shopping list not found or you are not the owner");
  }

  await db
    .delete(shoppingListInvitations)
    .where(
      and(
        eq(shoppingListInvitations.shoppingListId, shoppingListId),
        eq(shoppingListInvitations.invitedUserId, invitedUserId),
        eq(shoppingListInvitations.status, "pending"),
      ),
    );

  return { success: true };
}

/**
 * Accept a shopping list invitation
 */
export async function acceptShoppingListInvitation(
  db: DbClient,
  params: { userId: string; invitationId: number },
): Promise<{ success: boolean }> {
  const { userId, invitationId } = params;

  const invitation = await db
    .select()
    .from(shoppingListInvitations)
    .where(
      and(
        eq(shoppingListInvitations.id, invitationId),
        eq(shoppingListInvitations.invitedUserId, userId),
        eq(shoppingListInvitations.status, "pending"),
      ),
    )
    .then((rows) => rows[0]);

  if (!invitation) {
    throw new ServiceError("NOT_FOUND", "Invitation not found");
  }

  const expiresAt = new Date(invitation.createdAt);
  expiresAt.setDate(expiresAt.getDate() + INVITATION_EXPIRY_DAYS);
  if (expiresAt <= new Date()) {
    await db.delete(shoppingListInvitations).where(eq(shoppingListInvitations.id, invitationId));
    throw new ServiceError("BAD_REQUEST", "This invitation has expired");
  }

  await db
    .update(shoppingListInvitations)
    .set({ status: "accepted" })
    .where(eq(shoppingListInvitations.id, invitationId));

  return { success: true };
}

/**
 * Decline a shopping list invitation
 */
export async function declineShoppingListInvitation(
  db: DbClient,
  params: { userId: string; invitationId: number },
): Promise<{ success: boolean }> {
  const { userId, invitationId } = params;

  await db
    .delete(shoppingListInvitations)
    .where(
      and(
        eq(shoppingListInvitations.id, invitationId),
        eq(shoppingListInvitations.invitedUserId, userId),
        eq(shoppingListInvitations.status, "pending"),
      ),
    );

  return { success: true };
}

/**
 * Remove a member from a shopping list (owner only)
 */
export async function removeShoppingListMember(
  db: DbClient,
  params: { userId: string; shoppingListId: number; memberId: string },
): Promise<{ success: boolean }> {
  const { userId, shoppingListId, memberId } = params;

  const list = await db
    .select({ id: shoppingLists.id })
    .from(shoppingLists)
    .where(and(eq(shoppingLists.id, shoppingListId), eq(shoppingLists.userId, userId)))
    .then((rows) => rows[0]);

  if (!list) {
    throw new ServiceError("NOT_FOUND", "Shopping list not found or you are not the owner");
  }

  await db
    .delete(shoppingListInvitations)
    .where(
      and(
        eq(shoppingListInvitations.shoppingListId, shoppingListId),
        eq(shoppingListInvitations.invitedUserId, memberId),
      ),
    );

  return { success: true };
}

/**
 * Get pending shopping list invitations for a user (non-expired only)
 */
export async function getPendingShoppingListInvitations(
  db: DbClient,
  userId: string,
) {
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() - INVITATION_EXPIRY_DAYS);

  return db
    .select({
      id: shoppingListInvitations.id,
      shoppingListId: shoppingListInvitations.shoppingListId,
      shoppingListName: shoppingListInvitations.shoppingListName,
      inviterName: shoppingListInvitations.inviterName,
      inviterImage: shoppingListInvitations.inviterImage,
      createdAt: shoppingListInvitations.createdAt,
    })
    .from(shoppingListInvitations)
    .where(
      and(
        eq(shoppingListInvitations.invitedUserId, userId),
        eq(shoppingListInvitations.status, "pending"),
        gt(shoppingListInvitations.createdAt, expiryDate),
      ),
    );
}

/**
 * Get invitation status for a shopping list (for share sheet)
 */
export async function getShoppingListInvitationStatus(
  db: DbClient,
  params: { userId: string; shoppingListId: number },
) {
  const { userId, shoppingListId } = params;

  const list = await db
    .select({ id: shoppingLists.id })
    .from(shoppingLists)
    .where(and(eq(shoppingLists.id, shoppingListId), eq(shoppingLists.userId, userId)))
    .then((rows) => rows[0]);

  if (!list) {
    throw new ServiceError("NOT_FOUND", "Shopping list not found or you are not the owner");
  }

  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() - INVITATION_EXPIRY_DAYS);

  return db
    .select({
      id: shoppingListInvitations.id,
      userId: shoppingListInvitations.invitedUserId,
      userName: user.name,
      userImage: user.image,
      createdAt: shoppingListInvitations.createdAt,
    })
    .from(shoppingListInvitations)
    .innerJoin(user, eq(shoppingListInvitations.invitedUserId, user.id))
    .where(
      and(
        eq(shoppingListInvitations.shoppingListId, shoppingListId),
        eq(shoppingListInvitations.status, "pending"),
        gt(shoppingListInvitations.createdAt, expiryDate),
      ),
    );
}

/**
 * Get share status for a shopping list (accepted members)
 */
export async function getShoppingListShareStatus(
  db: DbClient,
  params: { userId: string; shoppingListId: number },
) {
  const { userId, shoppingListId } = params;

  const list = await db
    .select({ id: shoppingLists.id })
    .from(shoppingLists)
    .where(and(eq(shoppingLists.id, shoppingListId), eq(shoppingLists.userId, userId)))
    .then((rows) => rows[0]);

  if (!list) {
    throw new ServiceError("NOT_FOUND", "Shopping list not found or you are not the owner");
  }

  return db
    .select({
      id: shoppingListInvitations.id,
      userId: shoppingListInvitations.invitedUserId,
      userName: user.name,
      userImage: user.image,
      createdAt: shoppingListInvitations.createdAt,
    })
    .from(shoppingListInvitations)
    .innerJoin(user, eq(shoppingListInvitations.invitedUserId, user.id))
    .where(
      and(
        eq(shoppingListInvitations.shoppingListId, shoppingListId),
        eq(shoppingListInvitations.status, "accepted"),
      ),
    );
}
