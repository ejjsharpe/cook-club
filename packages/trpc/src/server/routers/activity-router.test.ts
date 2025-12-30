import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";

import { createMockEnv } from "../__mocks__/env";

// Mock the propagation service
vi.mock("../services/activity/activity-propagation.service", () => ({
  propagateActivityToFollowers: vi.fn().mockResolvedValue(undefined),
}));

// Mock @repo/db/schemas to provide table objects
vi.mock("@repo/db/schemas", () => ({
  activityEvents: { _name: "activity_events" },
  cookingReviews: { _name: "cooking_reviews" },
  cookingReviewImages: { _name: "cooking_review_images" },
  recipes: { _name: "recipes" },
  user: { _name: "user" },
}));

// Mock drizzle-orm operators
vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ type: "eq", field: a, value: b })),
  desc: vi.fn((a) => ({ type: "desc", field: a })),
}));

// Create a mock db that tracks queries and returns configured results
function createMockDb() {
  const queryResults: Map<string, unknown[]> = new Map();
  let currentQueryTable: string | null = null;
  let insertValues: unknown[] = [];
  let returningResult: unknown[] = [];

  const createQueryChain = () => {
    const chain: Record<string, unknown> = {};

    chain.select = vi.fn().mockImplementation(() => chain);
    chain.from = vi.fn().mockImplementation((table: { _name?: string }) => {
      currentQueryTable = table?._name || "unknown";
      return chain;
    });
    chain.innerJoin = vi.fn().mockImplementation(() => chain);
    chain.leftJoin = vi.fn().mockImplementation(() => chain);
    chain.where = vi.fn().mockImplementation(() => chain);
    chain.orderBy = vi.fn().mockImplementation(() => chain);
    chain.limit = vi.fn().mockImplementation(() => chain);
    chain.then = vi.fn().mockImplementation((callback: (rows: unknown[]) => unknown) => {
      const results = queryResults.get(currentQueryTable || "") || [];
      return Promise.resolve(callback(results));
    });

    return chain;
  };

  const createInsertChain = () => {
    const chain: Record<string, unknown> = {};

    chain.values = vi.fn().mockImplementation((values: unknown) => {
      insertValues = Array.isArray(values) ? values : [values];
      return chain;
    });
    chain.returning = vi.fn().mockImplementation(() => {
      return Promise.resolve(returningResult);
    });

    return chain;
  };

  return {
    select: vi.fn().mockImplementation(() => createQueryChain()),
    insert: vi.fn().mockImplementation(() => createInsertChain()),
    _setResults: (tableName: string, results: unknown[]) => {
      queryResults.set(tableName, results);
    },
    _setInsertReturning: (result: unknown[]) => {
      returningResult = result;
    },
    _getInsertValues: () => insertValues,
    _queryResults: queryResults,
  };
}

type MockDb = ReturnType<typeof createMockDb>;

// Helper to create a mock context
function createMockContext(db: MockDb, overrides: Partial<{
  user: { id: string; name: string; image: string | null };
  env: ReturnType<typeof createMockEnv>;
}> = {}) {
  return {
    db: db as any,
    env: overrides.env ?? createMockEnv() as any,
    user: overrides.user ?? { id: "test-user-id", name: "Test User", image: null },
    req: new Request("http://localhost"),
    resHeaders: new Headers(),
  };
}

// Import after mocks
import { activityRouter } from "./activity-router";

