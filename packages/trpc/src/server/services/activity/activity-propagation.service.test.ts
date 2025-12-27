import { describe, it, expect, vi, beforeEach } from "vitest";

import { createMockEnv } from "../../__mocks__/env";
import {
  buildFeedItem,
  propagateActivityToFollowers,
  backfillFeedFromUser,
  removeUserFromFeed,
} from "./activity-propagation.service";

// Mock @repo/db/schemas to provide table objects with names
vi.mock("@repo/db/schemas", () => ({
  activityEvents: { _name: "activity_events" },
  cookingReviews: { _name: "cooking_reviews" },
  cookingReviewImages: { _name: "cooking_review_images" },
  follows: { _name: "follows" },
  user: { _name: "user" },
  recipes: { _name: "recipes" },
  recipeImages: { _name: "recipe_images" },
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

  const createQueryChain = () => {
    const chain: Record<string, unknown> = {};

    chain.select = vi.fn().mockImplementation(() => chain);
    chain.from = vi.fn().mockImplementation((table: { _name?: string }) => {
      currentQueryTable = table?._name || "unknown";
      return chain;
    });
    chain.where = vi.fn().mockImplementation(() => chain);
    chain.orderBy = vi.fn().mockImplementation(() => chain);
    chain.limit = vi.fn().mockImplementation(() => chain);
    chain.then = vi.fn().mockImplementation((callback: (rows: unknown[]) => unknown) => {
      const results = queryResults.get(currentQueryTable || "") || [];
      return Promise.resolve(callback(results));
    });

    return chain;
  };

  return {
    select: vi.fn().mockImplementation(() => createQueryChain()),
    _setResults: (tableName: string, results: unknown[]) => {
      queryResults.set(tableName, results);
    },
    _queryResults: queryResults,
  };
}

type MockDb = ReturnType<typeof createMockDb>;

describe("activity-propagation.service", () => {
  let mockDb: MockDb;
  let mockEnv: ReturnType<typeof createMockEnv>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    mockEnv = createMockEnv();
  });

  describe("buildFeedItem", () => {
    it("returns null for non-existent activity", async () => {
      // No results set, so activity query will return empty
      const result = await buildFeedItem(mockDb as any, 999);
      expect(result).toBeNull();
    });

    it("returns null when actor is not found", async () => {
      mockDb._setResults("activity_events", [
        {
          id: 1,
          type: "recipe_import",
          userId: "user-1",
          recipeId: 1,
          batchImportCount: null,
          batchImportSource: null,
          createdAt: new Date(),
        },
      ]);
      // No user results - actor not found

      const result = await buildFeedItem(mockDb as any, 1);
      expect(result).toBeNull();
    });

    it("builds FeedItem for recipe_import activity", async () => {
      const createdAt = new Date("2024-01-15T10:00:00Z");

      mockDb._setResults("activity_events", [
        {
          id: 1,
          type: "recipe_import",
          userId: "user-1",
          recipeId: 1,
          batchImportCount: null,
          batchImportSource: null,
          createdAt,
        },
      ]);
      mockDb._setResults("user", [
        { id: "user-1", name: "Test User", image: "http://example.com/avatar.jpg" },
      ]);
      mockDb._setResults("recipes", [
        { id: 1, name: "Test Recipe", sourceUrl: "https://www.example.com/recipe" },
      ]);
      mockDb._setResults("recipe_images", [
        { url: "http://example.com/recipe.jpg" },
      ]);

      const result = await buildFeedItem(mockDb as any, 1);

      expect(result).not.toBeNull();
      expect(result!.id).toBe("1");
      expect(result!.type).toBe("recipe_import");
      expect(result!.actorId).toBe("user-1");
      expect(result!.actorName).toBe("Test User");
      expect(result!.actorImage).toBe("http://example.com/avatar.jpg");
      expect(result!.recipeId).toBe(1);
      expect(result!.recipeName).toBe("Test Recipe");
      expect(result!.recipeImage).toBe("http://example.com/recipe.jpg");
      expect(result!.sourceUrl).toBe("https://www.example.com/recipe");
      expect(result!.sourceDomain).toBe("example.com");
      expect(result!.isExternalRecipe).toBe(true);
      expect(result!.rating).toBeNull();
      expect(result!.reviewText).toBeNull();
      expect(result!.reviewImages).toEqual([]);
      expect(result!.createdAt).toBe(createdAt.getTime());
    });

    it("builds FeedItem for cooking_review activity with images", async () => {
      const createdAt = new Date("2024-01-15T10:00:00Z");

      mockDb._setResults("activity_events", [
        {
          id: 2,
          type: "cooking_review",
          userId: "user-1",
          recipeId: 1,
          batchImportCount: null,
          batchImportSource: null,
          createdAt,
        },
      ]);
      mockDb._setResults("user", [
        { id: "user-1", name: "Chef User", image: null },
      ]);
      mockDb._setResults("recipes", [
        { id: 1, name: "Pasta", sourceUrl: null },
      ]);
      mockDb._setResults("recipe_images", []);
      mockDb._setResults("cooking_reviews", [
        { id: 10, rating: 5, reviewText: "Delicious!" },
      ]);
      mockDb._setResults("cooking_review_images", [
        { url: "http://example.com/photo1.jpg" },
        { url: "http://example.com/photo2.jpg" },
      ]);

      const result = await buildFeedItem(mockDb as any, 2);

      expect(result).not.toBeNull();
      expect(result!.type).toBe("cooking_review");
      expect(result!.rating).toBe(5);
      expect(result!.reviewText).toBe("Delicious!");
      expect(result!.reviewImages).toEqual([
        "http://example.com/photo1.jpg",
        "http://example.com/photo2.jpg",
      ]);
      expect(result!.isExternalRecipe).toBe(false);
      expect(result!.sourceDomain).toBeNull();
    });

    it("handles recipe without sourceUrl (internal recipe)", async () => {
      mockDb._setResults("activity_events", [
        {
          id: 1,
          type: "recipe_import",
          userId: "user-1",
          recipeId: 1,
          batchImportCount: null,
          batchImportSource: null,
          createdAt: new Date(),
        },
      ]);
      mockDb._setResults("user", [
        { id: "user-1", name: "Test User", image: null },
      ]);
      mockDb._setResults("recipes", [
        { id: 1, name: "My Recipe", sourceUrl: null },
      ]);
      mockDb._setResults("recipe_images", []);

      const result = await buildFeedItem(mockDb as any, 1);

      expect(result).not.toBeNull();
      expect(result!.isExternalRecipe).toBe(false);
      expect(result!.sourceDomain).toBeNull();
      expect(result!.sourceUrl).toBeNull();
    });

    it("handles batch import metadata", async () => {
      mockDb._setResults("activity_events", [
        {
          id: 1,
          type: "recipe_import",
          userId: "user-1",
          recipeId: null,
          batchImportCount: 5,
          batchImportSource: "instagram.com",
          createdAt: new Date(),
        },
      ]);
      mockDb._setResults("user", [
        { id: "user-1", name: "Test User", image: null },
      ]);

      const result = await buildFeedItem(mockDb as any, 1);

      expect(result).not.toBeNull();
      expect(result!.batchCount).toBe(5);
      expect(result!.batchSource).toBe("instagram.com");
      expect(result!.recipeId).toBeNull();
    });
  });

  describe("propagateActivityToFollowers", () => {
    it("sends activity to all followers feeds", async () => {
      const createdAt = new Date();

      // Set up activity event
      mockDb._setResults("activity_events", [
        {
          id: 1,
          type: "recipe_import",
          userId: "user-1",
          recipeId: 1,
          batchImportCount: null,
          batchImportSource: null,
          createdAt,
        },
      ]);
      mockDb._setResults("user", [
        { id: "user-1", name: "Test User", image: null },
      ]);
      mockDb._setResults("recipes", [
        { id: 1, name: "Test Recipe", sourceUrl: null },
      ]);
      mockDb._setResults("recipe_images", []);
      mockDb._setResults("follows", [
        { followerId: "follower-1" },
        { followerId: "follower-2" },
      ]);

      await propagateActivityToFollowers(mockDb as any, mockEnv as any, 1, "user-1");

      // Should have called idFromName for each follower
      expect(mockEnv.USER_FEED.idFromName).toHaveBeenCalledTimes(2);
      expect(mockEnv.USER_FEED.idFromName).toHaveBeenCalledWith("follower-1");
      expect(mockEnv.USER_FEED.idFromName).toHaveBeenCalledWith("follower-2");

      // Should have made fetch calls to each DO
      const stub = mockEnv.USER_FEED._stub;
      expect(stub.fetch).toHaveBeenCalledTimes(2);
    });

    it("handles user with no followers", async () => {
      mockDb._setResults("activity_events", [
        {
          id: 1,
          type: "recipe_import",
          userId: "user-1",
          recipeId: 1,
          batchImportCount: null,
          batchImportSource: null,
          createdAt: new Date(),
        },
      ]);
      mockDb._setResults("user", [
        { id: "user-1", name: "Test User", image: null },
      ]);
      mockDb._setResults("recipes", [
        { id: 1, name: "Test Recipe", sourceUrl: null },
      ]);
      mockDb._setResults("recipe_images", []);
      mockDb._setResults("follows", []); // No followers

      await propagateActivityToFollowers(mockDb as any, mockEnv as any, 1, "user-1");

      // Should not have made any DO calls
      const stub = mockEnv.USER_FEED._stub;
      expect(stub.fetch).not.toHaveBeenCalled();
    });

    it("does nothing when activity not found", async () => {
      // No activity events - buildFeedItem returns null
      await propagateActivityToFollowers(mockDb as any, mockEnv as any, 999, "user-1");

      const stub = mockEnv.USER_FEED._stub;
      expect(stub.fetch).not.toHaveBeenCalled();
    });
  });

  describe("backfillFeedFromUser", () => {
    it("fetches and adds recent activities to current users feed", async () => {
      const createdAt = new Date();

      // Set up multiple activities
      mockDb._setResults("activity_events", [
        {
          id: 1,
          type: "recipe_import",
          userId: "followed-user",
          recipeId: 1,
          batchImportCount: null,
          batchImportSource: null,
          createdAt,
        },
      ]);
      mockDb._setResults("user", [
        { id: "followed-user", name: "Followed User", image: null },
      ]);
      mockDb._setResults("recipes", [
        { id: 1, name: "Recipe 1", sourceUrl: null },
      ]);
      mockDb._setResults("recipe_images", []);

      await backfillFeedFromUser(
        mockDb as any,
        mockEnv as any,
        "current-user",
        "followed-user",
        10
      );

      // Should get current user's feed DO
      expect(mockEnv.USER_FEED.idFromName).toHaveBeenCalledWith("current-user");

      // Should make fetch call with addFeedItems
      const stub = mockEnv.USER_FEED._stub;
      expect(stub.fetch).toHaveBeenCalledTimes(1);

      const fetchCall = stub.fetch.mock.calls[0][0] as Request;
      expect(fetchCall.url).toBe("http://do/addFeedItems");
      expect(fetchCall.method).toBe("POST");
    });

    it("handles followed user with no activities", async () => {
      mockDb._setResults("activity_events", []); // No activities

      await backfillFeedFromUser(
        mockDb as any,
        mockEnv as any,
        "current-user",
        "followed-user",
        10
      );

      // Should not make any DO calls
      const stub = mockEnv.USER_FEED._stub;
      expect(stub.fetch).not.toHaveBeenCalled();
    });
  });

  describe("removeUserFromFeed", () => {
    it("calls Durable Object to remove user items", async () => {
      await removeUserFromFeed(mockEnv as any, "current-user", "unfollowed-user");

      expect(mockEnv.USER_FEED.idFromName).toHaveBeenCalledWith("current-user");

      const stub = mockEnv.USER_FEED._stub;
      expect(stub.fetch).toHaveBeenCalledTimes(1);

      const fetchCall = stub.fetch.mock.calls[0][0] as Request;
      expect(fetchCall.url).toBe("http://do/removeItemsFromUser");
      expect(fetchCall.method).toBe("POST");

      const body = await fetchCall.json();
      expect(body).toEqual({ userId: "unfollowed-user" });
    });
  });
});
