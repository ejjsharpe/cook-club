import { describe, expect, it, vi } from "vitest";

import { personalizeRecipe } from "../../../src/services/recipe-personalizer";

function createMockAi(response: unknown) {
  return {
    run: vi.fn().mockResolvedValue(response),
  };
}

const originalRecipe = {
  name: "Creamy Chicken Pasta",
  description: "A rich weeknight pasta.",
  prepTime: 10,
  cookTime: 20,
  totalTime: 30,
  servings: 4,
  sourceType: "manual" as const,
  images: ["https://example.com/pasta.jpg"],
  ingredientSections: [
    {
      name: null,
      ingredients: [
        { index: 0, quantity: 2, unit: "cup", name: "chicken" },
        { index: 1, quantity: 1, unit: "cup", name: "cream" },
      ],
    },
  ],
  instructionSections: [
    {
      name: null,
      instructions: [{ index: 0, instruction: "Cook the pasta." }],
    },
  ],
};

const personalizedRecipe = {
  name: "High-Protein Chicken Pasta",
  description: "A lighter, protein-rich weeknight pasta.",
  prepTime: 10,
  cookTime: 20,
  totalTime: 30,
  servings: 4,
  ingredientSections: [
    {
      name: null,
      ingredients: [
        { index: 0, quantity: 2, unit: "cup", name: "chicken breast" },
        { index: 1, quantity: 1, unit: "cup", name: "Greek yogurt" },
      ],
    },
  ],
  instructionSections: [
    {
      name: null,
      instructions: [{ index: 0, instruction: "Cook the pasta." }],
    },
  ],
};

describe("personalizeRecipe", () => {
  it("returns a parsed recipe response and preserves original images", async () => {
    const mockAi = createMockAi({ response: JSON.stringify(personalizedRecipe) });

    const result = await personalizeRecipe(mockAi as any, {
      recipe: originalRecipe,
      goals: ["high_protein"],
      allergyNotes: null,
      customNotes: null,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("High-Protein Chicken Pasta");
      expect(result.data.sourceType).toBe("ai");
      expect(result.data.images).toEqual(["https://example.com/pasta.jpg"]);
    }
  });

  it("accepts JSON wrapped in markdown code fences", async () => {
    const mockAi = createMockAi({
      response: `\`\`\`json\n${JSON.stringify(personalizedRecipe)}\n\`\`\``,
    });

    const result = await personalizeRecipe(mockAi as any, {
      recipe: originalRecipe,
      goals: ["healthier"],
      allergyNotes: null,
      customNotes: null,
    });

    expect(result.success).toBe(true);
  });

  it("includes goals and notes in the prompt", async () => {
    const mockAi = createMockAi({ response: JSON.stringify(personalizedRecipe) });

    await personalizeRecipe(mockAi as any, {
      recipe: originalRecipe,
      goals: ["vegan", "budget"],
      allergyNotes: "avoid peanuts",
      customNotes: "keep it Italian",
    });

    const call = mockAi.run.mock.calls[0]!;
    const userMessage = call[1].messages.find(
      (message: { role: string }) => message.role === "user",
    );

    expect(userMessage.content).toContain("make it vegan");
    expect(userMessage.content).toContain("make it cheaper");
    expect(userMessage.content).toContain("avoid peanuts");
    expect(userMessage.content).toContain("keep it Italian");
  });

  it("returns a failure response for invalid JSON", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const mockAi = createMockAi({ response: "not json" });

    const result = await personalizeRecipe(mockAi as any, {
      recipe: originalRecipe,
      goals: ["meal_prep"],
      allergyNotes: null,
      customNotes: null,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("PERSONALIZATION_ERROR");
    }
  });
});
