import type { ParsedRecipe } from "../schema";
import { ParsedRecipeSchema } from "../schema";
import type { Env, ParseResult } from "../types";
import { parseRecipeFromHtml } from "./ai-client";
import { deleteCachedRecipe, getCachedRecipe } from "./cache";
import { aiResultToRecipe } from "./recipe-mapper";
import { getSocialPlatform, parseSocialUrl } from "./social-url-parser";
import {
  acceptedBestCandidate,
  acceptedCandidate,
  type RecipeCandidate,
} from "./url-parse-utils";
import {
  discoverAlternateRecipeUrls,
  getWordPressRestPostUrl,
} from "../utils/alternate-pages";
import {
  requiresBrowserRendering,
  fetchHtmlWithBrowser,
} from "../utils/browser-fetcher";
import {
  cleanHtml,
  extractImageUrls,
  extractStepImageContext,
  focusRecipeContent,
} from "../utils/html-cleaner";
import { fetchHtml, isLikelyBotBlockedError } from "../utils/html-fetcher";
import { fetchReaderMarkdown } from "../utils/reader-fetcher";
import {
  evaluateRecipeQuality,
  mergeRecipeImages,
  normalizeRecipeForImport,
  normalizeRecipeUrl,
} from "../utils/recipe-quality";
import { extractStructuredRecipeCandidates } from "../utils/structured-data";
import {
  extractMarkdownRecipeCard,
  extractVisibleRecipeCard,
} from "../utils/visible-recipe-card";

export interface ParseUrlOptions {
  /** If true, only use structured data extraction (no AI). For Basic Import. */
  structuredOnly?: boolean;
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

function structuredRecipeCandidates(
  html: string,
  htmlUrl: string,
  sourceUrl: string,
  imageUrls: string[],
): RecipeCandidate[] {
  return extractStructuredRecipeCandidates(html, htmlUrl).map((recipe) => ({
    recipe: mergeRecipeImages({ ...recipe, sourceUrl }, imageUrls),
    source: "structured",
    parseMethod: "schema_org",
  }));
}

async function tryDeterministicHtmlRecipe(
  env: Env,
  cacheUrl: string,
  html: string,
  htmlUrl: string,
  sourceUrl: string,
): Promise<ParseResult | null> {
  const imageUrls = extractImageUrls(html, htmlUrl);
  const structuredResult = await acceptedBestCandidate(
    env,
    cacheUrl,
    structuredRecipeCandidates(html, htmlUrl, sourceUrl, imageUrls),
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
    { parseMethod: "visible_card" },
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

  if (socialPlatform) {
    return parseSocialUrl(env, sourceUrl, socialPlatform);
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

  const imageUrls = extractImageUrls(html, sourceUrl);

  // Try structured data extraction first (JSON-LD, hydration, microdata, recipe cards)
  let structuredCandidates: RecipeCandidate[] = [];
  try {
    structuredCandidates = structuredRecipeCandidates(
      html,
      sourceUrl,
      sourceUrl,
      imageUrls,
    );
  } catch (error) {
    console.error("Structured data extraction error:", error);
  }

  // For Basic Import (structuredOnly): return structured data or error
  if (structuredOnly) {
    const structuredResult = await acceptedBestCandidate(
      env,
      sourceUrl,
      structuredCandidates,
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

  const structuredResult = await acceptedBestCandidate(
    env,
    sourceUrl,
    structuredCandidates,
  );
  if (structuredResult) return structuredResult;

  const visibleRecipe = extractVisibleRecipeCard(html, sourceUrl);
  const visibleResult = await acceptedCandidate(
    env,
    sourceUrl,
    visibleRecipe ? mergeRecipeImages(visibleRecipe, imageUrls) : null,
    "visible",
    { parseMethod: "visible_card" },
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
    const recipe = aiResultToRecipe(aiResult, {
      sourceType: "url",
      sourceUrl,
      images: imageUrls,
    });
    const aiResultResponse = await acceptedCandidate(
      env,
      sourceUrl,
      recipe,
      "ai",
      { parseMethod: structuredCandidates.length ? "ai_enhanced" : "ai_only" },
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
