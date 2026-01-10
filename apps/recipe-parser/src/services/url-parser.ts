import type {
  ParsedRecipe,
  IngredientSection,
  InstructionSection,
} from "../schema";
import { ParsedRecipeSchema } from "../schema";
import type { Env, ParseResult } from "../types";
import { parseRecipeFromHtml, type AiRecipeResult } from "./ai-client";
import { cacheRecipe } from "./cache";
import {
  requiresBrowserRendering,
  extractInstagramContent,
  fetchHtmlWithBrowser,
} from "../utils/browser-fetcher";
import {
  cleanHtml,
  extractImageUrls,
  extractStepImageContext,
} from "../utils/html-cleaner";
import { fetchHtml } from "../utils/html-fetcher";
import { extractStructuredRecipe } from "../utils/structured-data";
import { extractTikTokContent } from "../utils/tiktok-fetcher";
import { normalizeUnit } from "../utils/unit-normalizer";

/**
 * Convert AI result to ParsedRecipe format
 */
function aiResultToRecipe(
  ai: AiRecipeResult,
  sourceUrl: string,
  images: string[],
): ParsedRecipe {
  // Map AI ingredient sections to our format
  const ingredientSections: IngredientSection[] = ai.ingredientSections.map(
    (section) => ({
      name: section.name,
      ingredients: section.ingredients.map((ing, index) => ({
        index,
        quantity: ing.quantity,
        unit: ing.unit ? normalizeUnit(ing.unit) : null,
        name: ing.name,
      })),
    }),
  );

  // Map AI instruction sections to our format
  const instructionSections: InstructionSection[] = ai.instructionSections.map(
    (section) => ({
      name: section.name,
      instructions: section.instructions.map((inst, index) => ({
        index,
        instruction: inst.instruction,
        imageUrl: inst.imageUrl || null,
      })),
    }),
  );

  return {
    name: ai.name,
    description: ai.description,
    prepTime: ai.prepTime,
    cookTime: ai.cookTime,
    totalTime: ai.totalTime,
    servings: ai.servings,
    sourceUrl,
    sourceType: "url" as const,
    ingredientSections,
    instructionSections,
    images,
    suggestedTags: ai.suggestedTags,
  };
}

export interface ParseUrlOptions {
  /** If true, only use structured data extraction (no AI). For Basic Import. */
  structuredOnly?: boolean;
}

/**
 * Parse a recipe from a URL
 *
 * Strategy:
 * 1. Check cache
 * 2. Fetch HTML (using browser rendering for JS-heavy sites)
 * 3. Try structured data extraction (JSON-LD, microdata)
 * 4. If structuredOnly: return error if no structured data
 * 5. Otherwise: enhance with AI (always) or extract with AI (if no structured data)
 * 6. Cache successful result
 */
export async function parseUrl(
  env: Env,
  url: string,
  options?: ParseUrlOptions,
): Promise<ParseResult> {
  const { structuredOnly = false } = options ?? {};
  // const cached = await getCachedRecipe(env.RECIPE_CACHE, url);
  // if (cached) {
  //   return {
  //     success: true,
  //     data: cached,
  //     metadata: {
  //       source: "url",
  //       parseMethod: "structured_data",
  //       confidence: "high",
  //       cached: true,
  //     },
  //   };
  // }

  // Check if this URL requires browser rendering (Instagram, TikTok, etc.)
  const needsBrowser = requiresBrowserRendering(url);

  // Social media URLs don't have structured data - reject early for structuredOnly
  if (structuredOnly && needsBrowser) {
    const isSocialMedia =
      url.includes("instagram.com") ||
      url.includes("tiktok.com") ||
      url.includes("facebook.com") ||
      url.includes("fb.com");

    if (isSocialMedia) {
      return {
        success: false,
        error: {
          code: "UNSUPPORTED_URL",
          message:
            "Social media links don't contain structured recipe data. They require AI-powered Smart Import.",
        },
      };
    }
  }

  // Handle Instagram URLs specially
  if (needsBrowser && url.includes("instagram.com")) {
    return parseInstagramUrl(env, url);
  }

  // Handle TikTok URLs specially
  if (needsBrowser && url.includes("tiktok.com")) {
    return parseTikTokUrl(env, url);
  }

  // Fetch HTML (use browser for JS-heavy sites, regular fetch otherwise)
  let html: string;
  try {
    if (needsBrowser) {
      console.log("Using browser rendering for:", url);
      html = await fetchHtmlWithBrowser(env.BROWSER, url);
    } else {
      html = await fetchHtml(url);
    }
  } catch (error) {
    console.error("Fetch error:", error);
    return {
      success: false,
      error: {
        code: "FETCH_FAILED",
        message: error instanceof Error ? error.message : "Failed to fetch URL",
      },
    };
  }

  // Try structured data extraction first (JSON-LD, microdata)
  let structuredRecipe: ParsedRecipe | null = null;
  try {
    structuredRecipe = extractStructuredRecipe(html, url);
  } catch (error) {
    console.error("Structured data extraction error:", error);
  }

  // For Basic Import (structuredOnly): return structured data or error
  if (structuredOnly) {
    if (structuredRecipe) {
      const validation = ParsedRecipeSchema(structuredRecipe);

      if (!(validation instanceof Error)) {
        await cacheRecipe(env.RECIPE_CACHE, url, structuredRecipe);

        return {
          success: true,
          data: structuredRecipe,
          metadata: {
            source: "url",
            parseMethod: "structured_data",
            confidence: "high",
            cached: false,
          },
        };
      }
    }

    // No structured data found - return error for Basic Import
    return {
      success: false,
      error: {
        code: "NO_STRUCTURED_DATA",
        message:
          "This website doesn't have structured recipe data that we can read.",
      },
    };
  }

  // For Smart Import: always use AI (enhance structured data or extract from scratch)
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

    // Extract image URLs from the HTML
    const imageUrls = extractImageUrls(html, url);

    // Extract step image context to help AI associate images with steps
    const stepImageContext = extractStepImageContext(html, url);

    const aiResult = await parseRecipeFromHtml(
      env.AI,
      cleanedContent + stepImageContext,
    );
    const recipe = aiResultToRecipe(aiResult, url, imageUrls);

    const validation = ParsedRecipeSchema(recipe);

    if (validation instanceof Error) {
      console.log("validation error");
      return {
        success: false,
        error: {
          code: "VALIDATION_FAILED",
          message: "AI output did not match expected schema",
        },
      };
    }

    await cacheRecipe(env.RECIPE_CACHE, url, recipe);

    // Determine parse method based on whether we had structured data
    const parseMethod = structuredRecipe ? "ai_enhanced" : "ai_only";

    return {
      success: true,
      data: recipe,
      metadata: {
        source: "url",
        parseMethod,
        confidence: structuredRecipe ? "high" : "medium",
        cached: false,
      },
    };
  } catch (error) {
    console.log(error);
    return {
      success: false,
      error: {
        code: "AI_PARSE_FAILED",
        message: error instanceof Error ? error.message : "AI parsing failed",
      },
    };
  }
}

