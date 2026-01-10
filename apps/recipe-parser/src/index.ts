import { WorkerEntrypoint } from "cloudflare:workers";

import type {
  IdentifyIngredientsInput,
  IdentifyIngredientsResponse,
  SuggestRecipesInput,
  SuggestRecipesResponse,
  GenerateFromSuggestionInput,
} from "./service";
import { parseImage } from "./services/image-parser";
import { identifyIngredients } from "./services/ingredient-identifier";
import { processChat } from "./services/recipe-generator";
import {
  suggestRecipes,
  generateFromSuggestion,
} from "./services/recipe-suggester";
import { parseText } from "./services/text-parser";
import { parseUrl } from "./services/url-parser";
import type {
  Env,
  ParseInput,
  ParseResponse,
  ChatInput,
  ChatResponse,
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
  IdentifyIngredientsInput,
  IdentifyIngredientsResponse,
  SuggestRecipesInput,
  SuggestRecipesResponse,
  GenerateFromSuggestionInput,
  RecipeSuggestion,
} from "./service";
export type { ParseResult, ParseError } from "./types";

/**
 * Recipe Parser Worker
 *
 * This worker provides RPC methods for parsing recipes from various sources.
 * It should be called via Service Bindings from other workers.
 */
export class RecipeParser extends WorkerEntrypoint<Env> {
  /**
   * Parse a recipe from URL, text, or image
   *
   * @param input - The input to parse
   * @returns ParseResponse - Either success with recipe data, or error
   *
   * @example
   * // Parse from URL
   * const result = await env.RECIPE_PARSER.parse({ type: "url", data: "https://example.com/recipe" });
   *
   * @example
   * // Parse from text
   * const result = await env.RECIPE_PARSER.parse({ type: "text", data: "Recipe: Pasta..." });
   *
   * @example
   * // Parse from image
   * const result = await env.RECIPE_PARSER.parse({
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
   * const result = await env.RECIPE_PARSER.chat({
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

  /**
   * Identify ingredients from a fridge/pantry image
   *
   * @param input - Image data and mime type
   * @returns IdentifyIngredientsResponse - List of identified ingredients or error
   *
   * @example
   * const result = await env.RECIPE_PARSER.identifyIngredients({
   *   imageBase64: "base64ImageData...",
   *   mimeType: "image/jpeg"
   * });
   */
  async identifyIngredients(
    input: IdentifyIngredientsInput,
  ): Promise<IdentifyIngredientsResponse> {
    return await identifyIngredients(this.env, input);
  }

  /**
   * Get recipe suggestions based on available ingredients
   *
   * @param input - List of ingredients and optional count
   * @returns SuggestRecipesResponse - List of recipe suggestions or error
   *
   * @example
   * const result = await env.RECIPE_PARSER.suggestRecipes({
   *   ingredients: ["eggs", "cheese", "butter"],
   *   count: 4
   * });
   */
  async suggestRecipes(
    input: SuggestRecipesInput,
  ): Promise<SuggestRecipesResponse> {
    return await suggestRecipes(this.env, input);
  }

  /**
   * Generate a full recipe from a suggestion
   *
   * @param input - The suggestion and available ingredients
   * @returns ParseResponse - Complete recipe or error
   *
   * @example
   * const result = await env.RECIPE_PARSER.generateFromSuggestion({
   *   suggestion: { id: "...", name: "Cheese Omelette", ... },
   *   availableIngredients: ["eggs", "cheese", "butter"]
   * });
   */
  async generateFromSuggestion(
    input: GenerateFromSuggestionInput,
  ): Promise<ParseResponse> {
    return await generateFromSuggestion(this.env, input);
  }
}

/**
 * Default export for HTTP requests
 * Includes a /test endpoint for development testing with `wrangler dev --remote`
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // DEV ONLY: Test endpoint for AI parsing
    if (url.pathname === "/test" && request.method === "POST") {
      try {
        const input = (await request.json()) as ParseInput;
        // Direct parsing without going through WorkerEntrypoint
        let result;
        switch (input.type) {
          case "url":
            result = await parseUrl(env, input.data, {
              structuredOnly: input.structuredOnly,
            });
            break;
          case "text":
            result = await parseText(env, input.data);
            break;
          case "image":
            result = await parseImage(env, input.data, input.mimeType);
            break;
          default:
            result = {
              success: false,
              error: { code: "INVALID_INPUT_TYPE", message: "Invalid type" },
            };
        }
        return new Response(JSON.stringify(result, null, 2), {
          headers: { "Content-Type": "application/json" },
        });
      } catch (error) {
        return new Response(
          JSON.stringify({
            error: "Failed to parse request",
            details: error instanceof Error ? error.message : "Unknown error",
          }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }
    }

    // Default: reject direct HTTP access
    return new Response(
      JSON.stringify({
        error: "This worker only accepts RPC calls via Service Bindings",
        usage:
          "Add a service binding in your wrangler.toml and call env.RECIPE_PARSER.parse()",
        devTesting:
          "POST to /test with JSON body: { type: 'url', data: 'https://...' }",
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      },
    );
  },
};
