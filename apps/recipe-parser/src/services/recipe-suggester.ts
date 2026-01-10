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

const TEXT_MODEL = "@cf/openai/gpt-oss-20b" as const;

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
 * Extract text from various AI response formats
 */
function extractResponseText(response: unknown): string {
  if (typeof response === "string") return response;
  if (!response || typeof response !== "object") return "";

  const r = response as Record<string, unknown>;

  // OpenAI Responses API format: output[0].content[0].text
  if (Array.isArray(r.output) && r.output[0]) {
    const firstOutput = r.output[0] as Record<string, unknown>;
    if (Array.isArray(firstOutput.content) && firstOutput.content[0]) {
      const firstContent = firstOutput.content[0] as Record<string, unknown>;
      if (typeof firstContent.text === "string") {
        return firstContent.text;
      }
    }
  }

  // Fallback to common field names
  if (typeof r.response === "string") return r.response;
  if (typeof r.output_text === "string") return r.output_text;
  if (typeof r.generated_text === "string") return r.generated_text;
  if (typeof r.text === "string") return r.text;

  return "";
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
      instructions: RECIPE_SUGGESTIONS_SYSTEM_PROMPT,
      input: createRecipeSuggestionsPrompt(input.ingredients, count),
      reasoning: { effort: "none" }, // Disable reasoning to get direct JSON output
    });

    const responseText = extractResponseText(response);

    if (!responseText) {
      return {
        success: false,
        error: {
          code: "AI_RESPONSE_EMPTY",
          message: "AI returned empty response",
        },
      };
    }

    const result = parseAiJsonResponse<AiSuggestionsResult>(responseText);

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
      instructions: RECIPE_GENERATION_SYSTEM_PROMPT,
      input: createRecipeGenerationPrompt(
        input.suggestion.name,
        input.suggestion.description,
        input.availableIngredients,
        input.suggestion.additionalIngredients,
      ),
      reasoning: { effort: "none" }, // Disable reasoning to get direct JSON output
    });

    const responseText = extractResponseText(response);

    if (!responseText) {
      return {
        success: false,
        error: {
          code: "AI_RESPONSE_EMPTY",
          message: "AI returned empty response",
        },
      };
    }

    const aiResult = parseAiJsonResponse<AiRecipeResult>(responseText);
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
