import type {
  IdentifyIngredientsInput,
  IdentifyIngredientsResponse,
} from "../service";
import type { Env } from "../types";
import { parseAiJsonResponse } from "../utils/ai-response-parser";
import {
  INGREDIENT_IDENTIFICATION_SYSTEM_PROMPT,
  createIngredientIdentificationPrompt,
} from "../utils/fridge-snap-prompts";

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const VALID_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const VISION_MODEL = "@cf/meta/llama-3.2-11b-vision-instruct" as const;

interface AiIngredientsResult {
  ingredients: string[];
  confidence: "high" | "medium" | "low";
}

/**
 * Identify ingredients from a fridge/pantry image using AI vision
 */
export async function identifyIngredients(
  env: Env,
  input: IdentifyIngredientsInput,
): Promise<IdentifyIngredientsResponse> {
  // Validate mime type
  if (!VALID_MIME_TYPES.includes(input.mimeType)) {
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
    const decodedLength = atob(input.imageBase64).length;
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
    // Convert base64 to Uint8Array for the AI model
    const binaryString = atob(input.imageBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const response = await env.AI.run(VISION_MODEL, {
      messages: [
        { role: "system", content: INGREDIENT_IDENTIFICATION_SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: createIngredientIdentificationPrompt() },
            {
              type: "image",
              image: bytes,
            },
          ],
        },
      ],
      max_tokens: 2048,
    });

    const responseText = response.response;

    if (!responseText) {
      return {
        success: false,
        error: {
          code: "AI_RESPONSE_EMPTY",
          message: "AI returned empty response",
        },
      };
    }

    const result = parseAiJsonResponse<AiIngredientsResult>(responseText);

    // Validate and normalize ingredients
    const ingredients = result.ingredients
      .map((ing) => ing.toLowerCase().trim())
      .filter((ing) => ing.length > 0)
      .filter((ing, index, self) => self.indexOf(ing) === index); // deduplicate

    if (ingredients.length === 0) {
      return {
        success: false,
        error: {
          code: "NO_INGREDIENTS_FOUND",
          message: "Could not identify any ingredients in the image",
        },
      };
    }

    return {
      success: true,
      ingredients,
      confidence: result.confidence || "medium",
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: "AI_PARSE_FAILED",
        message:
          error instanceof Error
            ? error.message
            : "Failed to identify ingredients",
      },
    };
  }
}
