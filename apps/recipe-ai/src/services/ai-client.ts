import type { Env } from "../types";
import {
  RECIPE_EXTRACTION_SYSTEM_PROMPT,
  IMAGE_EXTRACTION_SYSTEM_PROMPT,
  createTextExtractionPrompt,
  createHtmlExtractionPrompt,
  createImageExtractionPrompt,
} from "../utils/prompts";

// Cloudflare Workers AI models
const TEXT_MODEL = "@cf/meta/llama-4-scout-17b-16e-instruct" as const;
const VISION_MODEL = "@cf/meta/llama-3.2-11b-vision-instruct" as const;

export interface AiIngredient {
  index: number;
  quantity: number | null;
  unit: string | null;
  name: string;
  preparation: string | null;
}

export interface AiInstruction {
  index: number;
  instruction: string;
  imageUrl?: string | null;
}

export interface AiIngredientSection {
  name: string | null;
  ingredients: AiIngredient[];
}

export interface AiInstructionSection {
  name: string | null;
  instructions: AiInstruction[];
}

export interface AiRecipeResult {
  name: string;
  description: string | null;
  prepTime: number | null; // minutes
  cookTime: number | null; // minutes
  totalTime: number | null; // minutes
  servings: number | null;
  ingredientSections: AiIngredientSection[];
  instructionSections: AiInstructionSection[];
  suggestedTags?: {
    type: "cuisine" | "meal_type" | "occasion";
    name: string;
  }[];
}

/**
 * Parse JSON string, handling potential markdown code blocks
 */
function parseJsonString(response: string): AiRecipeResult {
  let jsonStr = response.trim();

  // Remove markdown code blocks if present
  if (jsonStr.startsWith("```json")) {
    jsonStr = jsonStr.slice(7);
  } else if (jsonStr.startsWith("```")) {
    jsonStr = jsonStr.slice(3);
  }

  if (jsonStr.endsWith("```")) {
    jsonStr = jsonStr.slice(0, -3);
  }

  jsonStr = jsonStr.trim();

  try {
    return JSON.parse(jsonStr);
  } catch {
    throw new Error(`Failed to parse AI response as JSON: ${jsonStr}`);
  }
}

function durationToMinutes(value: unknown): number | null {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return null;

  const isoMatch = value.match(/^PT(?:(\d+)H)?(?:(\d+)M)?$/i);
  if (isoMatch) {
    return Number(isoMatch[1] ?? 0) * 60 + Number(isoMatch[2] ?? 0);
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizeAiRecipeResult(value: unknown): AiRecipeResult {
  const recipe = value as Record<string, unknown>;
  const ingredientSections =
    Array.isArray(recipe.ingredientSections)
      ? recipe.ingredientSections
      : [
          {
            name: null,
            ingredients: Array.isArray(recipe.ingredients)
              ? recipe.ingredients.map((ingredient, index) => ({
                  index,
                  quantity:
                    typeof ingredient === "object" && ingredient
                      ? ((ingredient as Record<string, unknown>)
                          .quantity as number | null) ?? null
                      : null,
                  unit:
                    typeof ingredient === "object" && ingredient
                      ? ((ingredient as Record<string, unknown>).unit as
                          | string
                          | null) ?? null
                      : null,
                  name:
                    typeof ingredient === "string"
                      ? ingredient
                      : String(
                          ((ingredient as Record<string, unknown>)?.name ??
                            "") as string,
                        ),
                  preparation:
                    typeof ingredient === "object" && ingredient
                      ? ((ingredient as Record<string, unknown>).preparation as
                          | string
                          | null) ?? null
                      : null,
                }))
              : [],
          },
        ];

  const instructionSections =
    Array.isArray(recipe.instructionSections)
      ? recipe.instructionSections
      : [
          {
            name: null,
            instructions: Array.isArray(recipe.instructions)
              ? recipe.instructions.map((instruction, index) => ({
                  index,
                  instruction:
                    typeof instruction === "string"
                      ? instruction
                      : String(
                          ((instruction as Record<string, unknown>)
                            ?.instruction ?? "") as string,
                        ),
                  imageUrl:
                    typeof instruction === "object" && instruction
                      ? ((instruction as Record<string, unknown>).imageUrl as
                          | string
                          | null) ?? null
                      : null,
                }))
              : [],
          },
        ];

  return {
    name: String(recipe.name ?? ""),
    description: (recipe.description as string | null | undefined) ?? null,
    prepTime: durationToMinutes(recipe.prepTime),
    cookTime: durationToMinutes(recipe.cookTime),
    totalTime: durationToMinutes(recipe.totalTime),
    servings:
      typeof recipe.servings === "number" ? recipe.servings : Number(recipe.servings) || null,
    ingredientSections: ingredientSections as AiIngredientSection[],
    instructionSections: instructionSections as AiInstructionSection[],
    suggestedTags: recipe.suggestedTags as AiRecipeResult["suggestedTags"],
  };
}

/**
 * Extract and parse AI response - handles both string and pre-parsed object
 */
function parseAiResponse(response: unknown): AiRecipeResult {
  // Extract the response field if it's an object
  const aiResponse =
    typeof response === "string"
      ? response
      : ((response as Record<string, unknown>)?.response ??
        (response as Record<string, unknown>)?.generated_text ??
        (response as Record<string, unknown>)?.result ??
        response);

  if (!aiResponse) {
    throw new Error("Invalid AI response format");
  }

  // If already an object, return directly
  if (typeof aiResponse !== "string") {
    return normalizeAiRecipeResult(aiResponse);
  }

  return normalizeAiRecipeResult(parseJsonString(aiResponse));
}

/**
 * Extract recipe from text using AI
 */
export async function parseRecipeFromText(
  ai: Env["AI"],
  text: string,
): Promise<AiRecipeResult> {
  const response = await (ai as any).run(TEXT_MODEL, {
    messages: [
      { role: "system", content: RECIPE_EXTRACTION_SYSTEM_PROMPT },
      { role: "user", content: createTextExtractionPrompt(text) },
    ],
    max_tokens: 4096,
  });

  return parseAiResponse(response);
}

/**
 * Extract recipe from cleaned HTML using AI
 */
export async function parseRecipeFromHtml(
  ai: Env["AI"],
  cleanedHtml: string,
): Promise<AiRecipeResult> {
  const response = await (ai as any).run(TEXT_MODEL, {
    messages: [
      { role: "system", content: RECIPE_EXTRACTION_SYSTEM_PROMPT },
      { role: "user", content: createHtmlExtractionPrompt(cleanedHtml) },
    ],
    max_tokens: 4096,
  });

  return parseAiResponse(response);
}

/**
 * Extract recipe from image using AI
 */
export async function parseRecipeFromImage(
  ai: Env["AI"],
  imageData: string,
  _mimeType: string,
): Promise<AiRecipeResult> {
  // Convert base64 to Uint8Array for the AI model
  const binaryString = atob(imageData);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // Use type assertion as the model name may not be in the types yet
  const response = await ai.run(VISION_MODEL, {
    messages: [
      { role: "system", content: IMAGE_EXTRACTION_SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          { type: "text", text: createImageExtractionPrompt() },
          {
            type: "image",
            image: bytes,
          },
        ],
      },
    ],
    max_tokens: 4096,
  });

  const responseText = response.response;

  if (!responseText) {
    throw new Error("Invalid AI response format");
  }

  return parseAiResponse(responseText);
}
