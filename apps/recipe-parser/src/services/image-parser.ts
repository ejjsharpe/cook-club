import type { ParsedRecipe, Ingredient, Instruction } from "../schema";
import { ParsedRecipeSchema } from "../schema";
import type { Env, ParseResult } from "../types";
import { parseRecipeFromImage, type AiRecipeResult } from "./ai-client";
import { normalizeUnit } from "../utils/unit-normalizer";

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const VALID_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

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

  const instructions: Instruction[] = ai.instructions.map((text, index) => ({
    index,
    instruction: text,
  }));

  return {
    name: ai.name,
    description: ai.description,
    prepTime: ai.prepTime,
    cookTime: ai.cookTime,
    totalTime: ai.totalTime,
    servings: ai.servings,
    sourceUrl: null,
    ingredients,
    instructions,
    images: [],
    suggestedTags: ai.suggestedTags,
  };
}

/**
 * Parse a recipe from an image
 */
export async function parseImage(
  env: Env,
  imageData: string,
  mimeType: string,
): Promise<ParseResult> {
  // Validate mime type
  if (!VALID_MIME_TYPES.includes(mimeType)) {
    return {
      success: false,
      error: {
        code: "INVALID_MIME_TYPE",
        message: `Invalid image type. Supported: ${VALID_MIME_TYPES.join(", ")}`,
      },
    };
  }

  // Validate base64 and estimate size
  try {
    const decodedLength = atob(imageData).length;
    if (decodedLength > MAX_IMAGE_SIZE) {
      return {
        success: false,
        error: {
          code: "IMAGE_TOO_LARGE",
          message: `Image must be under ${MAX_IMAGE_SIZE / 1024 / 1024}MB`,
        },
      };
    }
  } catch {
    return {
      success: false,
      error: {
        code: "INVALID_BASE64",
        message: "Invalid base64 image data",
      },
    };
  }

  try {
    const aiResult = await parseRecipeFromImage(env.AI, imageData, mimeType);
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

    // Image parsing is inherently lower confidence than text/URL
    let confidence: "high" | "medium" | "low" = "low";
    if (
      recipe.ingredients.length >= 3 &&
      recipe.instructions.length >= 2 &&
      recipe.name.length > 3
    ) {
      confidence = "medium";
    }

    return {
      success: true,
      data: recipe,
      metadata: {
        source: "image",
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