describe("activityRouter", () => {
  let mockDb: MockDb;
  let mockEnv: ReturnType<typeof createMockEnv>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    mockEnv = createMockEnv();
  });

  describe("getFeed", () => {
    it("returns paginated feed items from Durable Object", async () => {
      const mockFeedItems = [
        {
          id: "1",
          type: "recipe_import",
          actorId: "user-1",
          actorName: "User One",
          createdAt: Date.now(),
        },
      ];

      // Mock the DO fetch response
      mockEnv.USER_FEED._stub.fetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ items: mockFeedItems, nextCursor: null }),
          { headers: { "Content-Type": "application/json" } }
        )
      );

      const ctx = createMockContext(mockDb, { env: mockEnv });
      const caller = activityRouter.createCaller(ctx as any);

      const result = await caller.getFeed({ limit: 20 });

      expect(result.items).toHaveLength(1);
      expect(result.items[0]!.id).toBe("1");
      expect(result.nextCursor).toBeNull();

      // Verify DO was called correctly
      expect(mockEnv.USER_FEED.idFromName).toHaveBeenCalledWith("test-user-id");
      expect(mockEnv.USER_FEED._stub.fetch).toHaveBeenCalled();
    });

    it("passes cursor parameter to Durable Object", async () => {
      mockEnv.USER_FEED._stub.fetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ items: [], nextCursor: null }),
          { headers: { "Content-Type": "application/json" } }
        )
      );

      const ctx = createMockContext(mockDb, { env: mockEnv });
      const caller = activityRouter.createCaller(ctx as any);

      await caller.getFeed({ cursor: "some-cursor", limit: 10 });

      const fetchCall = mockEnv.USER_FEED._stub.fetch.mock.calls[0]![0] as Request;
      const url = new URL(fetchCall.url);
      expect(url.searchParams.get("cursor")).toBe("some-cursor");
      expect(url.searchParams.get("limit")).toBe("10");
    });

    it("returns nextCursor when more items exist", async () => {
      mockEnv.USER_FEED._stub.fetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ items: [], nextCursor: "next-page-cursor" }),
          { headers: { "Content-Type": "application/json" } }
        )
      );

      const ctx = createMockContext(mockDb, { env: mockEnv });
      const caller = activityRouter.createCaller(ctx as any);

      const result = await caller.getFeed({ limit: 20 });

      expect(result.nextCursor).toBe("next-page-cursor");
    });

    it("throws error when DO fetch fails", async () => {
      mockEnv.USER_FEED._stub.fetch.mockRejectedValueOnce(new Error("DO unavailable"));

      const ctx = createMockContext(mockDb, { env: mockEnv });
      const caller = activityRouter.createCaller(ctx as any);

      await expect(caller.getFeed({ limit: 20 })).rejects.toThrow(TRPCError);
    });
  });

  describe("createCookingReview", () => {
    it("creates review with rating only", async () => {
      mockDb._setResults("recipes", [{ id: 1, name: "Test Recipe" }]);

      // First returning call is for activity event
      mockDb._setInsertReturning([{ id: 100 }]);

      const ctx = createMockContext(mockDb, { env: mockEnv });
      const caller = activityRouter.createCaller(ctx as any);

      // Mock to return different values for sequential inserts
      let insertCount = 0;
      mockDb.insert = vi.fn().mockImplementation(() => {
        insertCount++;
        return {
          values: vi.fn().mockReturnThis(),
          returning: vi.fn().mockResolvedValue(
            insertCount === 1
              ? [{ id: 100 }] // activity event
              : [{ id: 200 }] // review
          ),
        };
      });

      const result = await caller.createCookingReview({
        recipeId: 1,
        rating: 4,
      });

      expect(result.id).toBe(200);
      expect(result.activityEventId).toBe(100);
    });

    it("creates review with rating and text", async () => {
      mockDb._setResults("recipes", [{ id: 1, name: "Test Recipe" }]);

      let insertCount = 0;
      mockDb.insert = vi.fn().mockImplementation(() => {
        insertCount++;
        return {
          values: vi.fn().mockReturnThis(),
          returning: vi.fn().mockResolvedValue(
            insertCount === 1
              ? [{ id: 100 }]
              : [{ id: 200 }]
          ),
        };
      });

      const ctx = createMockContext(mockDb, { env: mockEnv });
      const caller = activityRouter.createCaller(ctx as any);

      const result = await caller.createCookingReview({
        recipeId: 1,
        rating: 5,
        reviewText: "Absolutely delicious!",
      });

      expect(result.id).toBe(200);
    });

    it("creates review with images", async () => {
      mockDb._setResults("recipes", [{ id: 1, name: "Test Recipe" }]);

      let insertCount = 0;
      mockDb.insert = vi.fn().mockImplementation(() => {
        insertCount++;
        return {
          values: vi.fn().mockReturnThis(),
          returning: vi.fn().mockResolvedValue(
            insertCount === 1
              ? [{ id: 100 }]
              : insertCount === 2
              ? [{ id: 200 }]
              : []
          ),
        };
      });

      const ctx = createMockContext(mockDb, { env: mockEnv });
      const caller = activityRouter.createCaller(ctx as any);

      await caller.createCookingReview({
        recipeId: 1,
        rating: 4,
        imageUrls: ["http://example.com/photo1.jpg", "http://example.com/photo2.jpg"],
      });

      // Should have 3 insert calls: activity event, review, images
      expect(mockDb.insert).toHaveBeenCalledTimes(3);
    });

    it("throws NOT_FOUND for non-existent recipeId", async () => {
      mockDb._setResults("recipes", []); // No recipe found

      const ctx = createMockContext(mockDb, { env: mockEnv });
      const caller = activityRouter.createCaller(ctx as any);

      await expect(
        caller.createCookingReview({ recipeId: 999, rating: 4 })
      ).rejects.toThrow(TRPCError);

      try {
        await caller.createCookingReview({ recipeId: 999, rating: 4 });
      } catch (err) {
        expect((err as TRPCError).code).toBe("NOT_FOUND");
      }
    });

    it("propagates activity to followers", async () => {
      const { propagateActivityToFollowers } = await import(
        "../services/activity/activity-propagation.service"
      );

      mockDb._setResults("recipes", [{ id: 1, name: "Test Recipe" }]);

      let insertCount = 0;
      mockDb.insert = vi.fn().mockImplementation(() => {
        insertCount++;
        return {
          values: vi.fn().mockReturnThis(),
          returning: vi.fn().mockResolvedValue(
            insertCount === 1
              ? [{ id: 100 }]
              : [{ id: 200 }]
          ),
        };
      });

      const ctx = createMockContext(mockDb, { env: mockEnv });
      const caller = activityRouter.createCaller(ctx as any);

      await caller.createCookingReview({ recipeId: 1, rating: 5 });

      expect(propagateActivityToFollowers).toHaveBeenCalledWith(
        expect.anything(), // db
        expect.anything(), // env
        100, // activity event id
        "test-user-id" // user id
      );
    });
  });

  describe("getRecipeReviews", () => {
    it("returns reviews with user info", async () => {
      const createdAt = new Date();
      mockDb._setResults("cooking_reviews", [
        {
          review: {
            id: 1,
            rating: 5,
            reviewText: "Great!",
            createdAt,
          },
          user: {
            id: "user-1",
            name: "Chef User",
            image: "http://example.com/avatar.jpg",
          },
        },
      ]);
      mockDb._setResults("cooking_review_images", [
        { url: "http://example.com/photo.jpg" },
      ]);

      const ctx = createMockContext(mockDb, { env: mockEnv });
      const caller = activityRouter.createCaller(ctx as any);

      const result = await caller.getRecipeReviews({ recipeId: 1, limit: 20 });

      expect(result.items).toHaveLength(1);
      expect(result.items[0]!.rating).toBe(5);
      expect(result.items[0]!.reviewText).toBe("Great!");
      expect(result.items[0]!.user.name).toBe("Chef User");
    });

    it("includes review images", async () => {
      mockDb._setResults("cooking_reviews", [
        {
          review: { id: 1, rating: 4, reviewText: null, createdAt: new Date() },
          user: { id: "user-1", name: "User", image: null },
        },
      ]);
      mockDb._setResults("cooking_review_images", [
        { url: "http://example.com/img1.jpg" },
        { url: "http://example.com/img2.jpg" },
      ]);

      const ctx = createMockContext(mockDb, { env: mockEnv });
      const caller = activityRouter.createCaller(ctx as any);

      const result = await caller.getRecipeReviews({ recipeId: 1 });

      expect(result.items[0]!.images).toEqual([
        "http://example.com/img1.jpg",
        "http://example.com/img2.jpg",
      ]);
    });

    it("returns paginated results with nextCursor", async () => {
      // Return more than limit to trigger nextCursor
      const reviews = Array.from({ length: 3 }, (_, i) => ({
        review: { id: i + 1, rating: 4, reviewText: null, createdAt: new Date() },
        user: { id: `user-${i}`, name: `User ${i}`, image: null },
      }));

      mockDb._setResults("cooking_reviews", reviews);
      mockDb._setResults("cooking_review_images", []);

      const ctx = createMockContext(mockDb, { env: mockEnv });
      const caller = activityRouter.createCaller(ctx as any);

      const result = await caller.getRecipeReviews({ recipeId: 1, limit: 2 });

      expect(result.items).toHaveLength(2);
      expect(result.nextCursor).toBe(2); // ID of last item
    });
  });

  describe("getRecipeRating", () => {
    it("returns average rating and count", async () => {
      mockDb._setResults("cooking_reviews", [
        { rating: 5 },
        { rating: 4 },
        { rating: 3 },
      ]);

      const ctx = createMockContext(mockDb, { env: mockEnv });
      const caller = activityRouter.createCaller(ctx as any);

      const result = await caller.getRecipeRating({ recipeId: 1 });

      expect(result.averageRating).toBe(4); // (5+4+3)/3 = 4
      expect(result.reviewCount).toBe(3);
    });

    it("returns null average when no reviews", async () => {
      mockDb._setResults("cooking_reviews", []);

      const ctx = createMockContext(mockDb, { env: mockEnv });
      const caller = activityRouter.createCaller(ctx as any);

      const result = await caller.getRecipeRating({ recipeId: 1 });

      expect(result.averageRating).toBeNull();
      expect(result.reviewCount).toBe(0);
    });

    it("rounds average to one decimal place", async () => {
      mockDb._setResults("cooking_reviews", [
        { rating: 5 },
        { rating: 4 },
      ]);

      const ctx = createMockContext(mockDb, { env: mockEnv });
      const caller = activityRouter.createCaller(ctx as any);

      const result = await caller.getRecipeRating({ recipeId: 1 });

      expect(result.averageRating).toBe(4.5); // (5+4)/2 = 4.5
    });
  });
});
