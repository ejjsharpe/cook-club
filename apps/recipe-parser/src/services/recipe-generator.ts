/**
 * Recipe Generator Service
 * Handles conversational AI recipe generation
 */

import type { ParsedRecipe } from "../schema";
import type {
  Env,
  ChatMessage,
  RecipeConversationState,
  ChatResponse,
} from "../types";
import {
  RECIPE_CONVERSATION_SYSTEM_PROMPT,
  RECIPE_GENERATION_SYSTEM_PROMPT,
  createConversationPrompt,
  createRecipeGenerationPrompt,
} from "../utils/generation-prompts";

// Cloudflare Workers AI model
const TEXT_MODEL = "@cf/openai/gpt-oss-20b" as const;

interface ConversationAiResponse {
  message: string;
  suggestedReplies?: string[];
  updatedState: RecipeConversationState;
  readyToGenerate: boolean;
}

interface GeneratedRecipeAiResponse {
  name: string;
  description: string | null;
  prepTime: number | null; // minutes
  cookTime: number | null; // minutes
  totalTime: number | null; // minutes
  servings: number;
  ingredients: {
    quantity: number | null;
    unit: string | null;
    name: string;
  }[];
  instructions: {
    text: string;
    imageUrl?: string | null;
  }[];
  suggestedTags?: {
    type: "cuisine" | "meal_type" | "occasion";
    name: string;
  }[];
}

/**
 * Parse JSON from AI response, handling potential markdown code blocks
 */
function parseAiJsonResponse<T>(response: string): T {
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
 * Check if all required conversation fields are filled
 */
function isConversationComplete(state: RecipeConversationState): boolean {
  return (
    state.ingredients !== null &&
    state.ingredients.length > 0 &&
    state.cuisinePreference !== null &&
    state.willingToShop !== null &&
    state.maxCookingTime !== null
  );
}

/**
 * Extract text from Responses API output
 */
function extractResponseText(response: any): string {
  // Handle Responses API format
  if (response?.output) {
    const messageOutput = response.output.find(
      (item: { type: string }) => item.type === "message",
    );
    if (messageOutput?.content?.[0]?.text) {
      return messageOutput.content[0].text;
    }
  }

  // Fallback to other formats
  if (typeof response === "string") {
    return response;
  }

  return response?.response ?? response?.generated_text ?? "";
}

/**
 * Generate the final recipe based on collected information
 */
async function generateRecipe(
  ai: Env["AI"],
  state: RecipeConversationState,
): Promise<ChatResponse> {
  try {
    // Use Responses API format with 'input' array
    const response = await (ai as any).run(TEXT_MODEL, {
      input: [
        { role: "system", content: RECIPE_GENERATION_SYSTEM_PROMPT },
        { role: "user", content: createRecipeGenerationPrompt(state) },
      ],
    });

    const responseText = extractResponseText(response);

    if (!responseText) {
      throw new Error("Empty response from AI");
    }

    const generated =
      parseAiJsonResponse<GeneratedRecipeAiResponse>(responseText);

    // Transform to ParsedRecipe format
    const recipe: ParsedRecipe = {
      name: generated.name,
      description: generated.description,
      prepTime: generated.prepTime,
      cookTime: generated.cookTime,
      totalTime: generated.totalTime,
      servings: generated.servings || 4,
      sourceType: "ai" as const,
      ingredients: generated.ingredients.map((ing, idx) => ({
        index: idx,
        quantity: ing.quantity,
        unit: ing.unit,
        name: ing.name,
      })),
      instructions: generated.instructions.map((inst, idx) => ({
        index: idx,
        instruction: inst.text,
        imageUrl: inst.imageUrl || null,
      })),
      images: [], // AI-generated recipes start with no images
      suggestedTags: generated.suggestedTags,
    };

    return {
      type: "recipe",
      recipe,
      isComplete: true,
    };
  } catch (error) {
    console.error("Recipe generation error:", error);
    return {
      type: "error",
      error: {
        code: "GENERATION_ERROR",
        message:
          error instanceof Error
            ? error.message
            : "Failed to generate recipe. Please try again.",
      },
    };
  }
}

/**
 * Get initial greeting message
 */
function getInitialMessage(): ChatResponse {
  return {
    type: "message",
    message:
      "Hi! I'm here to help you create a delicious recipe. What ingredients do you have available to cook with today?",
    suggestedReplies: [
      "Chicken, rice, and vegetables",
      "Pasta and tomatoes",
      "I'll tell you what I have",
    ],
    updatedState: {
      ingredients: null,
      cuisinePreference: null,
      willingToShop: null,
      maxCookingTime: null,
    },
    isComplete: false,
  };
}

/**
 * Process a chat message and return AI response
 */
export async function processChat(
  ai: Env["AI"],
  messages: ChatMessage[],
  state: RecipeConversationState,
): Promise<ChatResponse> {
  try {
    // If no messages, return initial greeting
    if (messages.length === 0) {
      return getInitialMessage();
    }

    // If conversation is complete, generate the recipe
    if (isConversationComplete(state)) {
      return await generateRecipe(ai, state);
    }

    // Continue the conversation using Responses API format
    const response = await (ai as any).run(TEXT_MODEL, {
      input: [
        { role: "system", content: RECIPE_CONVERSATION_SYSTEM_PROMPT },
        { role: "user", content: createConversationPrompt(messages, state) },
      ],
    });

    const responseText = extractResponseText(response);

    if (!responseText) {
      throw new Error("Empty response from AI");
    }

    const parsed = parseAiJsonResponse<ConversationAiResponse>(responseText);

    // If AI indicates ready to generate, do it
    if (parsed.readyToGenerate && isConversationComplete(parsed.updatedState)) {
      return await generateRecipe(ai, parsed.updatedState);
    }

    return {
      type: "message",
      message:
        parsed.message ||
        "I'd love to help you cook something delicious! What ingredients do you have?",
      suggestedReplies: parsed.suggestedReplies,
      updatedState: parsed.updatedState || state,
      isComplete: false,
    };
  } catch (error) {
    console.error("Chat processing error:", error);
    return {
      type: "error",
      error: {
        code: "CHAT_ERROR",
        message:
          error instanceof Error
            ? error.message
            : "Something went wrong. Please try again.",
      },
    };
  }
}
