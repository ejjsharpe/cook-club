import { describe, it, expect, vi, beforeEach } from "vitest";

import type { ParsedRecipe } from "../../../src/schema";
import { getCachedRecipe, cacheRecipe } from "../../../src/services/cache";

// Mock KV namespace
function createMockKv() {
  const store = new Map<string, string>();
  return {
    get: vi.fn((key: string, type?: string) => {
      const value = store.get(key);
      if (!value) return Promise.resolve(null);
      if (type === "json") return Promise.resolve(JSON.parse(value));
      return Promise.resolve(value);
    }),
    put: vi.fn(
      (key: string, value: string, _options?: { expirationTtl?: number }) => {
        store.set(key, value);
        return Promise.resolve();
      },
    ),
    _store: store,
  };
}

const mockRecipe: ParsedRecipe = {
  name: "Test Recipe",
  description: "A test",
  prepTime: "PT10M",
  cookTime: "PT20M",
  totalTime: "PT30M",
  servings: 4,
  sourceUrl: "https://example.com/recipe",
  ingredients: [{ index: 0, quantity: 2, unit: "cup", name: "flour" }],
  instructions: [{ index: 0, instruction: "Mix" }],
  images: ["https://example.com/img.jpg"],
  suggestedTags: [{ type: "cuisine", name: "American" }],
};

describe("getCachedRecipe", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns cached recipe when found", async () => {
    const mockKv = createMockKv();
    const url = "https://example.com/recipe";

    // Pre-populate cache
    await cacheRecipe(mockKv as any, url, mockRecipe);

    const result = await getCachedRecipe(mockKv as any, url);
    expect(result).toEqual(mockRecipe);
  });

  it("returns null when recipe not in cache", async () => {
    const mockKv = createMockKv();
    const result = await getCachedRecipe(
      mockKv as any,
      "https://notcached.com",
    );
    expect(result).toBeNull();
  });

  it("uses consistent key generation for same URL", async () => {
    const mockKv = createMockKv();
    const url = "https://example.com/recipe";

    await cacheRecipe(mockKv as any, url, mockRecipe);
    const result = await getCachedRecipe(mockKv as any, url);

    expect(result).not.toBeNull();
    expect(mockKv.get).toHaveBeenCalled();
  });

  it("generates different keys for different URLs", async () => {
    const mockKv = createMockKv();

    await cacheRecipe(mockKv as any, "https://example.com/recipe1", mockRecipe);
    await cacheRecipe(mockKv as any, "https://example.com/recipe2", mockRecipe);

    // Both should be stored separately
    expect(mockKv._store.size).toBe(2);
  });
});

describe("cacheRecipe", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("stores recipe in KV", async () => {
    const mockKv = createMockKv();
    const url = "https://example.com/recipe";

    await cacheRecipe(mockKv as any, url, mockRecipe);

    expect(mockKv.put).toHaveBeenCalledWith(
      expect.stringMatching(/^recipe:/),
      expect.any(String),
      expect.objectContaining({ expirationTtl: 86400 }),
    );
  });

  it("serializes recipe to JSON", async () => {
    const mockKv = createMockKv();
    const url = "https://example.com/recipe";

    await cacheRecipe(mockKv as any, url, mockRecipe);

    const call = mockKv.put.mock.calls[0]!;
    const storedValue = call[1] as string;

    expect(() => JSON.parse(storedValue)).not.toThrow();
    expect(JSON.parse(storedValue)).toEqual(mockRecipe);
  });

  it("sets 24 hour TTL", async () => {
    const mockKv = createMockKv();

    await cacheRecipe(mockKv as any, "https://example.com", mockRecipe);

    const call = mockKv.put.mock.calls[0]!;
    expect((call[2] as { expirationTtl: number }).expirationTtl).toBe(86400); // 24 hours in seconds
  });

  it("handles URLs with query params consistently", async () => {
    const mockKv = createMockKv();
    const url = "https://example.com/recipe?id=123&utm=test";

    await cacheRecipe(mockKv as any, url, mockRecipe);
    const result = await getCachedRecipe(mockKv as any, url);

    expect(result).toEqual(mockRecipe);
  });

  it("normalizes URL case for cache key", async () => {
    const mockKv = createMockKv();

    await cacheRecipe(mockKv as any, "https://EXAMPLE.com/Recipe", mockRecipe);
    const result = await getCachedRecipe(
      mockKv as any,
      "https://example.com/recipe",
    );

    expect(result).toEqual(mockRecipe);
  });
});

describe("cache key generation", () => {
  it("generates consistent keys for same URL", async () => {
    const mockKv = createMockKv();
    const url = "https://example.com/recipe";

    // Cache twice with same URL
    await cacheRecipe(mockKv as any, url, mockRecipe);
    await cacheRecipe(mockKv as any, url, mockRecipe);

    // Should have called put with same key twice
    const keys = mockKv.put.mock.calls.map((call) => call[0]);
    expect(keys[0]).toBe(keys[1]);
  });

  it("prefixes keys with 'recipe:'", async () => {
    const mockKv = createMockKv();

    await cacheRecipe(mockKv as any, "https://example.com", mockRecipe);

    const key = mockKv.put.mock.calls[0]![0];
    expect(key).toMatch(/^recipe:/);
  });
});
