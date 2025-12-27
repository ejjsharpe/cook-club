import type { ParsedRecipe, Ingredient, Instruction } from "../schema";
import { ParsedRecipeSchema } from "../schema";
import type { Env, ParseResult } from "../types";
import { parseRecipeFromText, type AiRecipeResult } from "./ai-client";
import { normalizeUnit } from "../utils/unit-normalizer";

/**
 * Convert AI result to ParsedRecipe format
 */
function aiResultToRecipe(ai: AiRecipeResult): ParsedRecipe {
  const ingredients: Ingredient[] = ai.ingredients.map((ing, index) => ({
    index,
    quantity: ing.quantity,
    unit: ing.unit ? normalizeUnit(ing.unit) : null,
    name: ing.name,
  }));

  const instructions: Instruction[] = ai.instructions.map((inst, index) => ({
    index,
    instruction: inst.text,
    imageUrl: inst.imageUrl || null,
  }));

  return {
    name: ai.name,
    description: ai.description,
    prepTime: ai.prepTime,
    cookTime: ai.cookTime,
    totalTime: ai.totalTime,
    servings: ai.servings,
    sourceUrl: null,
    sourceType: "text" as const,
    ingredients,
    instructions,
    images: [],
    suggestedTags: ai.suggestedTags,
  };
}

/**
 * Parse a recipe from free-form text
 */
export async function parseText(env: Env, text: string): Promise<ParseResult> {
  // Validate input
  if (!text || text.trim().length < 50) {
    return {
      success: false,
      error: {
        code: "INVALID_INPUT",
        message: "Text must be at least 50 characters",
      },
    };
  }

  if (text.length > 10000) {
    return {
      success: false,
      error: {
        code: "INPUT_TOO_LONG",
        message: "Text must be under 10,000 characters",
      },
    };
  }

  try {
    const aiResult = await parseRecipeFromText(env.AI, text.trim());
    const recipe = aiResultToRecipe(aiResult);

    // Validate against schema
    const validation = ParsedRecipeSchema(recipe);

    if (validation instanceof Error) {
      return {
        success: false,
        error: {
          code: "VALIDATION_FAILED",
          message: "AI output did not match expected schema",
        },
      };
    }

    // Determine confidence based on completeness
    let confidence: "high" | "medium" | "low" = "medium";
    if (
      recipe.ingredients.length >= 3 &&
      recipe.instructions.length >= 2 &&
      recipe.name.length > 3
    ) {
      confidence = "high";
    } else if (
      recipe.ingredients.length < 2 ||
      recipe.instructions.length < 1
    ) {
      confidence = "low";
    }

    return {
      success: true,
      data: recipe,
      metadata: {
        source: "text",
        confidence,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: "AI_PARSE_FAILED",
        message: error instanceof Error ? error.message : "AI parsing failed",
      },
    };
  }
}
