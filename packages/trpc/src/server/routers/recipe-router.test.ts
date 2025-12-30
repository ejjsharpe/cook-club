import { describe, it, expect, vi, beforeEach } from "vitest";

import { recipeRouter } from "./recipe-router";
import { createMockEnv } from "../__mocks__/env";

// Mock the propagation service
const mockPropagateActivityToFollowers = vi.fn().mockResolvedValue(undefined);

vi.mock("../services/activity/activity-propagation.service", () => ({
  propagateActivityToFollowers: (...args: unknown[]) =>
    mockPropagateActivityToFollowers(...args),
}));

// Mock the recipe service
const mockCreateRecipe = vi.fn();
const mockValidateTags = vi.fn().mockResolvedValue(undefined);

vi.mock("../services/recipe", () => ({
  createRecipe: (...args: unknown[]) => mockCreateRecipe(...args),
  validateTags: (...args: unknown[]) => mockValidateTags(...args),
}));

// Mock @repo/db/schemas
vi.mock("@repo/db/schemas", () => ({
  activityEvents: { _name: "activity_events" },
  recipes: { _name: "recipes" },
  recipeImages: { _name: "recipe_images" },
  recipeIngredients: { _name: "recipe_ingredients" },
  recipeInstructions: { _name: "recipe_instructions" },
  recipeCollections: { _name: "recipe_collections" },
  collections: { _name: "collections" },
  recipeTags: { _name: "recipe_tags" },
  tags: { _name: "tags" },
  user: { _name: "user" },
}));

// Mock drizzle-orm
vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ type: "eq", field: a, value: b })),
  desc: vi.fn((a) => ({ type: "desc", field: a })),
  asc: vi.fn((a) => ({ type: "asc", field: a })),
  and: vi.fn((...args) => ({ type: "and", conditions: args })),
  or: vi.fn((...args) => ({ type: "or", conditions: args })),
  inArray: vi.fn((a, b) => ({ type: "inArray", field: a, values: b })),
  count: vi.fn((a) => ({ type: "count", field: a })),
  min: vi.fn((a) => ({ type: "min", field: a })),
  like: vi.fn((a, b) => ({ type: "like", field: a, pattern: b })),
  sql: vi.fn(),
}));

// Mock arktype with full API
vi.mock("arktype", () => {
  const createValidator = (): any => {
    const validator: any = (input: unknown) => input;
    validator.errors = null;
    // Chain methods that arktype supports
    validator.array = () => createValidator();
    validator.atLeastLength = () => createValidator();
    validator.optional = () => createValidator();
    return validator;
  };

  const mockType: any = (schema: unknown) => createValidator();
  mockType.or = (...validators: unknown[]) => createValidator();
  mockType.errors = class extends Array {
    summary = "Validation error";
  };

  return { type: mockType };
});

// Create a mock db
function createMockDb() {
  let insertReturning: unknown[] = [];

  return {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    then: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockImplementation(() => ({
      values: vi.fn().mockReturnThis(),
      returning: vi
        .fn()
        .mockImplementation(() => Promise.resolve(insertReturning)),
    })),
    _setInsertReturning: (result: unknown[]) => {
      insertReturning = result;
    },
  } as any;
}

// Helper to create mock context
function createMockContext(
  db: ReturnType<typeof createMockDb>,
  overrides: Partial<{
    user: { id: string; name: string; image: string | null };
    env: ReturnType<typeof createMockEnv>;
  }> = {},
) {
  return {
    db: db as any,
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

describe("recipeRouter - activity integration", () => {
  let mockDb: ReturnType<typeof createMockDb>;
  let mockEnv: ReturnType<typeof createMockEnv>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    mockEnv = createMockEnv();
    mockCreateRecipe.mockResolvedValue({ id: 1, name: "Test Recipe" });
  });

  describe("postRecipe - activity integration", () => {
    const validRecipeInput = {
      name: "Test Recipe",
      prepTime: 15,
      cookTime: 30,
      servings: 4,
      ingredients: [{ ingredient: "1 cup flour", index: 0 }],
      instructions: [{ instruction: "Mix ingredients", index: 0 }],
      images: [{ url: "https://example.com/image.jpg" }],
      cuisines: [],
      categories: [],
    };

    it("creates activity event on recipe import", async () => {
      mockDb._setInsertReturning([{ id: 100 }]);

      const ctx = createMockContext(mockDb, { env: mockEnv });
      const caller = recipeRouter.createCaller(ctx as any);

      await caller.postRecipe(validRecipeInput);

      // Verify insert was called for activity event
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it("triggers propagation to followers", async () => {
      mockDb._setInsertReturning([{ id: 100 }]);

      const ctx = createMockContext(mockDb, { env: mockEnv });
      const caller = recipeRouter.createCaller(ctx as any);

      await caller.postRecipe(validRecipeInput);

      // Allow async fire-and-forget to run
      await new Promise((r) => setTimeout(r, 0));

      expect(mockPropagateActivityToFollowers).toHaveBeenCalledWith(
        expect.anything(), // db
        expect.anything(), // env
        100, // activity event id
        "test-user-id", // user id
      );
    });

    it("recipe creation succeeds even if propagation fails", async () => {
      mockDb._setInsertReturning([{ id: 100 }]);
      mockPropagateActivityToFollowers.mockRejectedValueOnce(
        new Error("Propagation failed"),
      );

      const ctx = createMockContext(mockDb, { env: mockEnv });
      const caller = recipeRouter.createCaller(ctx as any);

      // Should not throw - propagation is fire-and-forget
      const result = await caller.postRecipe(validRecipeInput);

      expect(result.id).toBe(1);
      expect(result.name).toBe("Test Recipe");
    });

    it("does not propagate when activity event creation fails", async () => {
      // Empty array means no activity event was created
      mockDb._setInsertReturning([]);

      const ctx = createMockContext(mockDb, { env: mockEnv });
      const caller = recipeRouter.createCaller(ctx as any);

      await caller.postRecipe(validRecipeInput);

      // Allow async to settle
      await new Promise((r) => setTimeout(r, 0));

      // Propagation should not be called since no activity event was created
      expect(mockPropagateActivityToFollowers).not.toHaveBeenCalled();
    });
  });
});
