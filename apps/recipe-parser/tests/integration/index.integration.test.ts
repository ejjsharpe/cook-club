import { env, createExecutionContext, SELF } from "cloudflare:test";
import { describe, it, expect, beforeEach, vi } from "vitest";

import { RecipeParser } from "../../src/index";

// Valid AI response for mocking
const validAiResponse = JSON.stringify({
  name: "Classic Chocolate Chip Cookies",
  description: "Delicious homemade cookies",
  prepTime: "PT15M",
  cookTime: "PT10M",
  totalTime: "PT25M",
  servings: 24,
  ingredients: [
    { quantity: 2.25, unit: "cups", name: "all-purpose flour" },
    { quantity: 1, unit: "tsp", name: "baking soda" },
    { quantity: 1, unit: "cup", name: "butter, softened" },
    { quantity: 0.75, unit: "cup", name: "granulated sugar" },
    { quantity: 2, unit: "cups", name: "chocolate chips" },
  ],
  instructions: [
    "Preheat oven to 375°F",
    "Mix flour and baking soda in a bowl",
    "Beat butter and sugar until creamy",
    "Combine wet and dry ingredients",
    "Fold in chocolate chips",
    "Bake for 9 to 11 minutes",
  ],
  suggestedTags: [{ type: "cuisine", name: "American" }],
});

// Sample HTML page (AI will parse this)
const sampleRecipeHtml = `
<!DOCTYPE html>
<html>
  <head><title>Classic Chocolate Chip Cookies</title></head>
  <body>
    <article>
      <h1>Classic Chocolate Chip Cookies</h1>
      <p>Delicious homemade cookies that are crispy on the outside and chewy on the inside.</p>

      <h2>Ingredients</h2>
      <ul>
        <li>2 1/4 cups all-purpose flour</li>
        <li>1 teaspoon baking soda</li>
        <li>1 cup butter, softened</li>
        <li>3/4 cup granulated sugar</li>
        <li>2 cups chocolate chips</li>
      </ul>

      <h2>Instructions</h2>
      <ol>
        <li>Preheat oven to 375°F</li>
        <li>Mix flour and baking soda in a bowl</li>
        <li>Beat butter and sugar until creamy</li>
        <li>Combine wet and dry ingredients</li>
        <li>Fold in chocolate chips</li>
        <li>Bake for 9 to 11 minutes</li>
      </ol>

      <p>Makes about 24 cookies. Prep time: 15 minutes. Cook time: 10 minutes.</p>
    </article>
  </body>
</html>
`;

