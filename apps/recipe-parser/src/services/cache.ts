import type { ParsedRecipe } from "../schema";
import type { Env } from "../types";

const CACHE_TTL_SECONDS = 86400; // 24 hours

/**
 * Generate a cache key from a URL
 */
async function urlToKey(url: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(url.toLowerCase());
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `recipe:${hashHex}`;
}

/**
 * Get cached recipe for a URL
 */
export async function getCachedRecipe(
  kv: Env["RECIPE_CACHE"],
  url: string,
): Promise<ParsedRecipe | null> {
  const key = await urlToKey(url);
  const cached = await kv.get(key, "json");

  if (cached) {
    return cached as ParsedRecipe;
  }

  return null;
}

/**
 * Cache a parsed recipe for a URL
 */
export async function cacheRecipe(
  kv: Env["RECIPE_CACHE"],
  url: string,
  recipe: ParsedRecipe,
): Promise<void> {
  const key = await urlToKey(url);
  await kv.put(key, JSON.stringify(recipe), {
    expirationTtl: CACHE_TTL_SECONDS,
  });
}
