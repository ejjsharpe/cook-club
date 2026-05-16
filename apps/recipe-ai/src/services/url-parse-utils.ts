import type { ParsedRecipe } from "../schema";
import { ParsedRecipeSchema } from "../schema";
import type { Env, ParseMetadata, ParseResult } from "../types";
import { parseRecipeFromHtml } from "./ai-client";
import { cacheRecipe } from "./cache";
import { aiResultToRecipe } from "./recipe-mapper";
import {
  evaluateRecipeQuality,
  normalizeRecipeForImport,
  type RecipeQuality,
  type RecipeQualitySource,
} from "../utils/recipe-quality";
import { extractSocialCaptionRecipe } from "../utils/social-caption-recipe";

export type UrlParseMethod = NonNullable<ParseMetadata["parseMethod"]>;

interface CandidateOptions {
  parseMethod?: UrlParseMethod;
  cache?: boolean;
}

export interface RecipeCandidate {
  recipe: ParsedRecipe | null;
  source: RecipeQualitySource;
  parseMethod?: UrlParseMethod;
  cache?: boolean;
}

interface EvaluatedRecipeCandidate {
  recipe: ParsedRecipe;
  quality: RecipeQuality;
  parseMethod?: UrlParseMethod;
  cache?: boolean;
}

export interface AiRecipeAttempt {
  result: ParseResult | null;
  error: unknown;
}

export async function reuploadImagesToR2(
  env: Env,
  imageUrls: string[],
  prefix: string,
): Promise<string[]> {
  if (!imageUrls.length) return [];

  if (!env.IMAGE_SERVICE) {
    console.log(
      "[reupload] IMAGE_SERVICE binding not available (dev mode?) - using original URLs",
    );
    return imageUrls;
  }

  const results = await Promise.all(
    imageUrls.map(async (sourceUrl, index) => {
      try {
        const imageId = crypto.randomUUID();
        const destinationKey = `${prefix}/${imageId}.jpg`;

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
        }

        console.log(
          `[reupload] Failed to upload image ${index + 1}: ${result.error}`,
        );
        return sourceUrl;
      } catch (error) {
        console.log(
          `[reupload] Error uploading image ${index + 1}:`,
          error instanceof Error ? error.message : error,
        );
        return sourceUrl;
      }
    }),
  );

  return results;
}

function candidateParseMethod(
  source: RecipeQualitySource,
): UrlParseMethod | undefined {
  if (source === "ai" || source === "social_ai") return "ai_only";
  if (source === "structured") return "schema_org";
  if (source === "visible") return "visible_card";
  if (source === "reader") return "reader";
  return undefined;
}

function evaluateCandidate(
  recipe: ParsedRecipe | null,
  source: RecipeQualitySource,
  options: CandidateOptions = {},
): EvaluatedRecipeCandidate | null {
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

  return {
    recipe: normalizedRecipe,
    quality,
    parseMethod: options.parseMethod ?? candidateParseMethod(source),
    cache: options.cache,
  };
}

async function resultFromEvaluatedCandidate(
  env: Env,
  cacheUrl: string,
  candidate: EvaluatedRecipeCandidate,
): Promise<ParseResult> {
  if (candidate.cache !== false) {
    try {
      await cacheRecipe(env.RECIPE_CACHE, cacheUrl, candidate.recipe);
    } catch (error) {
      console.log(
        "Recipe cache write failed:",
        error instanceof Error ? error.message : error,
      );
    }
  }

  const metadata: ParseMetadata = {
    source: "url",
    confidence: candidate.quality.confidence,
    cached: false,
  };
  if (candidate.parseMethod) {
    metadata.parseMethod = candidate.parseMethod;
  }

  return {
    success: true,
    data: candidate.recipe,
    metadata,
  };
}

export async function acceptedCandidate(
  env: Env,
  cacheUrl: string,
  recipe: ParsedRecipe | null,
  source: RecipeQualitySource,
  options: CandidateOptions = {},
): Promise<ParseResult | null> {
  const candidate = evaluateCandidate(recipe, source, options);
  return candidate
    ? resultFromEvaluatedCandidate(env, cacheUrl, candidate)
    : null;
}

export async function acceptedBestCandidate(
  env: Env,
  cacheUrl: string,
  candidates: RecipeCandidate[],
): Promise<ParseResult | null> {
  const evaluatedCandidates = candidates
    .map((candidate) =>
      evaluateCandidate(candidate.recipe, candidate.source, {
        parseMethod: candidate.parseMethod,
        cache: candidate.cache,
      }),
    )
    .filter(
      (candidate): candidate is EvaluatedRecipeCandidate => candidate !== null,
    )
    .sort((a, b) => b.quality.score - a.quality.score);

  const bestCandidate = evaluatedCandidates[0];
  return bestCandidate
    ? resultFromEvaluatedCandidate(env, cacheUrl, bestCandidate)
    : null;
}

export async function tryAiRecipeCandidate(
  env: Env,
  url: string,
  content: string | null,
  images: string[],
  source: RecipeQualitySource,
  parseMethod: UrlParseMethod,
  logPrefix: string,
): Promise<AiRecipeAttempt> {
  if (!content || content.trim().length < 50) {
    return { result: null, error: null };
  }

  try {
    const aiResult = await parseRecipeFromHtml(env.AI, content);
    const recipe = aiResultToRecipe(aiResult, {
      sourceType: "url",
      sourceUrl: url,
      images,
    });

    return {
      result: await acceptedCandidate(env, url, recipe, source, {
        parseMethod,
      }),
      error: null,
    };
  } catch (error) {
    console.log(
      `${logPrefix} AI parsing failed:`,
      error instanceof Error ? error.message : error,
    );
    return { result: null, error };
  }
}

export async function trySocialCaptionRecipe(
  env: Env,
  url: string,
  content: string | null,
  images: string[],
): Promise<ParseResult | null> {
  return acceptedCandidate(
    env,
    url,
    extractSocialCaptionRecipe(content, url, images),
    "social_ai",
    { parseMethod: "caption_rules" },
  );
}