describe("RecipeParser Integration Tests", () => {
  let parser: RecipeParser;
  let mockEnv: typeof env;

  beforeEach(() => {
    // Create a mock env with AI binding
    mockEnv = {
      ...env,
      AI: {
        run: vi.fn().mockResolvedValue({ response: validAiResponse }),
      },
    } as unknown as typeof env;
    parser = new RecipeParser(createExecutionContext(), mockEnv);
  });

  describe("URL parsing with AI", () => {
    beforeEach(() => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          text: () => Promise.resolve(sampleRecipeHtml),
        }),
      );
    });

    it("parses recipe from HTML using AI", async () => {
      const result = await parser.parse({
        type: "url",
        data: "https://example.com/cookies-recipe",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        // Name comes from AI mock response
        expect(result.data.name).toBe("Classic Chocolate Chip Cookies");
        expect(result.data.ingredients.length).toBe(5);
        expect(result.data.instructions.length).toBe(6);
        expect(result.metadata.parseMethod).toBe("ai_only");
        expect(result.metadata.source).toBe("url");
      }
    });

    it("extracts ingredients with quantities", async () => {
      const result = await parser.parse({
        type: "url",
        data: "https://example.com/cookies-recipe",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        // Check that all ingredients from mock have quantities
        const withQuantities = result.data.ingredients.filter(
          (i) => i.quantity !== null,
        );
        expect(withQuantities.length).toBe(5);
        // Verify first ingredient
        expect(result.data.ingredients[0]?.quantity).toBe(2.25);
        expect(result.data.ingredients[0]?.name).toBe("all-purpose flour");
      }
    });
  });

  describe("KV caching", () => {
    beforeEach(() => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          text: () => Promise.resolve(sampleRecipeHtml),
        }),
      );
    });

    it("caches parsed recipes in KV", async () => {
      const url = "https://example.com/cache-test-" + Date.now();

      // First request - should fetch and cache
      const result1 = await parser.parse({ type: "url", data: url });
      expect(result1.success).toBe(true);
      if (result1.success) {
        expect(result1.metadata.cached).toBeFalsy();
      }

      // Create new parser with same env to test cache persistence
      const parser2 = new RecipeParser(createExecutionContext(), mockEnv);

      // Second request - should hit cache
      const result2 = await parser2.parse({ type: "url", data: url });
      expect(result2.success).toBe(true);
      if (result2.success) {
        expect(result2.metadata.cached).toBe(true);
      }
    });

    it("returns cached data without re-fetching", async () => {
      const url = "https://example.com/no-refetch-" + Date.now();
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(sampleRecipeHtml),
      });
      vi.stubGlobal("fetch", fetchMock);

      // First request
      await parser.parse({ type: "url", data: url });
      expect(fetchMock).toHaveBeenCalledTimes(1);

      // Create new parser with same env to test cache persistence
      const parser2 = new RecipeParser(createExecutionContext(), mockEnv);

      // Second request - should not fetch again
      await parser2.parse({ type: "url", data: url });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("text parsing with AI", () => {
    it("parses recipe from plain text", async () => {
      const recipeText = `
        Simple Pasta Recipe

        Ingredients:
        - 1 lb spaghetti
        - 2 cups marinara sauce
        - 1/4 cup parmesan cheese

        Instructions:
        1. Boil pasta according to package directions
        2. Drain and return to pot
        3. Add sauce and toss to coat
        4. Serve with parmesan on top

        Serves 4
      `;

      const result = await parser.parse({
        type: "text",
        data: recipeText,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        // Name comes from AI mock response
        expect(result.data.name).toBe("Classic Chocolate Chip Cookies");
        expect(result.data.ingredients.length).toBeGreaterThan(0);
        expect(result.data.instructions.length).toBeGreaterThan(0);
        expect(result.metadata.source).toBe("text");
      }
    });

    it("rejects text that is too short", async () => {
      const result = await parser.parse({
        type: "text",
        data: "Too short",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("INVALID_INPUT");
      }
    });

    it("rejects text that is too long", async () => {
      const result = await parser.parse({
        type: "text",
        data: "A".repeat(15000),
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("INPUT_TOO_LONG");
      }
    });
  });

  describe("error handling", () => {
    it("returns error for failed HTTP requests", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 404,
          statusText: "Not Found",
        }),
      );

      const result = await parser.parse({
        type: "url",
        data: "https://example.com/not-found",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("FETCH_FAILED");
      }
    });

    it("returns error for network failures", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockRejectedValue(new Error("Network error")),
      );

      const result = await parser.parse({
        type: "url",
        data: "https://example.com/network-error",
      });

      expect(result.success).toBe(false);
    });

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
  });

  describe("image parsing", () => {
    it("rejects invalid mime types", async () => {
      const result = await parser.parse({
        type: "image",
        data: btoa("fake image"),
        mimeType: "image/gif" as any,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("INVALID_MIME_TYPE");
      }
    });

    it("rejects invalid base64 data", async () => {
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
  });

  describe("HTTP handler", () => {
    it("rejects direct HTTP requests with 400", async () => {
      const response = await SELF.fetch("https://fake-host/");

      expect(response.status).toBe(400);
      const body = (await response.json()) as { error: string };
      expect(body.error).toContain("RPC");
    });
  });
});
