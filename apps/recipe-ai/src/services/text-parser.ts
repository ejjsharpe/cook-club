import type {
  ParsedRecipe,
  IngredientSection,
  InstructionSection,
} from "../schema";
import { ParsedRecipeSchema } from "../schema";
import type { Env, ParseResult } from "../types";
import { parseRecipeFromText, type AiRecipeResult } from "./ai-client";
import { normalizeUnit } from "../utils/unit-normalizer";

/**
 * Convert AI result to ParsedRecipe format
 */
function aiResultToRecipe(ai: AiRecipeResult): ParsedRecipe {
  // Map AI ingredient sections to our format
  const ingredientSections: IngredientSection[] = ai.ingredientSections.map(
    (section) => ({
      name: section.name,
      ingredients: section.ingredients.map((ing, index) => ({
        index,
        quantity: ing.quantity,
        unit: ing.unit ? normalizeUnit(ing.unit) : null,
        name: ing.name,
      })),
    }),
  );

  // Map AI instruction sections to our format
  const instructionSections: InstructionSection[] = ai.instructionSections.map(
    (section) => ({
      name: section.name,
      instructions: section.instructions.map((inst, index) => ({
        index,
        instruction: inst.instruction,
        imageUrl: inst.imageUrl || null,
      })),
    }),
  );

  return {
    name: ai.name,
    description: ai.description,
    prepTime: ai.prepTime,
    cookTime: ai.cookTime,
    totalTime: ai.totalTime,
    servings: ai.servings,
    sourceUrl: null,
    sourceType: "text" as const,
    ingredientSections,
    instructionSections,
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
    // Count total ingredients and instructions across all sections
    const totalIngredients = recipe.ingredientSections.reduce(
      (sum, section) => sum + section.ingredients.length,
      0,
    );
    const totalInstructions = recipe.instructionSections.reduce(
      (sum, section) => sum + section.instructions.length,
      0,
    );

    let confidence: "high" | "medium" | "low" = "medium";
    if (
      totalIngredients >= 3 &&
      totalInstructions >= 2 &&
      recipe.name.length > 3
    ) {
      confidence = "high";
    } else if (totalIngredients < 2 || totalInstructions < 1) {
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
