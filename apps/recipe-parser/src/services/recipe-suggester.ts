import type {
  ParsedRecipe,
  IngredientSection,
  InstructionSection,
} from "../schema";
import { ParsedRecipeSchema } from "../schema";
import type {
  ParseResponse,
  RecipeSuggestion,
  SuggestRecipesInput,
  SuggestRecipesResponse,
  GenerateFromSuggestionInput,
} from "../service";
import type { Env } from "../types";
import { parseAiJsonResponse } from "../utils/ai-response-parser";
import {
  RECIPE_SUGGESTIONS_SYSTEM_PROMPT,
  RECIPE_GENERATION_SYSTEM_PROMPT,
  createRecipeSuggestionsPrompt,
  createRecipeGenerationPrompt,
} from "../utils/fridge-snap-prompts";
import { normalizeUnit } from "../utils/unit-normalizer";

const TEXT_MODEL = "@cf/meta/llama-4-scout-17b-16e-instruct" as const;

interface AiSuggestionsResult {
  suggestions: RecipeSuggestion[];
}

interface AiRecipeResult {
  name: string;
  description: string | null;
  prepTime: number | null;
  cookTime: number | null;
  totalTime: number | null;
  servings: number | null;
  ingredientSections: {
    name: string | null;
    ingredients: {
      index: number;
      quantity: number | null;
      unit: string | null;
      name: string;
    }[];
  }[];
  instructionSections: {
    name: string | null;
    instructions: {
      index: number;
      instruction: string;
      imageUrl?: string | null;
    }[];
  }[];
  suggestedTags?: {
    type: "cuisine" | "meal_type" | "occasion";
    name: string;
  }[];
}

/**
 * Extract response from AI - returns string or parsed object
 */
function extractAiResponse(response: unknown): unknown {
  if (typeof response === "string") return response;
  if (!response || typeof response !== "object") return null;

  const r = response as Record<string, unknown>;
  return r?.response ?? null;
}

/**
 * Parse AI response - handles both string and pre-parsed object
 */
function parseAiResponse<T>(response: unknown): T {
  const aiResponse = extractAiResponse(response);

  if (!aiResponse) {
    throw new Error("Empty response from AI");
  }

  if (typeof aiResponse === "string") {
    return parseAiJsonResponse<T>(aiResponse);
  }

  // AI returned parsed JSON directly
  return aiResponse as T;
}

/**
 * Generate a unique ID for a suggestion
 */
function generateId(): string {
  return `suggestion-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Get recipe suggestions based on available ingredients
 */
export async function suggestRecipes(
  env: Env,
  input: SuggestRecipesInput,
): Promise<SuggestRecipesResponse> {
  const { count } = input;

  if (input.ingredients.length === 0) {
    return {
      success: false,
      error: {
        code: "NO_INGREDIENTS",
        message: "At least one ingredient is required",
      },
    };
  }

  if (count < 1 || count > 10) {
    return {
      success: false,
      error: {
        code: "INVALID_COUNT",
        message: "Count must be between 1 and 10",
      },
    };
  }

  try {
    const response = await (env.AI as any).run(TEXT_MODEL, {
      messages: [
        { role: "system", content: RECIPE_SUGGESTIONS_SYSTEM_PROMPT },
        {
          role: "user",
          content: createRecipeSuggestionsPrompt(input.ingredients, count),
        },
      ],
      max_tokens: 4096,
    });

    const result = parseAiResponse<AiSuggestionsResult>(response);

    // Validate and ensure IDs
    const suggestions = result.suggestions.map((s) => ({
      ...s,
      id: s.id || generateId(),
      estimatedTime: s.estimatedTime || 30,
      difficulty: s.difficulty || "medium",
      matchedIngredients: s.matchedIngredients || [],
      additionalIngredients: s.additionalIngredients || [],
    }));

    if (suggestions.length === 0) {
      return {
        success: false,
        error: {
          code: "NO_SUGGESTIONS",
          message: "Could not generate recipe suggestions",
        },
      };
    }

    return {
      success: true,
      suggestions,
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: "AI_FAILED",
        message:
          error instanceof Error
            ? error.message
            : "Failed to generate suggestions",
      },
    };
  }
}

/**
 * Convert AI result to ParsedRecipe format
 */
function aiResultToRecipe(ai: AiRecipeResult): ParsedRecipe {
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
    sourceType: "ai" as const,
    ingredientSections,
    instructionSections,
    images: [],
    suggestedTags: ai.suggestedTags,
  };
}

/**
 * Generate a full recipe from a suggestion
 */
export async function generateFromSuggestion(
  env: Env,
  input: GenerateFromSuggestionInput,
): Promise<ParseResponse> {
  try {
    const response = await (env.AI as any).run(TEXT_MODEL, {
      messages: [
        { role: "system", content: RECIPE_GENERATION_SYSTEM_PROMPT },
        {
          role: "user",
          content: createRecipeGenerationPrompt(
            input.suggestion.name,
            input.suggestion.description,
            input.availableIngredients,
            input.suggestion.additionalIngredients,
          ),
        },
      ],
      max_tokens: 4096,
    });

    const aiResult = parseAiResponse<AiRecipeResult>(response);
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

    return {
      success: true,
      data: recipe,
      metadata: {
        source: "text",
        parseMethod: "ai_only",
        confidence: "medium",
      },
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: "AI_FAILED",
        message:
          error instanceof Error ? error.message : "Failed to generate recipe",
      },
    };
  }
}