/**
 * Parse a recipe from an Instagram URL
 *
 * Instagram requires browser rendering because all content is loaded via JavaScript.
 * We use desktop user agent because Instagram shows full captions on desktop view.
 */
async function parseInstagramUrl(env: Env, url: string): Promise<ParseResult> {
  try {
    console.log("Parsing Instagram URL:", url);

    // Instagram requires browser rendering - content is loaded via JavaScript
    const result = await extractInstagramContent(env.BROWSER, url);
    let contentForAi = result.caption;
    const images = result.images;

    // If browser didn't get a caption, try cleaning the HTML
    if (!contentForAi || contentForAi.length < 50) {
      const cleanedContent = cleanHtml(result.html);
      if (cleanedContent.length >= 100) {
        contentForAi = cleanedContent;
      }
    }

    if (!contentForAi || contentForAi.length < 50) {
      return {
        success: false,
        error: {
          code: "NO_CONTENT",
          message:
            "Could not extract recipe content from Instagram. The post may not contain a recipe or may require login to view.",
        },
      };
    }

    console.log("Extracted Instagram content:", {
      captionLength: contentForAi.length,
      imageCount: images.length,
    });

    // Use AI to parse the recipe from the caption
    const aiResult = await parseRecipeFromHtml(env.AI, contentForAi);
    const recipe = aiResultToRecipe(aiResult, url, images);

    const validation = ParsedRecipeSchema(recipe);

    if (validation instanceof Error) {
      console.log("Validation error for Instagram recipe");
      return {
        success: false,
        error: {
          code: "VALIDATION_FAILED",
          message: "Could not parse a valid recipe from the Instagram content",
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
    console.error("Instagram parsing error:", error);
    return {
      success: false,
      error: {
        code: "INSTAGRAM_PARSE_FAILED",
        message:
          error instanceof Error
            ? error.message
            : "Failed to parse Instagram content",
      },
    };
  }
}

async function parseTikTokUrl(env: Env, url: string): Promise<ParseResult> {
  try {
    const result = await extractTikTokContent(url);

    if (!result.caption || result.caption.length < 50) {
      return {
        success: false,
        error: {
          code: "NO_CONTENT",
          message:
            "Could not extract recipe content from TikTok. The video may not contain a recipe or the description may be too short.",
        },
      };
    }

    const aiResult = await parseRecipeFromHtml(env.AI, result.caption);
    const recipe = aiResultToRecipe(aiResult, url, result.images);

    const validation = ParsedRecipeSchema(recipe);

    if (validation instanceof Error) {
      return {
        success: false,
        error: {
          code: "VALIDATION_FAILED",
          message: "Could not parse a valid recipe from the TikTok content",
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
        code: "TIKTOK_PARSE_FAILED",
        message:
          error instanceof Error
            ? error.message
            : "Failed to parse TikTok content",
      },
    };
  }
}
