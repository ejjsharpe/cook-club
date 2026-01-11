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
  extractInstagramContent as extractInstagramContentBrowser,
  fetchHtmlWithBrowser,
} from "../utils/browser-fetcher";
import {
  cleanHtml,
  extractImageUrls,
  extractStepImageContext,
} from "../utils/html-cleaner";
import { fetchHtml } from "../utils/html-fetcher";
import {
  extractInstagramContent as extractInstagramContentOembed,
  extractShortcode,
} from "../utils/instagram-fetcher";
import { extractStructuredRecipe } from "../utils/structured-data";
import { extractTikTokContent } from "../utils/tiktok-fetcher";
import { normalizeUnit } from "../utils/unit-normalizer";

/**
 * Re-upload external images to R2 for permanent hosting.
 * This is necessary because external CDN URLs (Instagram, TikTok, etc.) expire
 * and may block requests from mobile apps.
 *
 * @param env - Environment with IMAGE_WORKER binding
 * @param imageUrls - Array of external image URLs
 * @param prefix - Key prefix for organizing images (e.g., "social/instagram")
 * @returns Array of permanent R2 URLs (or original URLs if upload fails)
 */
async function reuploadImagesToR2(
  env: Env,
  imageUrls: string[],
  prefix: string,
): Promise<string[]> {
  if (!imageUrls.length) return [];

  // Check if IMAGE_WORKER binding is available (not available in dev mode)
  if (!env.IMAGE_WORKER) {
    console.log(
      "[reupload] IMAGE_WORKER binding not available (dev mode?) - using original URLs",
    );
    return imageUrls;
  }

  const results = await Promise.all(
    imageUrls.map(async (sourceUrl, index) => {
      try {
        // Generate a unique key for this image
        const imageId = crypto.randomUUID();
        const extension = "jpg"; // Instagram/TikTok images are typically JPEG
        const destinationKey = `${prefix}/${imageId}.${extension}`;

        console.log(
          `[reupload] Uploading image ${index + 1} from ${sourceUrl.substring(0, 50)}...`,
        );

        const result = await env.IMAGE_WORKER.uploadFromUrl(
          sourceUrl,
          destinationKey,
        );

        if (result.success && result.publicUrl) {
          console.log(
            `[reupload] Successfully uploaded image ${index + 1} to R2: ${result.publicUrl}`,
          );
          return result.publicUrl;
        } else {
          console.log(
            `[reupload] Failed to upload image ${index + 1}: ${result.error}`,
          );
          // Return original URL as fallback
          return sourceUrl;
        }
      } catch (error) {
        console.log(
          `[reupload] Error uploading image ${index + 1}:`,
          error instanceof Error ? error.message : error,
        );
        // Return original URL as fallback
        return sourceUrl;
      }
    }),
  );

  return results;
}

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
 * Strategy:
 * 1. Try oembed API first (fast, reliable, no browser needed)
 * 2. Fall back to browser rendering if oembed fails
 *
 * The oembed API is preferred because:
 * - Returns full, clean caption text without truncation
 * - No login walls or JavaScript rendering issues
 * - Much faster than Puppeteer
 * - Returns thumbnail image
 */
async function parseInstagramUrl(env: Env, url: string): Promise<ParseResult> {
  const shortcode = extractShortcode(url) || "unknown";
  console.log(`Parsing Instagram URL [${shortcode}]:`, url);

  let contentForAi: string | null = null;
  let images: string[] = [];
  let method: "oembed" | "browser" = "oembed";

  // Strategy 1: Try oembed API first (preferred)
  try {
    console.log(`[${shortcode}] Trying oembed API...`);
    const oembedResult = await extractInstagramContentOembed(url);

    if (oembedResult.caption && oembedResult.caption.length >= 50) {
      contentForAi = oembedResult.caption;
      images = oembedResult.images;
      console.log(`[${shortcode}] Oembed success:`, {
        captionLength: contentForAi.length,
        imageCount: images.length,
        author: oembedResult.authorName,
      });
    } else {
      console.log(
        `[${shortcode}] Oembed returned insufficient content (${oembedResult.caption?.length || 0} chars)`,
      );
    }
  } catch (oembedError) {
    console.log(
      `[${shortcode}] Oembed failed:`,
      oembedError instanceof Error ? oembedError.message : oembedError,
    );
  }

  // Strategy 2: Fall back to browser rendering if oembed failed
  if (!contentForAi || contentForAi.length < 50) {
    try {
      console.log(`[${shortcode}] Falling back to browser rendering...`);
      method = "browser";
      const browserResult = await extractInstagramContentBrowser(
        env.BROWSER,
        url,
      );

      // Try caption first
      if (browserResult.caption && browserResult.caption.length >= 50) {
        contentForAi = browserResult.caption;
        images = browserResult.images;
      } else {
        // Try cleaning HTML as last resort
        const cleanedContent = cleanHtml(browserResult.html);
        if (cleanedContent.length >= 100) {
          contentForAi = cleanedContent;
          images = browserResult.images;
        }
      }

      if (contentForAi) {
        console.log(`[${shortcode}] Browser rendering success:`, {
          captionLength: contentForAi.length,
          imageCount: images.length,
        });
      }
    } catch (browserError) {
      console.log(
        `[${shortcode}] Browser rendering failed:`,
        browserError instanceof Error ? browserError.message : browserError,
      );
    }
  }

  // Check if we got any content
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

  // Use AI to parse the recipe from the caption
  try {
    // Re-upload images to R2 for permanent hosting
    // Instagram CDN URLs expire and block mobile app requests
    console.log(
      `[${shortcode}] Re-uploading ${images.length} image(s) to R2...`,
    );
    const permanentImages = await reuploadImagesToR2(
      env,
      images,
      "social/instagram",
    );
    console.log(
      `[${shortcode}] Re-upload complete, got ${permanentImages.length} permanent URL(s)`,
    );

    const aiResult = await parseRecipeFromHtml(env.AI, contentForAi);
    const recipe = aiResultToRecipe(aiResult, url, permanentImages);

    const validation = ParsedRecipeSchema(recipe);

    if (validation instanceof Error) {
      console.log(`[${shortcode}] Validation error for Instagram recipe`);
      return {
        success: false,
        error: {
          code: "VALIDATION_FAILED",
          message: "Could not parse a valid recipe from the Instagram content",
        },
      };
    }

    await cacheRecipe(env.RECIPE_CACHE, url, recipe);

    console.log(
      `[${shortcode}] Successfully parsed recipe via ${method}: "${recipe.name}"`,
    );

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
    console.error(`[${shortcode}] AI parsing error:`, error);
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

    // Re-upload images to R2 for permanent hosting
    // TikTok CDN URLs may expire or block mobile app requests
    console.log(
      `[TikTok] Re-uploading ${result.images.length} image(s) to R2...`,
    );
    const permanentImages = await reuploadImagesToR2(
      env,
      result.images,
      "social/tiktok",
    );

    const aiResult = await parseRecipeFromHtml(env.AI, result.caption);
    const recipe = aiResultToRecipe(aiResult, url, permanentImages);

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
