import { describe, it, expect, vi, beforeEach } from "vitest";

import { recipeRouter } from "./recipe-router";
import { createMockEnv } from "../__mocks__/env";

const mocks = vi.hoisted(() => ({
  propagateActivityToFollowers: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../services/activity", () => ({
  propagateActivityToFollowers: mocks.propagateActivityToFollowers,
}));

// Mock the recipe service
const mockCreateRecipe = vi.fn();
const mockUpdateRecipe = vi.fn();
const mockGetRecipeDetail = vi.fn();
const mockValidateTags = vi.fn().mockResolvedValue(undefined);

vi.mock("@repo/db/services", () => ({
  createRecipe: (...args: unknown[]) => mockCreateRecipe(...args),
  updateRecipe: (...args: unknown[]) => mockUpdateRecipe(...args),
  getRecipeDetail: (...args: unknown[]) => mockGetRecipeDetail(...args),
  importRecipe: vi.fn(),
  queryPopularRecipesThisWeek: vi.fn(),
  ServiceError: class ServiceError extends Error {
    code = "INTERNAL_ERROR";
  },
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
  lt: vi.fn((a, b) => ({ type: "lt", field: a, value: b })),
  desc: vi.fn((a) => ({ type: "desc", field: a })),
  asc: vi.fn((a) => ({ type: "asc", field: a })),
  and: vi.fn((...args) => ({ type: "and", conditions: args })),
  or: vi.fn((...args) => ({ type: "or", conditions: args })),
  ilike: vi.fn((a, b) => ({ type: "ilike", field: a, pattern: b })),
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
  let insertError: unknown = null;

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
        .mockImplementation(() =>
          insertError
            ? Promise.reject(insertError)
            : Promise.resolve(insertReturning),
        ),
    })),
    _setInsertReturning: (result: unknown[]) => {
      insertReturning = result;
    },
    _setInsertError: (error: unknown) => {
      insertError = error;
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
    mocks.propagateActivityToFollowers.mockResolvedValue(undefined);
    mockDb = createMockDb();
    mockEnv = createMockEnv();
    mockCreateRecipe.mockResolvedValue({ id: 1, name: "Test Recipe" });
    mockUpdateRecipe.mockResolvedValue({ id: 1 });
    mockGetRecipeDetail.mockResolvedValue({
      id: 1,
      name: "Creamy Pasta",
      description: "A weeknight pasta.",
      prepTime: 10,
      cookTime: 20,
      totalTime: 30,
      servings: 4,
      sourceUrl: null,
      sourceType: "manual",
      images: [{ id: 1, url: "https://example.com/pasta.jpg" }],
      ingredientSections: [
        {
          id: 1,
          name: null,
          index: 0,
          ingredients: [
            {
              id: 1,
              index: 0,
              quantity: "1",
              unit: "cup",
              name: "cream",
              preparation: null,
            },
          ],
        },
      ],
      instructionSections: [
        {
          id: 1,
          name: null,
          index: 0,
          instructions: [
            {
              id: 1,
              index: 0,
              instruction: "Cook pasta.",
              imageUrl: null,
            },
          ],
        },
      ],
      tags: [],
    });
  });

  describe("postRecipe - activity integration", () => {
    const validRecipeInput = {
      name: "Test Recipe",
      prepTime: 15,
      cookTime: 30,
      servings: 4,
      ingredientSections: [
        {
          name: null,
          ingredients: [{ ingredient: "1 cup flour", index: 0 }],
        },
      ],
      instructionSections: [
        {
          name: null,
          instructions: [{ instruction: "Mix ingredients", index: 0 }],
        },
      ],
      images: [{ url: "https://example.com/image.jpg" }],
      cuisines: [],
      categories: [],
    };

    it("creates activity event on recipe import", async () => {
      mockDb._setInsertReturning([{ id: 100, createdAt: new Date() }]);

      const ctx = createMockContext(mockDb, { env: mockEnv });
      const caller = recipeRouter.createCaller(ctx as any);

      await caller.postRecipe(validRecipeInput);

      // Verify insert was called for activity event
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it("triggers propagation to followers", async () => {
      mockDb._setInsertReturning([{ id: 100, createdAt: new Date() }]);

      const ctx = createMockContext(mockDb, { env: mockEnv });
      const caller = recipeRouter.createCaller(ctx as any);

      await caller.postRecipe(validRecipeInput);

      // Allow async fire-and-forget to run
      await new Promise((r) => setTimeout(r, 0));

      expect(mocks.propagateActivityToFollowers).toHaveBeenCalledWith(
        expect.anything(), // db
        expect.anything(), // env
        100, // activity event id
        "test-user-id", // user id
        expect.any(Date),
      );
    });

    it("recipe creation succeeds even if propagation fails", async () => {
      mockDb._setInsertReturning([{ id: 100, createdAt: new Date() }]);
      mocks.propagateActivityToFollowers.mockRejectedValueOnce(
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
      expect(mocks.propagateActivityToFollowers).not.toHaveBeenCalled();
    });

    it("cleans up moved images when recipe creation fails", async () => {
      mockEnv.IMAGE_WORKER.move.mockResolvedValue({
        success: true,
        results: [
          {
            from: "temp/abc.jpg",
            to: "recipes/covers/group/img.jpg",
            success: true,
          },
        ],
      });
      mockCreateRecipe.mockRejectedValueOnce(new Error("Recipe insert failed"));

      const ctx = createMockContext(mockDb, { env: mockEnv });
      const caller = recipeRouter.createCaller(ctx as any);
      const { images: _images, ...uploadRecipeInput } = validRecipeInput;

      await expect(
        caller.postRecipe({
          ...uploadRecipeInput,
          imageUploadIds: ["temp/abc.jpg"],
        }),
      ).rejects.toThrow();

      expect(mockEnv.IMAGE_WORKER.delete).toHaveBeenCalledWith([
        expect.stringMatching(/^recipes\/covers\/.+\/.+\.jpg$/),
      ]);
    });

    it("does not clean up moved images after recipe creation succeeds", async () => {
      mockEnv.IMAGE_WORKER.move.mockResolvedValue({
        success: true,
        results: [
          {
            from: "temp/abc.jpg",
            to: "recipes/covers/group/img.jpg",
            success: true,
          },
        ],
      });
      mockDb._setInsertError(new Error("Activity insert failed"));

      const ctx = createMockContext(mockDb, { env: mockEnv });
      const caller = recipeRouter.createCaller(ctx as any);
      const { images: _images, ...uploadRecipeInput } = validRecipeInput;

      await expect(
        caller.postRecipe({
          ...uploadRecipeInput,
          imageUploadIds: ["temp/abc.jpg"],
        }),
      ).rejects.toThrow();

      expect(mockEnv.IMAGE_WORKER.delete).not.toHaveBeenCalled();
    });
  });

  describe("updateRecipe", () => {
    const validRecipeInput = {
      recipeId: 1,
      name: "Updated Recipe",
      prepTime: 10,
      cookTime: 25,
      servings: 4,
      ingredientSections: [
        {
          name: null,
          ingredients: [{ ingredient: "1 cup flour", index: 0 }],
        },
      ],
      instructionSections: [
        {
          name: null,
          instructions: [{ instruction: "Mix ingredients", index: 0 }],
        },
      ],
      images: [{ url: "https://example.com/image.jpg" }],
      cuisines: [],
      categories: [],
    };

    it("updates a recipe through the recipe service", async () => {
      const ctx = createMockContext(mockDb, { env: mockEnv });
      const caller = recipeRouter.createCaller(ctx as any);

      const result = await caller.updateRecipe(validRecipeInput);

      expect(result.id).toBe(1);
      expect(mockUpdateRecipe).toHaveBeenCalledWith(
        mockDb,
        "test-user-id",
        expect.objectContaining({
          recipeId: 1,
          name: "Updated Recipe",
          images: [{ url: "https://example.com/image.jpg" }],
        }),
      );
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it("rejects updates without a non-empty ingredient", async () => {
      const ctx = createMockContext(mockDb, { env: mockEnv });
      const caller = recipeRouter.createCaller(ctx as any);

      await expect(
        caller.updateRecipe({
          ...validRecipeInput,
          ingredientSections: [
            {
              name: null,
              ingredients: [{ ingredient: "   ", index: 0 }],
            },
          ],
        }),
      ).rejects.toThrow("At least one ingredient is required");

      expect(mockUpdateRecipe).not.toHaveBeenCalled();
    });

    it("cleans up moved images when recipe update fails", async () => {
      mockEnv.IMAGE_WORKER.move.mockResolvedValue({
        success: true,
        results: [
          {
            from: "temp/abc.jpg",
            to: "recipes/covers/group/img.jpg",
            success: true,
          },
        ],
      });
      mockUpdateRecipe.mockRejectedValueOnce(new Error("Recipe update failed"));

      const ctx = createMockContext(mockDb, { env: mockEnv });
      const caller = recipeRouter.createCaller(ctx as any);
      const { images: _images, ...uploadRecipeInput } = validRecipeInput;

      await expect(
        caller.updateRecipe({
          ...uploadRecipeInput,
          imageUploadIds: ["temp/abc.jpg"],
        }),
      ).rejects.toThrow();

      expect(mockEnv.IMAGE_WORKER.delete).toHaveBeenCalledWith([
        expect.stringMatching(/^recipes\/covers\/.+\/.+\.jpg$/),
      ]);
    });
  });

  describe("personalizeRecipe", () => {
    it("calls the recipe parser with the current user's recipe detail", async () => {
      mockEnv.RECIPE_PARSER.personalize.mockResolvedValue({
        success: true,
        data: {
          name: "Vegan Pasta",
          ingredientSections: [
            {
              name: null,
              ingredients: [{ index: 0, quantity: 1, unit: "cup", name: "cashews" }],
            },
          ],
          instructionSections: [
            {
              name: null,
              instructions: [{ index: 0, instruction: "Cook pasta." }],
            },
          ],
          images: ["https://example.com/pasta.jpg"],
          sourceType: "ai",
        },
        metadata: {
          source: "text",
          parseMethod: "ai_only",
          confidence: "medium",
        },
      });

      const ctx = createMockContext(mockDb, { env: mockEnv });
      const caller = recipeRouter.createCaller(ctx as any);

      const result = await caller.personalizeRecipe({
        recipeId: 1,
        goals: ["vegan"],
        allergyNotes: "avoid dairy",
        customNotes: "keep it quick",
      });

      expect(result.success).toBe(true);
      expect(mockGetRecipeDetail).toHaveBeenCalledWith(
        mockDb,
        1,
        "test-user-id",
      );
      expect(mockEnv.RECIPE_PARSER.personalize).toHaveBeenCalledWith(
        expect.objectContaining({
          goals: ["vegan"],
          allergyNotes: "avoid dairy",
          customNotes: "keep it quick",
          recipe: expect.objectContaining({
            name: "Creamy Pasta",
            images: ["https://example.com/pasta.jpg"],
          }),
        }),
      );
    });

    it("maps parser failures to a bad request", async () => {
      mockEnv.RECIPE_PARSER.personalize.mockResolvedValue({
        success: false,
        error: {
          code: "PERSONALIZATION_ERROR",
          message: "Failed to personalise recipe",
        },
      });

      const ctx = createMockContext(mockDb, { env: mockEnv });
      const caller = recipeRouter.createCaller(ctx as any);

      await expect(
        caller.personalizeRecipe({
          recipeId: 1,
          goals: ["meal_prep"],
        }),
      ).rejects.toThrow("Failed to personalise recipe");
    });
  });
});
