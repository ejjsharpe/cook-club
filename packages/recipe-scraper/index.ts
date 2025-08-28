import ky from "ky";
import * as cheerio from "cheerio";
import { URL } from "url";

export interface Person {
  name: string;
}

export interface NutritionInformation {
  calories?: string;
  fatContent?: string;
  saturatedFatContent?: string;
  cholesterolContent?: string;
  sodiumContent?: string;
  carbohydrateContent?: string;
  fiberContent?: string;
  sugarContent?: string;
  proteinContent?: string;
  [key: string]: any;
}

type OneOrMany<T> = T | T[];

export interface RawRecipe {
  "@context"?: string;
  "@type"?: OneOrMany<"Recipe">;
  name?: string;
  description?: string;
  image?: OneOrMany<string>;
  author?: OneOrMany<string | Person>;
  datePublished?: string;
  prepTime?: string;
  cookTime?: string;
  totalTime?: string;
  recipeYield?: OneOrMany<string>;
  recipeCategory?: OneOrMany<string>;
  recipeCuisine?: OneOrMany<string>;
  keywords?: OneOrMany<string>;
  nutrition?: NutritionInformation;
  recipeIngredient?: string[];
  recipeInstructions?: OneOrMany<string | { text: string }>;
}

export interface Recipe {
  name: string;
  description: string;
  images: string[];
  author: string;
  datePublished: string;
  prepTime: string;
  cookTime: string;
  totalTime: string;
  servings: number | null;
  categories: string[];
  cuisines: string[];
  keywords: string[];
  nutrition: NutritionInformation;
  ingredients: string[];
  instructions: string[];
}

const USER_AGENTS = [
  "Mozilla/5.0 (iPhone17,2; CPU iPhone OS 18_3_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Resorts/4.5.2",
  "Mozilla/5.0 (iPhone16,2; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Resorts/4.7.5",
  "Mozilla/5.0 (iPhone12,1; U; CPU iPhone OS 13_0 like Mac OS X) AppleWebKit/602.1.50 (KHTML, like Gecko) Version/10.0 Mobile/15E148 Safari/602.1",
  "Mozilla/5.0 (Linux; Android 14; Pixel 9 Pro Build/AD1A.240418.003; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/124.0.6367.54 Mobile Safari/537.36",
  "Mozilla/5.0 (Linux; Android 13; SM-S908B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36",
  "Mozila/5.0 (Linux; Android 14; SM-S928B/DS) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.230 Mobile Safari/537.36",
  "Mozilla/5.0 (Linux; Android 13; 23129RAA4G Build/TKQ1.221114.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/116.0.0.0 Mobile Safari/537.36",
];

function getRandomUserAgent(): string {
  const idx = Math.floor(Math.random() * USER_AGENTS.length);
  return USER_AGENTS[idx]!;
}

export async function fetchHTMLContent(
  url: string,
  timeout = 10000
): Promise<string> {
  const response = await ky.get(url, {
    headers: { "User-Agent": getRandomUserAgent() },
    timeout,
    retry: { limit: 2, statusCodes: [408, 429, 500, 502, 503, 504] },
  });
  return response.text();
}

function resolveUrl(baseUrl: string, relative: string): string {
  try {
    return new URL(relative, baseUrl).href;
  } catch {
    return relative;
  }
}

function parseJsonLd(
  $: cheerio.CheerioAPI,
  baseUrl: string
): Partial<RawRecipe> {
  const result: Partial<RawRecipe> = {};
  $('script[type="application/ld+json"]').each((_i, el) => {
    let data: any;
    try {
      data = JSON.parse($(el).text());
    } catch {
      return;
    }
    const items = Array.isArray(data) ? data : data["@graph"] || [data];
    for (const item of items) {
      const types = Array.isArray(item["@type"])
        ? item["@type"]
        : [item["@type"]];

      if (!types.includes("Recipe")) continue;

      Object.assign(result, item);

      if (typeof result.image === "string") {
        result.image = resolveUrl(baseUrl, result.image);
      } else if (Array.isArray(result.image)) {
        result.image = result.image
          .map((src: any) => {
            if (typeof src === "string") {
              return resolveUrl(baseUrl, src);
            } else if (typeof src === "object" && src) {
              // Handle image objects with url, @id, or contentUrl properties
              const imageUrl =
                src.url || src["@id"] || src.contentUrl || src.src;
              return imageUrl ? resolveUrl(baseUrl, imageUrl) : "";
            }
            return "";
          })
          .filter((url: string) => url);
      }

      if (Array.isArray(item.instructions)) {
        result.recipeInstructions = item.instructions
          .map((step: any) =>
            typeof step === "string" ? step : step.text || ""
          )
          .filter((t: string) => t.trim());
      }
      return false;
    }
  });
  return result;
}

