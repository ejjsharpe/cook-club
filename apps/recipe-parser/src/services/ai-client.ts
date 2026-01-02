import type { Env } from "../types";
import {
  RECIPE_EXTRACTION_SYSTEM_PROMPT,
  IMAGE_EXTRACTION_SYSTEM_PROMPT,
  createTextExtractionPrompt,
  createHtmlExtractionPrompt,
  createImageExtractionPrompt,
} from "../utils/prompts";

// Cloudflare Workers AI models
const TEXT_MODEL = "@cf/openai/gpt-oss-20b" as const;
const VISION_MODEL = "@cf/meta/llama-3.2-11b-vision-instruct" as const;

export interface AiIngredient {
  index: number;
  quantity: number | null;
  unit: string | null;
  name: string;
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
 * Parse JSON from AI response, handling potential markdown code blocks
 */
function parseAiResponse(response: string): AiRecipeResult {
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

/**
 * Extract recipe from text using AI
 */
export async function parseRecipeFromText(
  ai: Env["AI"],
  text: string,
): Promise<AiRecipeResult> {
  // Use type assertion as the model name may not be in the types yet
  const response = await (ai as any).run(TEXT_MODEL, {
    messages: [
      { role: "system", content: RECIPE_EXTRACTION_SYSTEM_PROMPT },
      { role: "user", content: createTextExtractionPrompt(text) },
    ],
    max_tokens: 4096,
  });

  const responseText =
    typeof response === "string"
      ? response
      : (response?.response ?? response?.generated_text ?? "");

  if (!responseText) {
    throw new Error("Invalid AI response format");
  }

  return parseAiResponse(responseText);
}

/**
 * Extract recipe from cleaned HTML using AI
 */
export async function parseRecipeFromHtml(
  ai: Env["AI"],
  cleanedHtml: string,
): Promise<AiRecipeResult> {
  const response = await (ai as any).run(TEXT_MODEL, {
    instructions: RECIPE_EXTRACTION_SYSTEM_PROMPT,
    input: createHtmlExtractionPrompt(cleanedHtml),
  });

  const responseContent = response.output.find(
    (item: { type: string }) => item.type === "message",
  );

  const responseText = responseContent.content[0].text as string;

  return parseAiResponse(responseText);
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
