import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  parseRecipeFromText,
  parseRecipeFromHtml,
  parseRecipeFromImage,
} from "../../../src/services/ai-client";

// Mock AI binding
function createMockAi(response: string) {
  return {
    run: vi.fn().mockResolvedValue({ response }),
  };
}

const validRecipeJson = JSON.stringify({
  name: "Test Recipe",
  description: "A test recipe",
  prepTime: "PT10M",
  cookTime: "PT20M",
  totalTime: "PT30M",
  servings: 4,
  ingredientSections: [
    {
      name: null,
      ingredients: [
        { index: 0, quantity: 2, unit: "cup", name: "flour" },
        { index: 1, quantity: 1, unit: "tsp", name: "salt" },
      ],
    },
  ],
  instructionSections: [
    {
      name: null,
      instructions: [
        { index: 0, instruction: "Mix ingredients" },
        { index: 1, instruction: "Bake at 350F" },
      ],
    },
  ],
  suggestedTags: [{ type: "cuisine", name: "American" }],
});

describe("parseRecipeFromText", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("parses valid AI response", async () => {
    const mockAi = createMockAi(validRecipeJson);
    const result = await parseRecipeFromText(mockAi as any, "Recipe text here");

    expect(result.name).toBe("Test Recipe");
    expect(result.ingredientSections).toHaveLength(1);
    expect(result.ingredientSections[0]?.ingredients).toHaveLength(2);
    expect(result.instructionSections).toHaveLength(1);
    expect(result.instructionSections[0]?.instructions).toHaveLength(2);
    expect(mockAi.run).toHaveBeenCalled();
  });

  it("handles JSON wrapped in markdown code blocks", async () => {
    const wrappedJson = "```json\n" + validRecipeJson + "\n```";
    const mockAi = createMockAi(wrappedJson);
    const result = await parseRecipeFromText(mockAi as any, "Recipe text");

    expect(result.name).toBe("Test Recipe");
  });

  it("handles JSON wrapped in plain code blocks", async () => {
    const wrappedJson = "```\n" + validRecipeJson + "\n```";
    const mockAi = createMockAi(wrappedJson);
    const result = await parseRecipeFromText(mockAi as any, "Recipe text");

    expect(result.name).toBe("Test Recipe");
  });

  it("throws error on invalid JSON response", async () => {
    const mockAi = createMockAi("This is not JSON");

    await expect(
      parseRecipeFromText(mockAi as any, "Recipe text"),
    ).rejects.toThrow("Failed to parse AI response as JSON");
  });

  it("throws error on empty response", async () => {
    const mockAi = {
      run: vi.fn().mockResolvedValue({ response: "" }),
    };

    await expect(
      parseRecipeFromText(mockAi as any, "Recipe text"),
    ).rejects.toThrow("Invalid AI response format");
  });

  it("handles response object with generated_text field", async () => {
    const mockAi = {
      run: vi.fn().mockResolvedValue({ generated_text: validRecipeJson }),
    };
    const result = await parseRecipeFromText(mockAi as any, "Recipe text");

    expect(result.name).toBe("Test Recipe");
  });

  it("handles string response directly", async () => {
    const mockAi = {
      run: vi.fn().mockResolvedValue(validRecipeJson),
    };
    const result = await parseRecipeFromText(mockAi as any, "Recipe text");

    expect(result.name).toBe("Test Recipe");
  });
});

describe("parseRecipeFromHtml", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("parses valid AI response from HTML", async () => {
    const mockAi = createMockAi(validRecipeJson);
    const result = await parseRecipeFromHtml(
      mockAi as any,
      "Clean HTML content",
    );

    expect(result.name).toBe("Test Recipe");
    expect(mockAi.run).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({ role: "system" }),
          expect.objectContaining({ role: "user" }),
        ]),
      }),
    );
  });

  it("includes HTML content in the prompt", async () => {
    const mockAi = createMockAi(validRecipeJson);
    await parseRecipeFromHtml(mockAi as any, "My recipe HTML content");

    const call = mockAi.run.mock.calls[0]!;
    const userMessage = call[1].messages.find(
      (m: { role: string }) => m.role === "user",
    );
    expect(userMessage.content).toContain("My recipe HTML content");
  });
});

describe("parseRecipeFromImage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("parses valid AI response from image", async () => {
    const mockAi = createMockAi(validRecipeJson);
    const base64Image = btoa("fake image data");
    const result = await parseRecipeFromImage(
      mockAi as any,
      base64Image,
      "image/jpeg",
    );

    expect(result.name).toBe("Test Recipe");
    expect(mockAi.run).toHaveBeenCalled();
  });

  it("converts base64 to Uint8Array for AI model", async () => {
    const mockAi = createMockAi(validRecipeJson);
    const base64Image = btoa("test image");
    await parseRecipeFromImage(mockAi as any, base64Image, "image/jpeg");

    const call = mockAi.run.mock.calls[0]!;
    const userMessage = call[1].messages.find(
      (m: { role: string }) => m.role === "user",
    );
    expect(userMessage.content).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "image" })]),
    );
  });

  it("throws error on invalid AI response", async () => {
    const mockAi = createMockAi("Not valid JSON");
    const base64Image = btoa("fake image");

    await expect(
      parseRecipeFromImage(mockAi as any, base64Image, "image/png"),
    ).rejects.toThrow("Failed to parse AI response as JSON");
  });
});

describe("AI response parsing edge cases", () => {
  it("handles recipe with null fields", async () => {
    const recipeWithNulls = JSON.stringify({
      name: "Simple Recipe",
      description: null,
      prepTime: null,
      cookTime: null,
      totalTime: null,
      servings: null,
      ingredientSections: [
        {
          name: null,
          ingredients: [
            { index: 0, quantity: null, unit: null, name: "something" },
          ],
        },
      ],
      instructionSections: [
        {
          name: null,
          instructions: [{ index: 0, instruction: "Do it" }],
        },
      ],
    });
    const mockAi = createMockAi(recipeWithNulls);
    const result = await parseRecipeFromText(mockAi as any, "Recipe");

    expect(result.name).toBe("Simple Recipe");
    expect(result.description).toBeNull();
    expect(result.ingredientSections[0]!.ingredients[0]!.quantity).toBeNull();
  });

  it("handles recipe without optional suggestedTags", async () => {
    const recipeWithoutTags = JSON.stringify({
      name: "No Tags Recipe",
      description: "Test",
      ingredientSections: [
        {
          name: null,
          ingredients: [{ index: 0, quantity: 1, unit: "cup", name: "flour" }],
        },
      ],
      instructionSections: [
        {
          name: null,
          instructions: [{ index: 0, instruction: "Mix" }],
        },
      ],
    });
    const mockAi = createMockAi(recipeWithoutTags);
    const result = await parseRecipeFromText(mockAi as any, "Recipe");

    expect(result.name).toBe("No Tags Recipe");
    expect(result.suggestedTags).toBeUndefined();
  });
});