function parseMicrodata(
  $: cheerio.CheerioAPI,
  baseUrl: string
): Partial<RawRecipe> {
  const root = $('[itemtype*="Recipe"]').first();
  if (!root.length) return {};
  const md: Partial<RawRecipe> = {};

  const getContent = (prop: string) => {
    const e = root.find(`[itemprop="${prop}"]`).first();
    if (!e.length) return "";
    if (e.is("img")) return resolveUrl(baseUrl, e.attr("src") || "");
    return (e.attr("content") || e.text()).trim();
  };

  const getAll = (prop: string) =>
    root
      .find(`[itemprop="${prop}"]`)
      .toArray()
      .map((el) => {
        const $el = $(el);
        return ($el.attr("content") || $el.text()).trim();
      })
      .filter((t) => t);

  md.name = getContent("name");
  md.description = getContent("description");
  md.image = getContent("image");
  md.author = getContent("author");
  md.datePublished = getContent("datePublished");
  md.prepTime = getContent("prepTime");
  md.cookTime = getContent("cookTime");
  md.totalTime = getContent("totalTime");
  md.recipeYield = getContent("recipeYield");
  md.recipeCategory = getAll("recipeCategory");
  md.recipeCuisine = getAll("recipeCuisine");
  md.keywords = getContent("keywords");
  md.recipeIngredient = getAll("recipeIngredient");
  md.recipeInstructions = getAll("recipeInstructions");

  const nut = root.find('[itemprop="nutrition"]').first();
  if (nut.length) {
    const n: NutritionInformation = {};
    nut.find("[itemprop]").each((_i, el) => {
      const $el = $(el);
      const key = $el.attr("itemprop")!;
      const val = ($el.attr("content") || $el.text()).trim();
      n[key] = val;
    });
    md.nutrition = n;
  }
  return md;
}

function normalize<T>(x?: OneOrMany<T>): T[] {
  if (x == null) return [];
  return Array.isArray(x) ? x : [x];
}

function normalizeStrings(x?: OneOrMany<string>): string[] {
  return normalize(x).filter((s) => typeof s === "string") as string[];
}

function normalizeAuthor(a?: OneOrMany<string | Person>): string {
  const arr = normalize(a);
  const first = arr[0];
  return first ? (typeof first === "string" ? first : first.name) : "";
}

function extractServingsFromYield(
  yieldValue?: string | string[]
): number | null {
  if (!yieldValue) return null;

  // Convert array to string, or use string as-is
  const yieldStr = Array.isArray(yieldValue)
    ? yieldValue.join(" ")
    : yieldValue;

  // Common patterns for servings/yield
  const patterns = [
    /(\d+)\s*servings?/i, // "4 servings", "8 Servings"
    /serves?\s*(\d+)/i, // "serves 4", "Serves 6"
    /makes?\s*(\d+)/i, // "makes 8", "Makes 12"
    /(\d+)\s*portions?/i, // "6 portions", "4 Portions"
    /(\d+)\s*people?/i, // "4 people", "6 People"
    /yield:?\s*(\d+)/i, // "Yield: 8", "yield 4"
    /^(\d+)$/, // Just a number "6"
    /(\d+)\s*-\s*(\d+)/, // Range "4-6", take the first number
  ];

  for (const pattern of patterns) {
    const match = yieldStr.match(pattern);
    if (match) {
      const num = parseInt(match[1]!, 10);
      if (!isNaN(num) && num > 0) {
        return num;
      }
    }
  }

  return null;
}

export function toRecipe(raw: Partial<RawRecipe>, baseUrl: string): Recipe {
  const nutEntries = raw.nutrition
    ? Object.entries(raw.nutrition).filter(([k]) => k !== "@type")
    : [];
  const nutrition = Object.fromEntries(nutEntries) as NutritionInformation;

  return {
    name: raw.name || "",
    description: raw.description || "",
    images: normalizeStrings(raw.image).map((u) => resolveUrl(baseUrl, u)),
    author: normalizeAuthor(raw.author),
    datePublished: raw.datePublished || "",
    prepTime: raw.prepTime || "",
    cookTime: raw.cookTime || "",
    totalTime: raw.totalTime || "",
    servings: extractServingsFromYield(raw.recipeYield),
    categories: normalizeStrings(raw.recipeCategory),
    cuisines: normalizeStrings(raw.recipeCuisine),
    keywords: normalizeStrings(raw.keywords),
    nutrition,
    ingredients: raw.recipeIngredient || [],
    instructions: normalize(raw.recipeInstructions)
      .map((s) => (typeof s === "string" ? s : s.text))
      .filter((s) => !!s),
  };
}

export async function scrapeRecipe(url: string): Promise<Recipe> {
  const html = await fetchHTMLContent(url);
  const $ = cheerio.load(html);
  const jsonLd = parseJsonLd($, url);
  const micro = parseMicrodata($, url);
  const raw: Partial<RawRecipe> = { ...micro, ...jsonLd };
  return toRecipe(raw, url);
}
