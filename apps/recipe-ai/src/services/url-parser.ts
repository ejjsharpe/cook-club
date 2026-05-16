import * as cheerio from "cheerio";

import type {
  ParsedRecipe,
  IngredientSection,
  InstructionSection,
} from "../schema";
import { ParsedRecipeSchema } from "../schema";
import type { Env, ParseMetadata, ParseResult } from "../types";
import { parseRecipeFromHtml, type AiRecipeResult } from "./ai-client";
import { cacheRecipe, deleteCachedRecipe, getCachedRecipe } from "./cache";
import {
  discoverAlternateRecipeUrls,
  getWordPressRestPostUrl,
} from "../utils/alternate-pages";
import {
  requiresBrowserRendering,
  extractInstagramContent as extractInstagramContentBrowser,
  extractTikTokBrowserContent,
  fetchHtmlWithBrowser,
} from "../utils/browser-fetcher";
import {
  cleanHtml,
  extractImageUrls,
  extractStepImageContext,
  focusRecipeContent,
} from "../utils/html-cleaner";
import { fetchHtml, isLikelyBotBlockedError } from "../utils/html-fetcher";
import {
  extractInstagramContent as extractInstagramContentOembed,
  extractShortcode,
} from "../utils/instagram-fetcher";
import { fetchReaderMarkdown } from "../utils/reader-fetcher";
import {
  evaluateRecipeQuality,
  mergeRecipeImages,
  normalizeRecipeForImport,
  normalizeRecipeUrl,
  type RecipeQualitySource,
} from "../utils/recipe-quality";
import { extractSocialCaptionRecipe } from "../utils/social-caption-recipe";
import { enrichSocialMediaRecipeText } from "../utils/social-media-enrichment";
import { extractStructuredRecipe } from "../utils/structured-data";
import {
  extractTikTokContent,
  type TikTokContent,
} from "../utils/tiktok-fetcher";
import { normalizeUnit } from "../utils/unit-normalizer";
import {
  extractMarkdownRecipeCard,
  extractVisibleRecipeCard,
} from "../utils/visible-recipe-card";

