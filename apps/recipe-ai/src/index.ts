import { WorkerEntrypoint } from "cloudflare:workers";

import { parseImage } from "./services/image-parser";
import { processChat } from "./services/recipe-generator";
import { generateRecipeImage } from "./services/recipe-image-generator";
import { generateNutrition } from "./services/nutrition-generator";
import { personalizeRecipe } from "./services/recipe-personalizer";
import { parseText } from "./services/text-parser";
import { parseUrl } from "./services/url-parser";
import type {
  Env,
  ParseInput,
  ParseResponse,
  ChatInput,
  ChatResponse,
  GenerateRecipeImageInput,
  GenerateRecipeImageResponse,
  NutritionInput,
  NutritionResponse,
  PersonalizeRecipeInput,
} from "./types";

export type {
  ParsedRecipe,
  Ingredient,
  Instruction,
  Tag,
  SourceType,
} from "./schema";
export type {
  ParseInput,
  ParseResponse,
  ParseMetadata,
  ChatInput,
  ChatResponse,
  ChatMessage,
  RecipeConversationState,
  GenerateRecipeImageInput,
  GenerateRecipeImageResponse,
  NutritionInput,
  NutritionResponse,
  PersonalizationGoal,
  PersonalizeRecipeInput,
} from "./service";
export type { ParseResult, ParseError } from "./types";

/**
 * Recipe AI Worker
 *
 * Provides RPC methods for recipe parsing, generation, personalization, and
 * image generation. It should be called via Service Bindings from trusted
 * Workers.
 */
export class RecipeAI extends WorkerEntrypoint<Env> {
  /**
   * Parse a recipe from URL, text, or image
   *
   * @param input - The input to parse
   * @returns ParseResponse - Either success with recipe data, or error
   *
   * @example
   * // Parse from URL
   * const result = await env.RECIPE_AI.parse({ type: "url", data: "https://example.com/recipe" });
   *
   * @example
   * // Parse from text
   * const result = await env.RECIPE_AI.parse({ type: "text", data: "Recipe: Pasta..." });
   *
   * @example
   * // Parse from image
   * const result = await env.RECIPE_AI.parse({
   *   type: "image",
   *   data: "base64ImageData...",
   *   mimeType: "image/jpeg"
   * });
   */
  async parse(input: ParseInput): Promise<ParseResponse> {
    try {
      switch (input.type) {
        case "url":
          return await parseUrl(this.env, input.data, {
            structuredOnly: input.structuredOnly,
          });

        case "text":
          return await parseText(this.env, input.data);

        case "image":
          return await parseImage(this.env, input.data, input.mimeType);

        default:
          return {
            success: false,
            error: {
              code: "INVALID_INPUT_TYPE",
              message: "Input type must be 'url', 'text', or 'image'",
            },
          };
      }
    } catch (error) {
      console.error(error);
      return {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "An unexpected error occurred",
        },
      };
    }
  }

  /**
   * Process a chat message for AI recipe generation
   *
   * @param input - The chat input containing messages and conversation state
   * @returns ChatResponse - AI message, recipe, or error
   *
   * @example
   * const result = await env.RECIPE_AI.chat({
   *   messages: [{ role: "user", content: "I have chicken and rice" }],
   *   conversationState: { ingredients: null, cuisinePreference: null, willingToShop: null, maxCookingTime: null }
   * });
   */
  async chat(input: ChatInput): Promise<ChatResponse> {
    return await processChat(
      this.env.AI,
      input.messages,
      input.conversationState,
    );
  }

  async personalize(input: PersonalizeRecipeInput): Promise<ParseResponse> {
    return await personalizeRecipe(this.env.AI, input);
  }

  async generateImage(
    input: GenerateRecipeImageInput,
  ): Promise<GenerateRecipeImageResponse> {
    return await generateRecipeImage(this.env, input);
  }

  async nutrition(input: NutritionInput): Promise<NutritionResponse> {
    return await generateNutrition(this.env, input);
  }
}

/**
 * Default export for HTTP requests.
 * Direct HTTP parsing is intentionally disabled; use the RPC entrypoint via
 * Service Bindings from trusted Workers.
 */
export default {
  async fetch(_request: Request, _env: Env): Promise<Response> {
    return new Response(
      JSON.stringify({
        error: "This worker only accepts RPC calls via Service Bindings",
        usage:
          "Add a service binding in your wrangler.toml and call env.RECIPE_AI.parse()",
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      },
    );
  },
};
