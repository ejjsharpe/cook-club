import type { DbType } from "@repo/db";
import { activityEvents, follows } from "@repo/db/schemas";
import { eq, desc } from "drizzle-orm";

import type { ActivityServiceEnv } from "./feed-types";

// ─── Propagation Functions (send IDs to DOs) ─────────────────────────────────

/**
 * Propagate an activity ID to all followers and the user's own feed.
 * Now sends only the activity ID, not the full item.
 */
export async function propagateActivityToFollowers(
  db: DbType,
  env: ActivityServiceEnv,
  activityEventId: number,
  userId: string,
  createdAt: Date,
): Promise<void> {
  // Get all followers of the user
  const followers = await db
    .select({ followerId: follows.followerId })
    .from(follows)
    .where(eq(follows.followingId, userId));

  // Fan out to each follower's Feed DO and to the user's own feed
  const targetUserIds = [userId, ...followers.map((f) => f.followerId)];

  const entry = {
    activityEventId,
    createdAt: createdAt.getTime(),
  };

  await Promise.all(
    targetUserIds.map(async (targetUserId) => {
      const feedDO = env.USER_FEED.get(env.USER_FEED.idFromName(targetUserId));
      await feedDO.fetch(
        new Request("http://do/addActivityId", {
          method: "POST",
          body: JSON.stringify(entry),
          headers: { "Content-Type": "application/json" },
        }),
      );
    }),
  );
}

/**
 * Backfill a user's feed with activity IDs from a newly followed user.
 */
export async function backfillFeedFromUser(
  db: DbType,
  env: ActivityServiceEnv,
  currentUserId: string,
  followedUserId: string,
  limit: number = 10,
): Promise<void> {
  // Get recent activities from the followed user
  const recentActivities = await db
    .select({
      id: activityEvents.id,
      createdAt: activityEvents.createdAt,
    })
    .from(activityEvents)
    .where(eq(activityEvents.userId, followedUserId))
    .orderBy(desc(activityEvents.createdAt))
    .limit(limit);

  if (recentActivities.length === 0) return;

  const entries = recentActivities.map((a) => ({
    activityEventId: a.id,
    createdAt: a.createdAt.getTime(),
  }));

  const feedDO = env.USER_FEED.get(env.USER_FEED.idFromName(currentUserId));
  await feedDO.fetch(
    new Request("http://do/addActivityIds", {
      method: "POST",
      body: JSON.stringify(entries),
      headers: { "Content-Type": "application/json" },
    }),
  );
}

/**
 * Remove all activities from a user after unfollowing.
 * Now looks up activity IDs from DB since DO no longer stores user info.
 */
export async function removeUserFromFeed(
  db: DbType,
  env: ActivityServiceEnv,
  currentUserId: string,
  unfollowedUserId: string,
): Promise<void> {
  // Get activity IDs for the unfollowed user
  const activities = await db
    .select({ id: activityEvents.id })
    .from(activityEvents)
    .where(eq(activityEvents.userId, unfollowedUserId));

  const activityIds = activities.map((a) => a.id);

  if (activityIds.length === 0) return;

  const feedDO = env.USER_FEED.get(env.USER_FEED.idFromName(currentUserId));
  await feedDO.fetch(
    new Request("http://do/removeActivityIds", {
      method: "POST",
      body: JSON.stringify({ activityIds }),
      headers: { "Content-Type": "application/json" },
    }),
  );
}

/**
 * Hydrate a user's feed from scratch with activity IDs.
 * Useful for development/seeding or when DO state is lost.
 */
export async function hydrateFeed(
  db: DbType,
  env: ActivityServiceEnv,
  userId: string,
  limitPerUser: number = 10,
): Promise<number> {
  // Get all users this person follows
  const following = await db
    .select({ followingId: follows.followingId })
    .from(follows)
    .where(eq(follows.followerId, userId));

  const userIdsToFetch = [userId, ...following.map((f) => f.followingId)];

  const allEntries: { activityEventId: number; createdAt: number }[] = [];

  for (const targetUserId of userIdsToFetch) {
    const recentActivities = await db
      .select({
        id: activityEvents.id,
        createdAt: activityEvents.createdAt,
      })
      .from(activityEvents)
      .where(eq(activityEvents.userId, targetUserId))
      .orderBy(desc(activityEvents.createdAt))
      .limit(limitPerUser);

    for (const activity of recentActivities) {
      allEntries.push({
        activityEventId: activity.id,
        createdAt: activity.createdAt.getTime(),
      });
    }
  }

  if (allEntries.length > 0) {
    const feedDO = env.USER_FEED.get(env.USER_FEED.idFromName(userId));
    await feedDO.fetch(
      new Request("http://do/addActivityIds", {
        method: "POST",
        body: JSON.stringify(allEntries),
        headers: { "Content-Type": "application/json" },
      }),
    );
  }

  return allEntries.length;
}
