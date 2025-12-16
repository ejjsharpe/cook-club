import { describe, it, expect, vi, beforeEach } from "vitest";

import { RecipeParser } from "../../src/index";

// Valid AI response for mocking
const validAiResponse = JSON.stringify({
  name: "Test Recipe",
  description: "A delicious test recipe",
  prepTime: "PT15M",
  cookTime: "PT30M",
  totalTime: "PT45M",
  servings: 4,
  ingredients: [
    { quantity: 2, unit: "cup", name: "flour" },
    { quantity: 1, unit: "tsp", name: "salt" },
  ],
  instructions: ["Mix ingredients", "Bake at 350F"],
  suggestedTags: [{ type: "cuisine", name: "American" }],
});

// Sample HTML page
const sampleHtml = `
<html>
  <body>
    <article>
      <h1>Recipe Title</h1>
      <p>This is a recipe page.</p>
      <h2>Ingredients</h2>
      <ul>
        <li>2 cups flour</li>
        <li>1 tsp salt</li>
      </ul>
      <h2>Instructions</h2>
      <ol>
        <li>Mix everything</li>
        <li>Bake it</li>
      </ol>
    </article>
  </body>
</html>
`;

// Create mock environment
function createMockEnv() {
  const kvStore = new Map<string, string>();

  return {
    AI: {
      run: vi.fn().mockResolvedValue({ response: validAiResponse }),
    },
    RECIPE_CACHE: {
      get: vi.fn((key: string, type?: string) => {
        const value = kvStore.get(key);
        if (!value) return Promise.resolve(null);
        if (type === "json") return Promise.resolve(JSON.parse(value));
        return Promise.resolve(value);
      }),
      put: vi.fn((key: string, value: string) => {
        kvStore.set(key, value);
        return Promise.resolve();
      }),
    },
    _kvStore: kvStore,
  };
}

// Create parser instance with mock env
function createParser(env: ReturnType<typeof createMockEnv>) {
  const parser = new (RecipeParser as any)();
  parser.env = env;
  return parser;
}

