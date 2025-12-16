import type { ParsedRecipe, Ingredient, Instruction } from "../schema";
import { ParsedRecipeSchema } from "../schema";
import type { Env, ParseResult } from "../types";
import { parseRecipeFromHtml, type AiRecipeResult } from "./ai-client";
import { getCachedRecipe, cacheRecipe } from "./cache";
import { cleanHtml } from "../utils/html-cleaner";
import { fetchHtml } from "../utils/html-fetcher";
import { normalizeUnit } from "../utils/unit-normalizer";

/**
 * Convert AI result to ParsedRecipe format
 */
function aiResultToRecipe(ai: AiRecipeResult, sourceUrl: string): ParsedRecipe {
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
    sourceUrl,
    ingredients,
    instructions,
    images: [],
    suggestedTags: ai.suggestedTags,
  };
}

/**
 * Parse a recipe from a URL
 *
 * Strategy:
 * 1. Check cache
 * 2. Fetch HTML
 * 3. Try structured data extraction (JSON-LD, microdata)
 * 4. Fall back to AI parsing if needed
 * 5. Cache successful result
 */
export async function parseUrl(env: Env, url: string): Promise<ParseResult> {
  const cached = await getCachedRecipe(env.RECIPE_CACHE, url);
  if (cached) {
    return {
      success: true,
      data: cached,
      metadata: {
        source: "url",
        parseMethod: "structured_data",
        confidence: "high",
        cached: true,
      },
    };
  }

  // Fetch HTML
  let html: string;
  try {
    html = await fetchHtml(url);
  } catch (error) {
    return {
      success: false,
      error: {
        code: "FETCH_FAILED",
        message: error instanceof Error ? error.message : "Failed to fetch URL",
      },
    };
  }

  try {
    const cleanedContent = cleanHtml(html);

    if (cleanedContent.length < 100) {
      return {
        success: false,
        error: {
          code: "NO_CONTENT",
          message: "Not enough content found on the page",
        },
      };
    }

    const aiResult = await parseRecipeFromHtml(env.AI, cleanedContent);
    const recipe = aiResultToRecipe(aiResult, url);

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

    await cacheRecipe(env.RECIPE_CACHE, url, recipe);

    return {
      success: true,
      data: recipe,
      metadata: {
        source: "url",
        parseMethod: "ai_only",
        confidence: "medium",
        cached: false,
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
