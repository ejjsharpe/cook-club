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
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;

  const isoMatch = value.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i);
  if (isoMatch) {
    const minutes =
      Number(isoMatch[1] ?? 0) * 60 +
      Number(isoMatch[2] ?? 0) +
      Math.ceil(Number(isoMatch[3] ?? 0) / 60);
    return minutes > 0 ? minutes : null;
  }

  const normalized = value.trim().toLowerCase();
  let totalMinutes = 0;
  for (const match of normalized.matchAll(
    /(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|hr|h)\b/g,
  )) {
    totalMinutes += Math.round(Number(match[1]) * 60);
  }
  for (const match of normalized.matchAll(
    /(\d+(?:\.\d+)?)\s*(?:minutes?|mins?|min|m)\b/g,
  )) {
    totalMinutes += Math.round(Number(match[1]));
  }
  if (totalMinutes > 0) {
    return totalMinutes;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function quantityToNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  const mixed = trimmed.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) {
    const whole = Number(mixed[1]);
    const numerator = Number(mixed[2]);
    const denominator = Number(mixed[3]);
    return denominator > 0 ? whole + numerator / denominator : null;
  }

  const fraction = trimmed.match(/^(\d+)\/(\d+)$/);
  if (fraction) {
    const numerator = Number(fraction[1]);
    const denominator = Number(fraction[2]);
    return denominator > 0 ? numerator / denominator : null;
  }

  const numeric = Number(trimmed);
  return Number.isFinite(numeric) ? numeric : null;
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeIngredient(ingredient: unknown, index: number): AiIngredient {
  if (typeof ingredient === "string") {
    return {
      index,
      quantity: null,
      unit: null,
      name: ingredient,
      preparation: null,
    };
  }

  const record =
    ingredient && typeof ingredient === "object"
      ? (ingredient as Record<string, unknown>)
      : {};

  return {
    index,
    quantity: quantityToNumber(record.quantity),
    unit: nullableString(record.unit),
    name: String(record.name ?? ""),
    preparation: nullableString(record.preparation),
  };
}

function normalizeInstruction(
  instruction: unknown,
  index: number,
): AiInstruction {
  if (typeof instruction === "string") {
    return {
      index,
      instruction,
      imageUrl: null,
    };
  }

  const record =
    instruction && typeof instruction === "object"
      ? (instruction as Record<string, unknown>)
      : {};

  return {
    index,
    instruction: String(record.instruction ?? record.text ?? ""),
    imageUrl: nullableString(record.imageUrl),
  };
}

function normalizeIngredientSections(recipe: Record<string, unknown>) {
  if (Array.isArray(recipe.ingredientSections)) {
    return recipe.ingredientSections.map((section) => {
      const record =
        section && typeof section === "object"
          ? (section as Record<string, unknown>)
          : {};

      return {
        name: nullableString(record.name),
        ingredients: Array.isArray(record.ingredients)
          ? record.ingredients.map(normalizeIngredient)
          : [],
      };
    });
  }

  return [
    {
      name: null,
      ingredients: Array.isArray(recipe.ingredients)
        ? recipe.ingredients.map(normalizeIngredient)
        : [],
    },
  ];
}

function normalizeInstructionSections(recipe: Record<string, unknown>) {
  if (Array.isArray(recipe.instructionSections)) {
    return recipe.instructionSections.map((section) => {
      const record =
        section && typeof section === "object"
          ? (section as Record<string, unknown>)
          : {};

      return {
        name: nullableString(record.name),
        instructions: Array.isArray(record.instructions)
          ? record.instructions.map(normalizeInstruction)
          : [],
      };
    });
  }

  return [
    {
      name: null,
      instructions: Array.isArray(recipe.instructions)
        ? recipe.instructions.map(normalizeInstruction)
        : [],
    },
  ];
}

function servingsToNumber(value: unknown): number | null {
  if (typeof value === "number") return value > 0 ? value : null;
  if (typeof value !== "string") return null;

  const range = value.match(/(\d+)\s*(?:-|to)\s*(\d+)/i);
  if (range) {
    return Math.round((Number(range[1]) + Number(range[2])) / 2);
  }

  const single = value.match(/\d+/);
  if (!single?.[0]) return null;

  const servings = Number(single[0]);
  return servings > 0 ? servings : null;
}

function normalizeAiRecipeResult(value: unknown): AiRecipeResult {
  const recipe = value as Record<string, unknown>;

  return {
    name: String(recipe.name ?? ""),
    description: nullableString(recipe.description),
    prepTime: durationToMinutes(recipe.prepTime),
    cookTime: durationToMinutes(recipe.cookTime),
    totalTime: durationToMinutes(recipe.totalTime),
    servings: servingsToNumber(recipe.servings),
    ingredientSections: normalizeIngredientSections(recipe),
    instructionSections: normalizeInstructionSections(recipe),
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
