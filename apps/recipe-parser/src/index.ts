import { WorkerEntrypoint } from "cloudflare:workers";

import { parseImage } from "./services/image-parser";
import { parseText } from "./services/text-parser";
import { parseUrl } from "./services/url-parser";
import type { Env, ParseInput, ParseResponse } from "./types";

export type { ParsedRecipe, Ingredient, Instruction, Tag } from "./schema";
export type {
  ParseInput,
  ParseResponse,
  ParseResult,
  ParseError,
  ParseMetadata,
} from "./types";

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
          return await parseUrl(this.env, input.data);

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
            result = await parseUrl(env, input.data);
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
