import { describe, it, expect, vi, beforeEach } from "vitest";

import { followsRouter } from "./follows-router";
import { createMockEnv } from "../__mocks__/env";

const mocks = vi.hoisted(() => ({
  backfillFeedFromUser: vi.fn().mockResolvedValue(undefined),
  removeUserFromFeed: vi.fn().mockResolvedValue(undefined),
  followUser: vi.fn(),
  unfollowUser: vi.fn(),
  getFollowList: vi.fn(),
  createNotification: vi.fn().mockResolvedValue(undefined),
  ServiceError: class ServiceError extends Error {
    code = "INTERNAL_ERROR";
  },
}));

vi.mock("../services/activity", () => ({
  backfillFeedFromUser: mocks.backfillFeedFromUser,
  removeUserFromFeed: mocks.removeUserFromFeed,
}));

vi.mock("@repo/db/services", () => ({
  followUser: mocks.followUser,
  unfollowUser: mocks.unfollowUser,
  getFollowList: mocks.getFollowList,
  createNotification: mocks.createNotification,
  ServiceError: mocks.ServiceError,
}));

// Mock @repo/db/schemas
vi.mock("@repo/db/schemas", () => ({
  follows: { _name: "follows" },
  user: { _name: "user" },
  recipes: { _name: "recipes" },
}));

// Mock drizzle-orm
vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ type: "eq", field: a, value: b })),
  and: vi.fn((...args) => ({ type: "and", conditions: args })),
  or: vi.fn((...args) => ({ type: "or", conditions: args })),
  ne: vi.fn((a, b) => ({ type: "ne", field: a, value: b })),
  like: vi.fn((a, b) => ({ type: "like", field: a, pattern: b })),
  count: vi.fn((a) => ({ type: "count", field: a })),
  sql: vi.fn(),
  notInArray: vi.fn((a, b) => ({ type: "notInArray", field: a, values: b })),
  desc: vi.fn((a) => ({ type: "desc", field: a })),
}));

// Create a simple mock db
function createMockDb() {
  return {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    then: vi.fn().mockResolvedValue([]),
  } as any;
}

// Helper to create mock context
function createMockContext(
  overrides: Partial<{
    user: { id: string; name: string; image: string | null };
    env: ReturnType<typeof createMockEnv>;
  }> = {},
) {
  return {
    db: createMockDb(),
    env: overrides.env ?? (createMockEnv() as any),
    user: overrides.user ?? {
      id: "test-user-id",
      name: "Test User",
      image: null,
    },
    req: new Request("http://localhost"),
    resHeaders: new Headers(),
  };
}

describe("followsRouter - activity integration", () => {
  let mockEnv: ReturnType<typeof createMockEnv>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv = createMockEnv();
    mocks.backfillFeedFromUser.mockResolvedValue(undefined);
    mocks.removeUserFromFeed.mockResolvedValue(undefined);
    mocks.createNotification.mockResolvedValue(undefined);
    mocks.followUser.mockResolvedValue({
      success: true,
      isNewFollow: true,
    });
    mocks.unfollowUser.mockResolvedValue({ success: true });
  });

  describe("followUser - activity integration", () => {
    it("triggers feed backfill from followed user", async () => {
      const ctx = createMockContext({ env: mockEnv });
      const caller = followsRouter.createCaller(ctx as any);

      await caller.followUser({ userId: "followed-user-id" });

      // Allow async fire-and-forget to run
      await new Promise((r) => setTimeout(r, 0));

      expect(mocks.backfillFeedFromUser).toHaveBeenCalledWith(
        expect.anything(), // db
        expect.anything(), // env
        "test-user-id", // current user
        "followed-user-id", // followed user
        10, // limit
      );
    });

    it("follow succeeds even if backfill fails", async () => {
      mocks.backfillFeedFromUser.mockRejectedValueOnce(
        new Error("Backfill failed"),
      );

      const ctx = createMockContext({ env: mockEnv });
      const caller = followsRouter.createCaller(ctx as any);

      // Should not throw - backfill is fire-and-forget
      const result = await caller.followUser({ userId: "followed-user-id" });

      // Mutation should complete successfully, returning the follow record
      expect(result).toBeDefined();
    });

    it("calls follow service with correct parameters", async () => {
      const ctx = createMockContext({ env: mockEnv });
      const caller = followsRouter.createCaller(ctx as any);

      await caller.followUser({ userId: "user-to-follow" });

      expect(mocks.followUser).toHaveBeenCalledWith(
        expect.anything(), // db
        "test-user-id", // current user
        "user-to-follow", // user to follow
      );
    });
  });

  describe("unfollowUser - activity integration", () => {
    it("triggers feed cleanup for unfollowed user", async () => {
      const ctx = createMockContext({ env: mockEnv });
      const caller = followsRouter.createCaller(ctx as any);

      await caller.unfollowUser({ userId: "unfollowed-user-id" });

      // Allow async fire-and-forget to run
      await new Promise((r) => setTimeout(r, 0));

      expect(mocks.removeUserFromFeed).toHaveBeenCalledWith(
        expect.anything(), // db
        expect.anything(), // env
        "test-user-id", // current user
        "unfollowed-user-id", // unfollowed user
      );
    });

    it("unfollow succeeds even if cleanup fails", async () => {
      mocks.removeUserFromFeed.mockRejectedValueOnce(new Error("Cleanup failed"));

      const ctx = createMockContext({ env: mockEnv });
      const caller = followsRouter.createCaller(ctx as any);

      // Should not throw - cleanup is fire-and-forget
      const result = await caller.unfollowUser({
        userId: "unfollowed-user-id",
      });

      expect(result.success).toBe(true);
    });

    it("calls unfollow service with correct parameters", async () => {
      const ctx = createMockContext({ env: mockEnv });
      const caller = followsRouter.createCaller(ctx as any);

      await caller.unfollowUser({ userId: "user-to-unfollow" });

      expect(mocks.unfollowUser).toHaveBeenCalledWith(
        expect.anything(), // db
        "test-user-id", // current user
        "user-to-unfollow", // user to unfollow
      );
    });
  });
});
