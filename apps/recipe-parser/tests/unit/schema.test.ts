import { ArkErrors } from "arktype";
import { describe, it, expect } from "vitest";

import {
  ParsedRecipeSchema,
  IngredientSchema,
  InstructionSchema,
  TagSchema,
} from "../../src/schema";

const isArkError = (result: unknown): boolean => result instanceof ArkErrors;

describe("IngredientSchema", () => {
  it("validates valid ingredient with all fields", () => {
    const ingredient = {
      index: 0,
      quantity: 2,
      unit: "cup",
      name: "flour",
    };
    const result = IngredientSchema(ingredient);
    expect(isArkError(result)).toBe(false);
  });

  it("validates ingredient with null quantity", () => {
    const ingredient = {
      index: 0,
      quantity: null,
      unit: null,
      name: "salt to taste",
    };
    const result = IngredientSchema(ingredient);
    expect(isArkError(result)).toBe(false);
  });

  it("validates ingredient without optional fields", () => {
    const ingredient = {
      index: 0,
      name: "eggs",
    };
    const result = IngredientSchema(ingredient);
    expect(isArkError(result)).toBe(false);
  });

  it("rejects negative index", () => {
    const ingredient = {
      index: -1,
      name: "flour",
    };
    const result = IngredientSchema(ingredient);
    expect(isArkError(result)).toBe(true);
  });

  it("rejects missing name", () => {
    const ingredient = {
      index: 0,
    };
    const result = IngredientSchema(ingredient);
    expect(isArkError(result)).toBe(true);
  });
});

describe("InstructionSchema", () => {
  it("validates valid instruction", () => {
    const instruction = {
      index: 0,
      instruction: "Preheat oven to 350°F",
    };
    const result = InstructionSchema(instruction);
    expect(isArkError(result)).toBe(false);
  });

  it("rejects missing instruction text", () => {
    const instruction = {
      index: 0,
    };
    const result = InstructionSchema(instruction);
    expect(isArkError(result)).toBe(true);
  });

  it("rejects negative index", () => {
    const instruction = {
      index: -1,
      instruction: "Step",
    };
    const result = InstructionSchema(instruction);
    expect(isArkError(result)).toBe(true);
  });
});

describe("TagSchema", () => {
  it("validates cuisine tag", () => {
    const tag = { type: "cuisine", name: "Italian" };
    const result = TagSchema(tag);
    expect(isArkError(result)).toBe(false);
  });

  it("validates meal_type tag", () => {
    const tag = { type: "meal_type", name: "Dinner" };
    const result = TagSchema(tag);
    expect(isArkError(result)).toBe(false);
  });

  it("validates occasion tag", () => {
    const tag = { type: "occasion", name: "Birthday" };
    const result = TagSchema(tag);
    expect(isArkError(result)).toBe(false);
  });

  it("rejects invalid tag type", () => {
    const tag = { type: "invalid", name: "Test" };
    const result = TagSchema(tag);
    expect(isArkError(result)).toBe(true);
  });
});

describe("ParsedRecipeSchema", () => {
  const validRecipe = {
    name: "Chocolate Cake",
    description: "A delicious cake",
    prepTime: "PT15M",
    cookTime: "PT30M",
    totalTime: "PT45M",
    servings: 8,
    sourceUrl: "https://example.com/recipe",
    ingredients: [
      { index: 0, quantity: 2, unit: "cup", name: "flour" },
      { index: 1, quantity: 1, unit: "cup", name: "sugar" },
    ],
    instructions: [
      { index: 0, instruction: "Preheat oven" },
      { index: 1, instruction: "Mix ingredients" },
    ],
    images: ["https://example.com/image.jpg"],
    suggestedTags: [{ type: "cuisine" as const, name: "American" }],
  };

  it("validates a complete valid recipe", () => {
    const result = ParsedRecipeSchema(validRecipe);
    expect(isArkError(result)).toBe(false);
  });

  it("validates recipe with minimal required fields", () => {
    const minimalRecipe = {
      name: "Simple Recipe",
      ingredients: [{ index: 0, name: "item" }],
      instructions: [{ index: 0, instruction: "Do something" }],
    };
    const result = ParsedRecipeSchema(minimalRecipe);
    expect(isArkError(result)).toBe(false);
  });

  it("validates recipe with null optional fields", () => {
    const recipeWithNulls = {
      name: "Test",
      description: null,
      prepTime: null,
      cookTime: null,
      totalTime: null,
      servings: null,
      sourceUrl: null,
      ingredients: [{ index: 0, name: "item" }],
      instructions: [{ index: 0, instruction: "step" }],
    };
    const result = ParsedRecipeSchema(recipeWithNulls);
    expect(isArkError(result)).toBe(false);
  });

  it("rejects recipe without name", () => {
    const { name, ...recipeWithoutName } = validRecipe;
    const result = ParsedRecipeSchema(recipeWithoutName);
    expect(isArkError(result)).toBe(true);
  });

  it("rejects recipe with empty ingredients", () => {
    const recipeWithEmptyIngredients = {
      ...validRecipe,
      ingredients: [],
    };
    const result = ParsedRecipeSchema(recipeWithEmptyIngredients);
    expect(isArkError(result)).toBe(true);
  });

  it("rejects recipe with empty instructions", () => {
    const recipeWithEmptyInstructions = {
      ...validRecipe,
      instructions: [],
    };
    const result = ParsedRecipeSchema(recipeWithEmptyInstructions);
    expect(isArkError(result)).toBe(true);
  });

  it("allows recipe with zero servings (optional field)", () => {
    const recipeWithZeroServings = {
      ...validRecipe,
      servings: 0,
    };
    const result = ParsedRecipeSchema(recipeWithZeroServings);
    // servings is optional and can be any number - 0 is valid
    expect(isArkError(result)).toBe(false);
  });

  it("allows recipe with negative servings (optional field)", () => {
    const recipeWithNegativeServings = {
      ...validRecipe,
      servings: -1,
    };
    const result = ParsedRecipeSchema(recipeWithNegativeServings);
    // servings is optional and the schema doesn't restrict the range
    expect(isArkError(result)).toBe(false);
  });

  it("validates recipe with empty images array", () => {
    const recipeWithNoImages = {
      ...validRecipe,
      images: [],
    };
    const result = ParsedRecipeSchema(recipeWithNoImages);
    expect(isArkError(result)).toBe(false);
  });

  it("validates recipe without optional tags", () => {
    const { suggestedTags, ...recipeWithoutTags } = validRecipe;
    const result = ParsedRecipeSchema(recipeWithoutTags);
    expect(isArkError(result)).toBe(false);
  });
});