/**
 * Re-upload external images to R2 for permanent hosting.
 * This is necessary because external CDN URLs (Instagram, TikTok, etc.) expire
 * and may block requests from mobile apps.
 *
 * @param env - Environment with IMAGE_SERVICE binding
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

  // Check if IMAGE_SERVICE binding is available (not available in dev mode)
  if (!env.IMAGE_SERVICE) {
    console.log(
      "[reupload] IMAGE_SERVICE binding not available (dev mode?) - using original URLs",
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

        const result = await env.IMAGE_SERVICE.uploadFromUrl(
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

type UrlParseMethod = NonNullable<ParseMetadata["parseMethod"]>;

interface CandidateOptions {
  parseMethod?: UrlParseMethod;
  cache?: boolean;
}

type SocialPlatform =
  | "instagram"
  | "tiktok"
  | "facebook"
  | "youtube"
  | "pinterest"
  | "threads"
  | "x"
  | "reddit";

const SOCIAL_PLATFORM_DOMAINS: Record<SocialPlatform, string[]> = {
  instagram: ["instagram.com"],
  tiktok: ["tiktok.com"],
  facebook: ["facebook.com", "fb.com"],
  youtube: ["youtube.com", "youtu.be"],
  pinterest: ["pinterest.com", "pin.it"],
  threads: ["threads.net"],
  x: ["x.com", "twitter.com"],
  reddit: ["reddit.com"],
};

function hostnameMatches(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

function getSocialPlatform(url: string): SocialPlatform | null {
  try {
    const hostname = new URL(url).hostname.toLowerCase();

    for (const [platform, domains] of Object.entries(
      SOCIAL_PLATFORM_DOMAINS,
    ) as [SocialPlatform, string[]][]) {
      if (domains.some((domain) => hostnameMatches(hostname, domain))) {
        return platform;
      }
    }

    return null;
  } catch {
    return null;
  }
}

function socialPrefix(platform: SocialPlatform): string {
  return `social/${platform}`;
}

function candidateParseMethod(
  source: RecipeQualitySource,
): UrlParseMethod | undefined {
  if (source === "ai" || source === "social_ai") return "ai_only";
  if (source === "structured" || source === "visible" || source === "reader") {
    return "structured_data";
  }
  return undefined;
}

async function acceptedCandidate(
  env: Env,
  cacheUrl: string,
  recipe: ParsedRecipe | null,
  source: RecipeQualitySource,
  options: CandidateOptions = {},
): Promise<ParseResult | null> {
  if (!recipe) return null;

  const normalizedRecipe = normalizeRecipeForImport(recipe);
  const validation = ParsedRecipeSchema(normalizedRecipe);
  if (validation instanceof Error) return null;

  const quality = evaluateRecipeQuality(normalizedRecipe, source);
  if (!quality.usable) {
    console.log("Recipe candidate rejected:", {
      source,
      score: quality.score,
      reasons: quality.reasons,
      ingredientCount: quality.ingredientCount,
      instructionCount: quality.instructionCount,
    });
    return null;
  }

  if (options.cache !== false) {
    try {
      await cacheRecipe(env.RECIPE_CACHE, cacheUrl, normalizedRecipe);
    } catch (error) {
      console.log(
        "Recipe cache write failed:",
        error instanceof Error ? error.message : error,
      );
    }
  }

  const parseMethod = options.parseMethod ?? candidateParseMethod(source);
  const metadata: ParseMetadata = {
    source: "url",
    confidence: quality.confidence,
    cached: false,
  };
  if (parseMethod) {
    metadata.parseMethod = parseMethod;
  }

  return {
    success: true,
    data: normalizedRecipe,
    metadata,
  };
}

async function tryReaderRecipe(url: string): Promise<ParsedRecipe | null> {
  try {
    const markdown = await fetchReaderMarkdown(url);
    return extractMarkdownRecipeCard(markdown, url);
  } catch (error) {
    console.log(
      "Reader fallback failed:",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

function withOriginalSourceUrl(
  recipe: ParsedRecipe | null,
  sourceUrl: string,
): ParsedRecipe | null {
  return recipe ? { ...recipe, sourceUrl } : null;
}

async function tryDeterministicHtmlRecipe(
  env: Env,
  cacheUrl: string,
  html: string,
  htmlUrl: string,
  sourceUrl: string,
): Promise<ParseResult | null> {
  const imageUrls = extractImageUrls(html, htmlUrl);

  const structuredRecipe = withOriginalSourceUrl(
    extractStructuredRecipe(html, htmlUrl),
    sourceUrl,
  );
  const structuredResult = await acceptedCandidate(
    env,
    cacheUrl,
    structuredRecipe ? mergeRecipeImages(structuredRecipe, imageUrls) : null,
    "structured",
  );
  if (structuredResult) return structuredResult;

  const visibleRecipe = withOriginalSourceUrl(
    extractVisibleRecipeCard(html, htmlUrl),
    sourceUrl,
  );
  return acceptedCandidate(
    env,
    cacheUrl,
    visibleRecipe ? mergeRecipeImages(visibleRecipe, imageUrls) : null,
    "visible",
  );
}

async function tryAlternateRecipePages(
  env: Env,
  sourceUrl: string,
  html: string,
): Promise<ParseResult | null> {
  const alternateUrls = discoverAlternateRecipeUrls(html, sourceUrl);

  for (const alternateUrl of alternateUrls) {
    try {
      const alternateHtml = await fetchHtml(alternateUrl, 0);
      const result = await tryDeterministicHtmlRecipe(
        env,
        sourceUrl,
        alternateHtml,
        alternateUrl,
        sourceUrl,
      );
      if (result) return result;
    } catch (error) {
      console.log(
        "Alternate recipe page failed:",
        error instanceof Error ? error.message : error,
      );
    }
  }

  return null;
}

interface WordPressRestPost {
  content?: { rendered?: string };
  excerpt?: { rendered?: string };
  title?: { rendered?: string };
  yoast_head_json?: {
    schema?: unknown;
    og_image?: { url?: string }[];
  };
}

function wordPressPostToHtml(post: WordPressRestPost): string | null {
  const content = post.content?.rendered;
  if (!content) return null;

  const title = post.title?.rendered ?? "";
  const excerpt = post.excerpt?.rendered ?? "";
  const schema = post.yoast_head_json?.schema;
  const ogImage = post.yoast_head_json?.og_image?.[0]?.url;
  const schemaScript = schema
    ? `<script type="application/ld+json">${JSON.stringify(schema)}</script>`
    : "";
  const imageMeta = ogImage
    ? `<meta property="og:image" content="${ogImage}">`
    : "";

  return `
    <html>
      <head>${schemaScript}${imageMeta}</head>
      <body>
        <article>
          <h1>${title}</h1>
          ${excerpt}
          ${content}
        </article>
      </body>
    </html>
  `;
}

async function fetchWordPressRestHtml(restUrl: string): Promise<string | null> {
  const response = await fetch(restUrl, {
    signal: AbortSignal.timeout(8_000),
    headers: {
      Accept: "application/json",
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  });

  if (!response.ok) return null;

  const data: unknown = await response.json();
  const post = Array.isArray(data) ? data[0] : data;
  if (!post || typeof post !== "object") return null;

  return wordPressPostToHtml(post as WordPressRestPost);
}

async function tryWordPressRestRecipe(
  env: Env,
  sourceUrl: string,
  html: string,
): Promise<ParseResult | null> {
  const restUrl = getWordPressRestPostUrl(html, sourceUrl);
  if (!restUrl) return null;

  try {
    const restHtml = await fetchWordPressRestHtml(restUrl);
    if (!restHtml) return null;

    return tryDeterministicHtmlRecipe(
      env,
      sourceUrl,
      restHtml,
      sourceUrl,
      sourceUrl,
    );
  } catch (error) {
    console.log(
      "WordPress REST fallback failed:",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

/**
 * Parse a recipe from a URL
 *
 * Strategy:
 * 1. Check cache
 * 2. Fetch HTML (using browser rendering for JS-heavy sites)
 * 3. Try structured data extraction (JSON-LD, microdata)
 * 4. If structuredOnly: return error if no structured data
 * 5. Otherwise: return usable structured data or extract with AI
 * 6. Cache successful result
 */