describe("RecipeParser.parse()", () => {
  let mockEnv: ReturnType<typeof createMockEnv>;
  let parser: RecipeParser;

  beforeEach(() => {
    vi.restoreAllMocks();
    mockEnv = createMockEnv();
    parser = createParser(mockEnv);

    // Default: mock fetch to return sample HTML
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(sampleHtml),
    });
  });

  describe("URL parsing flow", () => {
    it("returns cached result on cache hit", async () => {
      const cachedRecipe = {
        name: "Cached Recipe",
        ingredients: [{ index: 0, name: "cached" }],
        instructions: [{ index: 0, instruction: "cached" }],
      };

      mockEnv.RECIPE_CACHE.get = vi.fn().mockResolvedValue(cachedRecipe);

      const result = await parser.parse({
        type: "url",
        data: "https://example.com/recipe",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.metadata.cached).toBe(true);
        expect(result.data.name).toBe("Cached Recipe");
      }
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("parses recipe using AI", async () => {
      const result = await parser.parse({
        type: "url",
        data: "https://example.com/recipe",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe("Test Recipe");
        expect(result.metadata.parseMethod).toBe("ai_only");
        expect(result.metadata.confidence).toBe("medium");
        expect(mockEnv.AI.run).toHaveBeenCalled();
      }
    });

    it("caches successful results", async () => {
      const result = await parser.parse({
        type: "url",
        data: "https://example.com/recipe",
      });

      expect(result.success).toBe(true);
      expect(mockEnv.RECIPE_CACHE.put).toHaveBeenCalled();
    });

    it("returns error on fetch failure", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found",
      });

      const result = await parser.parse({
        type: "url",
        data: "https://example.com/404",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("FETCH_FAILED");
      }
    });

    it("returns error when page has no content", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve("<html><body></body></html>"),
      });

      const result = await parser.parse({
        type: "url",
        data: "https://example.com/empty",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("NO_CONTENT");
      }
    });
  });

  describe("text parsing flow", () => {
    it("parses recipe from text using AI", async () => {
      const result = await parser.parse({
        type: "text",
        data: "Here is my recipe: Chocolate Cake. Ingredients: 2 cups flour, 1 cup sugar. Instructions: Mix and bake.",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe("Test Recipe");
        expect(result.metadata.source).toBe("text");
        expect(mockEnv.AI.run).toHaveBeenCalled();
      }
    });

    it("returns error for text too short", async () => {
      const result = await parser.parse({
        type: "text",
        data: "Too short",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("INVALID_INPUT");
      }
    });

    it("returns error for text too long", async () => {
      const longText = "A".repeat(15000);
      const result = await parser.parse({
        type: "text",
        data: longText,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("INPUT_TOO_LONG");
      }
    });
  });

  describe("image parsing flow", () => {
    it("parses recipe from image using AI", async () => {
      const base64Image = btoa("fake image data that is long enough");

      const result = await parser.parse({
        type: "image",
        data: base64Image,
        mimeType: "image/jpeg",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe("Test Recipe");
        expect(result.metadata.source).toBe("image");
      }
    });

    it("returns error for invalid mime type", async () => {
      const result = await parser.parse({
        type: "image",
        data: btoa("image"),
        mimeType: "image/gif" as any,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("INVALID_MIME_TYPE");
      }
    });

    it("returns error for invalid base64", async () => {
      const result = await parser.parse({
        type: "image",
        data: "not-valid-base64!!!",
        mimeType: "image/jpeg",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("INVALID_BASE64");
      }
    });

    it("accepts PNG images", async () => {
      const result = await parser.parse({
        type: "image",
        data: btoa("fake png data"),
        mimeType: "image/png",
      });

      expect(result.success).toBe(true);
    });

    it("accepts WebP images", async () => {
      const result = await parser.parse({
        type: "image",
        data: btoa("fake webp data"),
        mimeType: "image/webp",
      });

      expect(result.success).toBe(true);
    });
  });

  describe("error handling", () => {
    it("returns error for invalid input type", async () => {
      const result = await parser.parse({
        type: "invalid" as any,
        data: "test",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("INVALID_INPUT_TYPE");
      }
    });

    it("catches and returns AI errors gracefully", async () => {
      mockEnv.AI.run = vi.fn().mockRejectedValue(new Error("AI service down"));

      const result = await parser.parse({
        type: "url",
        data: "https://example.com/recipe",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("AI_PARSE_FAILED");
      }
    });
  });

  describe("metadata accuracy", () => {
    it("reports medium confidence for AI-parsed URLs", async () => {
      const result = await parser.parse({
        type: "url",
        data: "https://example.com/recipe",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.metadata.confidence).toBe("medium");
        expect(result.metadata.parseMethod).toBe("ai_only");
      }
    });

    it("reports correct source for each input type", async () => {
      const urlResult = await parser.parse({
        type: "url",
        data: "https://example.com",
      });
      expect(urlResult.success).toBe(true);
      if (urlResult.success) {
        expect(urlResult.metadata.source).toBe("url");
      }

      const textResult = await parser.parse({
        type: "text",
        data: "A recipe with enough content to be parsed properly by the system",
      });
      expect(textResult.success).toBe(true);
      if (textResult.success) {
        expect(textResult.metadata.source).toBe("text");
      }

      const imageResult = await parser.parse({
        type: "image",
        data: btoa("image data"),
        mimeType: "image/jpeg",
      });
      expect(imageResult.success).toBe(true);
      if (imageResult.success) {
        expect(imageResult.metadata.source).toBe("image");
      }
    });
  });
});

describe("default HTTP handler", () => {
  it("returns error response for direct HTTP access", async () => {
    const { default: handler } = await import("../../src/index");
    const mockRequest = new Request("https://example.com/");
    const mockEnv = { AI: {}, RECIPE_CACHE: {} } as any;
    const response = await handler.fetch(mockRequest, mockEnv);

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string };
    expect(body.error).toContain("RPC");
  });
});
