import { follows, user } from "../../schemas";
import { eq, and } from "drizzle-orm";

import { ServiceError } from "../errors";
import type { DbClient } from "../types";

// ─── Types ─────────────────────────────────────────────────────────────────

export type FollowListItem = {
  followId: number;
  user: Pick<typeof user.$inferSelect, "id" | "name" | "email" | "image">;
  followedAt: Date;
};

// ─── Follow Operations ─────────────────────────────────────────────────────

/**
 * Follow a user
 */
export async function followUser(
  db: DbClient,
  followerId: string,
  followingId: string,
) {
  if (followingId === followerId) {
    throw new ServiceError("BAD_REQUEST", "Cannot follow yourself");
  }

  // Check if already following
  const existingFollow = await db
    .select()
    .from(follows)
    .where(
      and(
        eq(follows.followerId, followerId),
        eq(follows.followingId, followingId),
      ),
    )
    .then((rows) => rows[0]);

  if (existingFollow) {
    throw new ServiceError("CONFLICT", "Already following this user");
  }

  // Check if target user exists
  const targetUser = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.id, followingId))
    .then((rows) => rows[0]);

  if (!targetUser) {
    throw new ServiceError("NOT_FOUND", "User not found");
  }

  // Create follow relationship
  const follow = await db
    .insert(follows)
    .values({
      followerId,
      followingId,
      createdAt: new Date(),
    })
    .returning()
    .then((rows) => rows[0]);

  return follow;
}

/**
 * Unfollow a user
 */
export async function unfollowUser(
  db: DbClient,
  followerId: string,
  followingId: string,
): Promise<{ success: boolean }> {
  const follow = await db
    .select()
    .from(follows)
    .where(
      and(
        eq(follows.followerId, followerId),
        eq(follows.followingId, followingId),
      ),
    )
    .then((rows) => rows[0]);

  if (!follow) {
    throw new ServiceError("NOT_FOUND", "Not following this user");
  }

  await db.delete(follows).where(eq(follows.id, follow.id));

  return { success: true };
}

/**
 * Get list of users being followed or followers
 */
export async function getFollowList(
  db: DbClient,
  params: {
    userId: string;
    type: "followers" | "following";
  },
): Promise<FollowListItem[]> {
  const { userId, type } = params;

  const followList = await db
    .select({
      follow: follows,
      user,
    })
    .from(follows)
    .innerJoin(
      user,
      type === "following"
        ? eq(follows.followingId, user.id)
        : eq(follows.followerId, user.id),
    )
    .where(
      type === "following"
        ? eq(follows.followerId, userId)
        : eq(follows.followingId, userId),
    );

  return followList.map((item) => ({
    followId: item.follow.id,
    user: {
      id: item.user.id,
      name: item.user.name,
      email: item.user.email,
      image: item.user.image,
    },
    followedAt: item.follow.createdAt,
  }));
}