export async function parseUrl(
  env: Env,
  url: string,
  options?: ParseUrlOptions,
): Promise<ParseResult> {
  const { structuredOnly = false } = options ?? {};
  let sourceUrl: string;
  try {
    sourceUrl = normalizeRecipeUrl(url);
  } catch {
    return {
      success: false,
      error: {
        code: "INVALID_URL",
        message: "Invalid recipe URL",
      },
    };
  }

  const cached = await getCachedRecipe(env.RECIPE_CACHE, sourceUrl);
  if (cached) {
    const normalizedCached = normalizeRecipeForImport(cached);
    const validation = ParsedRecipeSchema(normalizedCached);
    const quality = evaluateRecipeQuality(normalizedCached, "cached");

    if (!(validation instanceof Error) && quality.usable) {
      return {
        success: true,
        data: normalizedCached,
        metadata: {
          source: "url",
          confidence: quality.confidence,
          cached: true,
        },
      };
    }

    console.log("Cached recipe rejected; retrying live parse:", {
      score: quality.score,
      reasons: quality.reasons,
    });
    try {
      await deleteCachedRecipe(env.RECIPE_CACHE, sourceUrl);
    } catch (error) {
      console.log(
        "Cached recipe delete failed:",
        error instanceof Error ? error.message : error,
      );
    }
  }

  // Check if this URL requires browser rendering (Instagram, TikTok, etc.)
  const needsBrowser = requiresBrowserRendering(sourceUrl);
  const socialPlatform = getSocialPlatform(sourceUrl);

  // Social media URLs don't have structured data - reject early for structuredOnly
  if (structuredOnly && socialPlatform) {
    return {
      success: false,
      error: {
        code: "UNSUPPORTED_URL",
        message:
          "Social media links don't contain structured recipe data. They require AI-powered Smart Import.",
      },
    };
  }

  // Handle Instagram URLs specially
  if (socialPlatform === "instagram") {
    return parseInstagramUrl(env, sourceUrl);
  }

  // Handle TikTok URLs specially
  if (socialPlatform === "tiktok") {
    return parseTikTokUrl(env, sourceUrl);
  }

  if (socialPlatform) {
    return parseGenericSocialUrl(env, sourceUrl, socialPlatform);
  }

  // Fetch HTML (use browser for JS-heavy sites, regular fetch otherwise)
  let html: string;
  try {
    if (needsBrowser) {
      console.log("Using browser rendering for:", sourceUrl);
      html = await fetchHtmlWithBrowser(env.BROWSER, sourceUrl);
    } else {
      html = await fetchHtml(sourceUrl, 1);
    }
  } catch (error) {
    if (!structuredOnly) {
      const readerRecipe = await tryReaderRecipe(sourceUrl);
      const readerResult = await acceptedCandidate(
        env,
        sourceUrl,
        readerRecipe,
        "reader",
      );
      if (readerResult) return readerResult;
    }

    if (!needsBrowser && isLikelyBotBlockedError(error)) {
      try {
        console.log(
          "Regular fetch appears blocked; retrying with browser rendering:",
          sourceUrl,
        );
        html = await fetchHtmlWithBrowser(env.BROWSER, sourceUrl);
      } catch (browserError) {
        console.error("Browser fetch error:", browserError);
        return {
          success: false,
          error: {
            code: "FETCH_FAILED",
            message:
              browserError instanceof Error
                ? browserError.message
                : "Failed to fetch URL",
          },
        };
      }
    } else {
      console.error("Fetch error:", error);
      return {
        success: false,
        error: {
          code: "FETCH_FAILED",
          message:
            error instanceof Error ? error.message : "Failed to fetch URL",
        },
      };
    }
  }

  // Try structured data extraction first (JSON-LD, microdata)
  let structuredRecipe: ParsedRecipe | null = null;
  try {
    structuredRecipe = extractStructuredRecipe(html, sourceUrl);
  } catch (error) {
    console.error("Structured data extraction error:", error);
  }

  // For Basic Import (structuredOnly): return structured data or error
  if (structuredOnly) {
    const structuredResult = await acceptedCandidate(
      env,
      sourceUrl,
      structuredRecipe,
      "structured",
    );
    if (structuredResult) return structuredResult;

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

  const structuredResult = await acceptedCandidate(
    env,
    sourceUrl,
    structuredRecipe,
    "structured",
  );
  if (structuredResult) return structuredResult;

  const imageUrls = extractImageUrls(html, sourceUrl);

  const visibleRecipe = extractVisibleRecipeCard(html, sourceUrl);
  const visibleResult = await acceptedCandidate(
    env,
    sourceUrl,
    visibleRecipe ? mergeRecipeImages(visibleRecipe, imageUrls) : null,
    "visible",
  );
  if (visibleResult) return visibleResult;

  const alternateResult = await tryAlternateRecipePages(env, sourceUrl, html);
  if (alternateResult) return alternateResult;

  const wordPressRestResult = await tryWordPressRestRecipe(
    env,
    sourceUrl,
    html,
  );
  if (wordPressRestResult) return wordPressRestResult;

  const readerRecipe = await tryReaderRecipe(sourceUrl);
  const readerResult = await acceptedCandidate(
    env,
    sourceUrl,
    readerRecipe,
    "reader",
  );
  if (readerResult) return readerResult;

  // For Smart Import: extract with AI when structured data is missing or incomplete.
  try {
    const cleanedContent = focusRecipeContent(cleanHtml(html));

    if (cleanedContent.length < 100) {
      return {
        success: false,
        error: {
          code: "NO_CONTENT",
          message: "Not enough content found on the page",
        },
      };
    }

    // Extract step image context to help AI associate images with steps
    const stepImageContext = extractStepImageContext(html, sourceUrl);

    const aiResult = await parseRecipeFromHtml(
      env.AI,
      cleanedContent + stepImageContext,
    );
    const recipe = aiResultToRecipe(aiResult, sourceUrl, imageUrls);
    const aiResultResponse = await acceptedCandidate(
      env,
      sourceUrl,
      recipe,
      "ai",
      { parseMethod: structuredRecipe ? "ai_enhanced" : "ai_only" },
    );

    if (!aiResultResponse) {
      console.log("validation error");
      return {
        success: false,
        error: {
          code: "VALIDATION_FAILED",
          message: "AI output did not match expected schema",
        },
      };
    }

    return aiResultResponse;
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

  // Re-upload images to R2 for permanent hosting
  // Instagram CDN URLs expire and block mobile app requests
  console.log(`[${shortcode}] Re-uploading ${images.length} image(s) to R2...`);
  const permanentImages = await reuploadImagesToR2(
    env,
    images,
    "social/instagram",
  );
  console.log(
    `[${shortcode}] Re-upload complete, got ${permanentImages.length} permanent URL(s)`,
  );

  let aiError: unknown = null;
  try {
    const aiResult = await parseRecipeFromHtml(env.AI, contentForAi);
    const recipe = aiResultToRecipe(aiResult, url, permanentImages);

    const result = await acceptedCandidate(env, url, recipe, "social_ai", {
      parseMethod: "ai_only",
    });
    if (result) {
      console.log(
        `[${shortcode}] Successfully parsed recipe via ${method}: "${recipe.name}"`,
      );

      return result;
    }

    console.log(`[${shortcode}] Validation error for Instagram recipe`);
  } catch (error) {
    aiError = error;
    console.error(`[${shortcode}] AI parsing error:`, error);
  }

  const fallbackRecipe = extractSocialCaptionRecipe(
    contentForAi,
    url,
    permanentImages,
  );
  const fallbackResult = await acceptedCandidate(
    env,
    url,
    fallbackRecipe,
    "social_ai",
    {
      parseMethod: "structured_data",
    },
  );
  if (fallbackResult) return fallbackResult;

  if (aiError) {
    return {
      success: false,
      error: {
        code: "INSTAGRAM_PARSE_FAILED",
        message:
          aiError instanceof Error
            ? aiError.message
            : "Failed to parse Instagram content",
      },
    };
  }

  return {
    success: false,
    error: {
      code: "VALIDATION_FAILED",
      message: "Could not parse a valid recipe from the Instagram content",
    },
  };
}

function uniqueTextParts(values: (string | null | undefined)[]): string[] {
  const seen = new Set<string>();
  const parts: string[] = [];

  for (const value of values) {
    const normalized = value?.replace(/\s+/g, " ").trim();
    if (!normalized) continue;

    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    parts.push(normalized);
  }

  return parts;
}

function extractGenericSocialText(
  html: string,
  platform: SocialPlatform,
): string {
  const $ = cheerio.load(html);
  const metaSelectors = [
    'meta[property="og:description"]',
    'meta[name="twitter:description"]',
    'meta[name="description"]',
    'meta[property="og:title"]',
    'meta[name="twitter:title"]',
    "title",
  ];

  const metaParts = metaSelectors.map((selector) => {
    const element = $(selector).first();
    return element.attr("content") || element.text();
  });
  const pageText = focusRecipeContent(cleanHtml(html), 12_000);
  const parts = uniqueTextParts([
    `${platform} social post`,
    ...metaParts,
    pageText.length >= 100 ? pageText : null,
  ]);

  return parts.join("\n\n");
}

async function parseGenericSocialUrl(
  env: Env,
  url: string,
  platform: SocialPlatform,
): Promise<ParseResult> {
  let html: string;
  try {
    html = env.BROWSER
      ? await fetchHtmlWithBrowser(env.BROWSER, url)
      : await fetchHtml(url, 1);
  } catch (error) {
    return {
      success: false,
      error: {
        code: "FETCH_FAILED",
        message:
          error instanceof Error
            ? error.message
            : `Failed to fetch ${platform} content`,
      },
    };
  }

  const contentForAi = extractGenericSocialText(html, platform);
  if (contentForAi.length < 50) {
    return {
      success: false,
      error: {
        code: "NO_CONTENT",
        message:
          "Could not extract recipe content from this social media link.",
      },
    };
  }

  const images = extractImageUrls(html, url);
  const permanentImages = await reuploadImagesToR2(
    env,
    images,
    socialPrefix(platform),
  );

  let aiError: unknown = null;
  try {
    const aiResult = await parseRecipeFromHtml(env.AI, contentForAi);
    const recipe = aiResultToRecipe(aiResult, url, permanentImages);
    const result = await acceptedCandidate(env, url, recipe, "social_ai", {
      parseMethod: "ai_only",
    });
    if (result) return result;
  } catch (error) {
    aiError = error;
    console.log(
      `[${platform}] AI parsing failed:`,
      error instanceof Error ? error.message : error,
    );
  }

  const fallbackRecipe = extractSocialCaptionRecipe(
    contentForAi,
    url,
    permanentImages,
  );
  const fallbackResult = await acceptedCandidate(
    env,
    url,
    fallbackRecipe,
    "social_ai",
    {
      parseMethod: "structured_data",
    },
  );
  if (fallbackResult) return fallbackResult;

  return {
    success: false,
    error: {
      code: aiError ? "AI_PARSE_FAILED" : "VALIDATION_FAILED",
      message:
        aiError instanceof Error
          ? aiError.message
          : "Could not parse a valid recipe from this social media content",
    },
  };
}

function mergeUniqueStrings(...groups: string[][]): string[] {
  return Array.from(new Set(groups.flat().filter(Boolean)));
}

function hasGenericSocialInstruction(recipe: ParsedRecipe | null): boolean {
  const instructions = recipe?.instructionSections.flatMap(
    (section) => section.instructions,
  );
  if (!instructions?.length) return true;

  return (
    instructions.length === 1 &&
    /follow the method shown in the source video using the listed ingredients/i.test(
      instructions[0]?.instruction ?? "",
    )
  );
}

async function tryAiTikTokRecipe(
  env: Env,
  url: string,
  content: string | null,
  images: string[],
  parseMethod: UrlParseMethod,
): Promise<ParseResult | null> {
  if (!content || content.trim().length < 50) return null;

  try {
    const aiResult = await parseRecipeFromHtml(env.AI, content);
    const recipe = aiResultToRecipe(aiResult, url, images);

    return acceptedCandidate(env, url, recipe, "social_ai", {
      parseMethod,
    });
  } catch (aiError) {
    console.log(
      "[TikTok] AI parsing failed:",
      aiError instanceof Error ? aiError.message : aiError,
    );
    return null;
  }
}

async function tryTikTokBrowserMedia(
  env: Env,
  url: string,
): Promise<{
  content: TikTokContent;
  frameImages: Uint8Array[];
} | null> {
  if (!env.BROWSER) return null;

  try {
    const browserContent = await extractTikTokBrowserContent(env.BROWSER, url);
    return {
      content: {
        caption: browserContent.caption,
        images: browserContent.images,
        videoUrls: browserContent.videoUrls,
        subtitleUrls: [],
        transcript: null,
      },
      frameImages: browserContent.frameImages,
    };
  } catch (error) {
    console.log(
      "[TikTok] Browser media extraction failed:",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

async function parseTikTokUrl(env: Env, url: string): Promise<ParseResult> {
  try {
    let result: TikTokContent = {
      caption: null,
      images: [],
      videoUrls: [],
      subtitleUrls: [],
      transcript: null,
    };
    try {
      result = await extractTikTokContent(url);
    } catch (oembedError) {
      console.log(
        "[TikTok] Oembed failed:",
        oembedError instanceof Error ? oembedError.message : oembedError,
      );
    }

    let frameImages: Uint8Array[] = [];
    let attemptedBrowserMedia = false;
    if (!result.caption || result.caption.length < 50) {
      attemptedBrowserMedia = true;
      const browserMedia = await tryTikTokBrowserMedia(env, url);
      if (browserMedia) {
        result = {
          caption: result.caption || browserMedia.content.caption,
          images: mergeUniqueStrings(
            result.images,
            browserMedia.content.images,
          ),
          videoUrls: mergeUniqueStrings(
            result.videoUrls,
            browserMedia.content.videoUrls,
          ),
          subtitleUrls: mergeUniqueStrings(
            result.subtitleUrls,
            browserMedia.content.subtitleUrls,
          ),
          transcript: result.transcript || browserMedia.content.transcript,
        };
        frameImages = browserMedia.frameImages;
      }
    }

    const fallbackRecipe = extractSocialCaptionRecipe(
      result.caption,
      url,
      result.images,
    );
    const shouldTryFrameOcr = hasGenericSocialInstruction(fallbackRecipe);
    const hasEnrichmentSource =
      Boolean(result.transcript) ||
      result.videoUrls.length > 0 ||
      frameImages.length > 0 ||
      Boolean(env.BROWSER && !attemptedBrowserMedia);

    if (
      !fallbackRecipe &&
      (!result.caption || result.caption.length < 50) &&
      !hasEnrichmentSource
    ) {
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

    const permanentFallbackRecipe = fallbackRecipe
      ? { ...fallbackRecipe, images: permanentImages }
      : null;

    const captionAiResult = await tryAiTikTokRecipe(
      env,
      url,
      result.caption,
      permanentImages,
      "ai_only",
    );
    if (captionAiResult) return captionAiResult;

    if (
      result.transcript ||
      result.videoUrls.length > 0 ||
      frameImages.length > 0 ||
      (env.BROWSER &&
        !attemptedBrowserMedia &&
        result.videoUrls.length === 0 &&
        frameImages.length === 0)
    ) {
      if (
        env.BROWSER &&
        !attemptedBrowserMedia &&
        frameImages.length === 0 &&
        (result.videoUrls.length === 0 || shouldTryFrameOcr)
      ) {
        attemptedBrowserMedia = true;
        const browserMedia = await tryTikTokBrowserMedia(env, url);
        if (browserMedia) {
          result = {
            caption: result.caption || browserMedia.content.caption,
            images: mergeUniqueStrings(
              result.images,
              browserMedia.content.images,
            ),
            videoUrls: mergeUniqueStrings(
              result.videoUrls,
              browserMedia.content.videoUrls,
            ),
            subtitleUrls: mergeUniqueStrings(
              result.subtitleUrls,
              browserMedia.content.subtitleUrls,
            ),
            transcript: result.transcript || browserMedia.content.transcript,
          };
          frameImages = browserMedia.frameImages;
        }
      }

      const enrichment = await enrichSocialMediaRecipeText(env.AI, {
        caption: result.caption,
        transcript: result.transcript,
        videoUrls: result.videoUrls,
        frameImages,
      });

      if (enrichment.transcript || enrichment.frameText) {
        const enrichedImages =
          result.images.length > permanentImages.length
            ? await reuploadImagesToR2(env, result.images, "social/tiktok")
            : permanentImages;

        const enrichedAiResult = await tryAiTikTokRecipe(
          env,
          url,
          enrichment.enrichedText,
          enrichedImages,
          "ai_enhanced",
        );
        if (enrichedAiResult) return enrichedAiResult;
      }
    }

    if (permanentFallbackRecipe) {
      console.log(
        "[TikTok] Falling back to caption ingredient extraction after AI/media parsing did not produce a valid recipe.",
      );
    }

    const fallbackResult = await acceptedCandidate(
      env,
      url,
      permanentFallbackRecipe,
      "social_ai",
      {
        parseMethod: "structured_data",
      },
    );
    if (fallbackResult) return fallbackResult;

    return {
      success: false,
      error: {
        code: "VALIDATION_FAILED",
        message: "Could not parse a valid recipe from the TikTok content",
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
