import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";

import type {
  ParsedRecipe,
  Ingredient,
  Instruction,
  IngredientSection,
  InstructionSection,
  Tag,
} from "../schema";
import { parseIngredientText } from "./ingredient-parser";

function decodeHtmlEntities(value: string): string {
  if (!value.includes("&")) return value;
  return cheerio.load("<textarea></textarea>")("textarea").html(value).text();
}

function normalizeStructuredText(value: string): string {
  return decodeHtmlEntities(value)
    .replace(/\u00a0/g, " ")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .trim();
}

/**
 * Parse ISO 8601 duration string (e.g., "PT30M", "PT1H30M") to minutes
 * Returns null if the duration string is invalid or missing
 */
function parseIsoDurationToMinutes(
  duration: string | null | undefined,
): number | null {
  if (!duration) return null;

  // Match ISO 8601 duration pattern: PT[nH][nM][nS]
  const match = duration.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i);
  if (!match) return null;

  const hours = parseInt(match[1] || "0", 10);
  const minutes = parseInt(match[2] || "0", 10);
  const seconds = parseInt(match[3] || "0", 10);

  // Convert to total minutes (rounding up seconds)
  const totalMinutes = hours * 60 + minutes + Math.ceil(seconds / 60);

  return totalMinutes > 0 ? totalMinutes : null;
}

function parseDurationToMinutes(
  duration: string | null | undefined,
): number | null {
  const isoMinutes = parseIsoDurationToMinutes(duration);
  if (isoMinutes) return isoMinutes;
  if (!duration) return null;

  const normalized = normalizeStructuredText(duration).toLowerCase();
  let totalMinutes = 0;

  for (const match of normalized.matchAll(
    /(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|hr|h)\b/g,
  )) {
    totalMinutes += Math.round(Number(match[1]) * 60);
  }

  for (const match of normalized.matchAll(
    /(\d+(?:\.\d+)?)\s*(?:minutes?|mins?|min|m)\b/g,
  )) {
    totalMinutes += Math.round(Number(match[1]));
  }

  return totalMinutes > 0 ? totalMinutes : null;
}

type OneOrMany<T> = T | T[];
type CheerioSelection = cheerio.Cheerio<AnyNode>;

/**
 * Schema.org ImageObject
 * @see https://schema.org/ImageObject
 */
interface ImageObject {
  "@type"?: "ImageObject";
  url?: string;
  contentUrl?: string;
  "@id"?: string;
}

/**
 * Schema.org HowToStep - A single step in a recipe
 * @see https://schema.org/HowToStep
 */
interface HowToStep {
  "@type"?: "HowToStep";
  text?: string;
  name?: string;
  image?: OneOrMany<string | ImageObject>;
}

/**
 * Schema.org HowToSection - A grouping of steps
 * @see https://schema.org/HowToSection
 */
interface HowToSection {
  "@type"?: "HowToSection";
  name?: string;
  itemListElement?: OneOrMany<HowToStep | string>;
}

/**
 * Schema.org Recipe
 * @see https://schema.org/Recipe
 */
interface SchemaOrgRecipe {
  "@context"?: string;
  "@type"?: OneOrMany<string>;
  name?: string;
  description?: string;
  image?: OneOrMany<string | ImageObject>;
  prepTime?: string;
  cookTime?: string;
  totalTime?: string;
  recipeYield?: OneOrMany<string | number>;
  recipeCategory?: OneOrMany<string>;
  recipeCuisine?: OneOrMany<string>;
  keywords?: OneOrMany<string>;
  recipeIngredient?: OneOrMany<string>;
  recipeInstructions?: OneOrMany<string | HowToStep | HowToSection>;
}

/**
 * Extract deterministic recipe data from HTML.
 * Sources are tried from most explicit to most heuristic:
 * JSON-LD, framework hydration JSON, microdata/RDFa, and known recipe cards.
 */
export function extractStructuredRecipe(
  html: string,
  sourceUrl: string,
): ParsedRecipe | null {
  return extractStructuredRecipeCandidates(html, sourceUrl)[0] ?? null;
}

export function extractStructuredRecipeCandidates(
  html: string,
  sourceUrl: string,
): ParsedRecipe[] {
  try {
    const $ = cheerio.load(html);

    const candidates = [
      parseJsonLd($),
      parseHydrationData($),
      parseMicrodataRecipe($),
      parseRecipePluginCard($),
    ];

    return candidates.flatMap((candidate) => {
      const raw = normalizeRawRecipe(candidate, sourceUrl);
      return hasMinimumRecipeData(raw) ? [toParsedRecipe(raw, sourceUrl)] : [];
    });
  } catch (error) {
    console.error("Error extracting structured recipe data:", error);
    return [];
  }
}

function resolveUrl(baseUrl: string, relative: string): string {
  try {
    return new URL(relative, baseUrl).href;
  } catch {
    return relative;
  }
}

/**
 * Parse JSON-LD script tags to find schema.org Recipe data
 */
function normalizeRawRecipe(
  raw: Partial<SchemaOrgRecipe>,
  baseUrl: string,
): Partial<SchemaOrgRecipe> {
  if (!raw.image) return raw;
  return {
    ...raw,
    image: normalizeImages(raw.image, baseUrl),
  };
}

function hasMinimumRecipeData(raw: Partial<SchemaOrgRecipe>): boolean {
  const ingredients = normalizeStrings(raw.recipeIngredient);
  const instructions = normalizeToArray(raw.recipeInstructions);
  return Boolean(raw.name && ingredients.length > 0 && instructions.length > 0);
}

function parseJsonLd($: cheerio.CheerioAPI): Partial<SchemaOrgRecipe> {
  let result: Partial<SchemaOrgRecipe> = {};

  $('script[type="application/ld+json"]').each((_i, el) => {
    // Skip if we already found a recipe
    if (result.name) return;

    let data: unknown;
    try {
      data = JSON.parse($(el).text());
    } catch {
      // Ignore invalid JSON-LD.
    }

    const recipe = findRecipeInJsonLd(data);
    if (recipe) {
      result = recipe;
    }
  });

  return result;
}

function parseHydrationData($: cheerio.CheerioAPI): Partial<SchemaOrgRecipe> {
  let result: Partial<SchemaOrgRecipe> = {};
  const selectors = [
    "script#__NEXT_DATA__",
    "script#___gatsby",
    'script[type="application/json"]',
  ].join(",");

  $(selectors).each((_i, el) => {
    if (result.name) return;

    const text = $(el).text().trim();
    if (!text || text.length > 2_000_000) return;

    try {
      const recipe = findRecipeInJsonLd(JSON.parse(text));
      if (recipe) {
        result = recipe;
      }
    } catch {
      // Ignore non-JSON hydration scripts.
    }
  });

  if (!result.name) {
    $("script:not([src])").each((_i, el) => {
      if (result.name) return;

      const text = $(el).text();
      if (!text.includes("@type") || !text.includes("Recipe")) return;

      for (const jsonText of extractAssignedJsonBlocks(text)) {
        try {
          const recipe = findRecipeInJsonLd(JSON.parse(jsonText));
          if (recipe) {
            result = recipe;
            return;
          }
        } catch {
          continue;
        }
      }
    });
  }

  return result;
}

/**
 * Recursively search JSON-LD data for a Recipe object
 */
function findRecipeInJsonLd(data: unknown): Partial<SchemaOrgRecipe> | null {
  if (!data || typeof data !== "object") return null;

  // Handle arrays (could be array of schemas or @graph)
  if (Array.isArray(data)) {
    for (const item of data) {
      const recipe = findRecipeInJsonLd(item);
      if (recipe) return recipe;
    }
    return null;
  }

  const obj = data as Record<string, unknown>;

  // Check @graph property
  if (obj["@graph"] && Array.isArray(obj["@graph"])) {
    return findRecipeInJsonLd(obj["@graph"]);
  }

  if (isRecipeType(obj["@type"] as OneOrMany<string> | undefined)) {
    return obj as Partial<SchemaOrgRecipe>;
  }

  for (const value of Object.values(obj)) {
    const recipe = findRecipeInJsonLd(value);
    if (recipe) return recipe;
  }

  return null;
}

function isRecipeType(type: OneOrMany<string> | undefined): boolean {
  return normalizeToArray(type).some((value) => {
    if (typeof value !== "string") return false;
    return /(^|[/#:])Recipe$/i.test(value.trim());
  });
}

function propertySelector(prop: string): string {
  return [
    `[itemprop~="${prop}"]`,
    `[property~="${prop}"]`,
    `[property~="schema:${prop}"]`,
    `[property~="https://schema.org/${prop}"]`,
  ].join(",");
}

function readElementValue($: cheerio.CheerioAPI, el: AnyNode): string {
  const $el = $(el);
  const value =
    $el.attr("content") ||
    $el.attr("datetime") ||
    $el.attr("value") ||
    $el.attr("src") ||
    $el.attr("data-src") ||
    $el.attr("href") ||
    $el.text();

  return normalizeStructuredText(value || "");
}

function readElementUrl($: cheerio.CheerioAPI, el: AnyNode): string | null {
  const $el = $(el);
  const srcset =
    $el.attr("data-srcset") ||
    $el.attr("srcset") ||
    $el.find("[data-srcset], [srcset]").first().attr("data-srcset") ||
    $el.find("[data-srcset], [srcset]").first().attr("srcset");
  const value =
    $el.attr("content") ||
    $el.attr("src") ||
    $el.attr("data-src") ||
    $el.attr("data-lazy-src") ||
    $el.attr("href") ||
    chooseLargestSrcsetUrl(srcset || "");

  const normalized = normalizeStructuredText(value || "");
  return normalized && !normalized.startsWith("data:") ? normalized : null;
}

function chooseLargestSrcsetUrl(srcset: string): string | null {
  if (!srcset) return null;

  const candidates = srcset
    .split(",")
    .map((candidate) => {
      const [url, descriptor] = candidate.trim().split(/\s+/, 2);
      const width = descriptor?.endsWith("w")
        ? Number(descriptor.slice(0, -1))
        : 0;
      return { url, width: Number.isFinite(width) ? width : 0 };
    })
    .filter((candidate): candidate is { url: string; width: number } =>
      Boolean(candidate.url),
    );

  candidates.sort((a, b) => b.width - a.width);
  return candidates[0]?.url || null;
}

function readFirstPropertyValue(
  $: cheerio.CheerioAPI,
  $scope: CheerioSelection,
  props: string[],
): string | undefined {
  for (const prop of props) {
    const el = $scope.find(propertySelector(prop)).toArray()[0];
    if (!el) continue;

    const value = readElementValue($, el);
    if (value) return value;
  }

  return undefined;
}

function uniqueUsefulValues(values: string[], maxLength = 500): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const normalized = normalizeStructuredText(value);
    const dedupeKey = normalized.toLowerCase();
    if (
      !normalized ||
      normalized.length > maxLength ||
      seen.has(dedupeKey) ||
      /^(ingredients|instructions|directions|method|nutrition)$/i.test(
        normalized,
      ) ||
      /\b(advertisement|sponsored|sign up|log in|print recipe)\b/i.test(
        normalized,
      )
    ) {
      continue;
    }

    seen.add(dedupeKey);
    result.push(normalized);
  }

  return result;
}

function readPropertyValues(
  $: cheerio.CheerioAPI,
  $scope: CheerioSelection,
  props: string[],
  maxLength = 500,
): string[] {
  const values: string[] = [];

  for (const prop of props) {
    $scope.find(propertySelector(prop)).each((_i, el) => {
      const value = readElementValue($, el);
      if (value) values.push(value);
    });
  }

  return uniqueUsefulValues(values, maxLength);
}

function readPropertyImageValues(
  $: cheerio.CheerioAPI,
  $scope: CheerioSelection,
): string[] {
  const values: string[] = [];

  $scope.find(propertySelector("image")).each((_i, el) => {
    const url = readElementUrl($, el);
    if (url) values.push(url);
  });

  return uniqueUsefulValues(values, 1_000);
}

function isStructuredType($el: CheerioSelection, typeName: string): boolean {
  const itemType = $el.attr("itemtype") || "";
  const rdfType = $el.attr("typeof") || "";
  return (
    itemType.toLowerCase().includes(typeName.toLowerCase()) ||
    rdfType
      .split(/\s+/)
      .some((value) => value.toLowerCase().endsWith(typeName.toLowerCase()))
  );
}

function instructionTextFromElement(
  $: cheerio.CheerioAPI,
  el: AnyNode,
): string[] {
  const $el = $(el);
  const textProps = $el.find(propertySelector("text")).toArray();
  if (textProps.length > 0) {
    return uniqueUsefulValues(
      textProps.map((textEl) => readElementValue($, textEl)),
    );
  }

  const listItems = $el.find("li").toArray();
  if (listItems.length > 0) {
    return uniqueUsefulValues(listItems.map((li) => readElementValue($, li)));
  }

  return uniqueUsefulValues([readElementValue($, el)]);
}

function readInstructionValues(
  $: cheerio.CheerioAPI,
  $scope: CheerioSelection,
): OneOrMany<string | HowToStep | HowToSection> | undefined {
  const instructions: (string | HowToStep | HowToSection)[] = [];

  $scope.find(propertySelector("recipeInstructions")).each((_i, el) => {
    const $el = $(el);
    if (isStructuredType($el, "HowToSection")) {
      const steps = instructionTextFromElement($, el).map<HowToStep>(
        (text) => ({
          "@type": "HowToStep",
          text,
        }),
      );
      if (steps.length > 0) {
        instructions.push({
          "@type": "HowToSection",
          name: readFirstPropertyValue($, $el, ["name"]),
          itemListElement: steps,
        });
      }
      return;
    }

    for (const text of instructionTextFromElement($, el)) {
      instructions.push({ "@type": "HowToStep", text });
    }
  });

  if (instructions.length === 0) return undefined;

  const seen = new Set<string>();
  return instructions.filter((instruction) => {
    let text: string | undefined;
    if (typeof instruction === "string") {
      text = instruction;
    } else if (instruction["@type"] === "HowToSection") {
      const section = instruction as HowToSection;
      text = normalizeToArray(section.itemListElement)
        .map((step) => (typeof step === "string" ? step : step.text))
        .join(" ");
    } else {
      const step = instruction as HowToStep;
      text = step.text;
    }
    const key = normalizeStructuredText(text || "").toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function parseMicrodataRecipe($: cheerio.CheerioAPI): Partial<SchemaOrgRecipe> {
  const scopes = $(
    [
      '[itemscope][itemtype*="schema.org/Recipe"]',
      '[itemscope][itemtype*="schema.org/recipe"]',
      '[typeof~="Recipe"]',
      '[typeof~="schema:Recipe"]',
      '[typeof*="schema.org/Recipe"]',
    ].join(","),
  ).toArray();

  for (const scope of scopes) {
    const $scope = $(scope);
    const candidate: Partial<SchemaOrgRecipe> = {
      name: readFirstPropertyValue($, $scope, ["name"]),
      description: readFirstPropertyValue($, $scope, ["description"]),
      image: readPropertyImageValues($, $scope),
      prepTime: readFirstPropertyValue($, $scope, ["prepTime"]),
      cookTime: readFirstPropertyValue($, $scope, ["cookTime"]),
      totalTime: readFirstPropertyValue($, $scope, ["totalTime"]),
      recipeYield: readFirstPropertyValue($, $scope, ["recipeYield", "yield"]),
      recipeCategory: readPropertyValues($, $scope, ["recipeCategory"], 100),
      recipeCuisine: readPropertyValues($, $scope, ["recipeCuisine"], 100),
      keywords: readPropertyValues($, $scope, ["keywords"], 250),
      recipeIngredient: readPropertyValues(
        $,
        $scope,
        ["recipeIngredient"],
        300,
      ),
      recipeInstructions: readInstructionValues($, $scope),
    };

    if (hasMinimumRecipeData(candidate)) {
      return candidate;
    }
  }

  return {};
}

interface RecipePluginConfig {
  cardSelectors: string[];
  nameSelectors: string[];
  descriptionSelectors?: string[];
  imageSelectors?: string[];
  ingredientSelectors: string[];
  instructionSelectors: string[];
  prepTimeSelectors?: string[];
  cookTimeSelectors?: string[];
  totalTimeSelectors?: string[];
  yieldSelectors?: string[];
}

const RECIPE_PLUGIN_CONFIGS: RecipePluginConfig[] = [
  {
    cardSelectors: [".wprm-recipe"],
    nameSelectors: [".wprm-recipe-name"],
    descriptionSelectors: [".wprm-recipe-summary"],
    imageSelectors: [".wprm-recipe-image img"],
    ingredientSelectors: [".wprm-recipe-ingredient"],
    instructionSelectors: [".wprm-recipe-instruction-text"],
    prepTimeSelectors: [".wprm-recipe-prep_time"],
    cookTimeSelectors: [".wprm-recipe-cook_time"],
    totalTimeSelectors: [".wprm-recipe-total_time"],
    yieldSelectors: [".wprm-recipe-servings"],
  },
  {
    cardSelectors: [".tasty-recipes"],
    nameSelectors: [".tasty-recipes-title"],
    descriptionSelectors: [".tasty-recipes-description"],
    imageSelectors: [".tasty-recipes-image img"],
    ingredientSelectors: [".tasty-recipes-ingredients li"],
    instructionSelectors: [".tasty-recipes-instructions li"],
    prepTimeSelectors: [".tasty-recipes-prep-time"],
    cookTimeSelectors: [".tasty-recipes-cook-time"],
    totalTimeSelectors: [".tasty-recipes-total-time"],
    yieldSelectors: [".tasty-recipes-yield"],
  },
  {
    cardSelectors: [".mv-create-card", ".mv-create-card-recipe"],
    nameSelectors: [".mv-create-title", ".mv-create-card-title", "h2", "h3"],
    descriptionSelectors: [".mv-create-description"],
    imageSelectors: [".mv-create-image img", "img"],
    ingredientSelectors: [".mv-create-ingredients li"],
    instructionSelectors: [
      ".mv-create-instructions li",
      ".mv-create-directions li",
    ],
    prepTimeSelectors: [".mv-create-time-prep"],
    cookTimeSelectors: [".mv-create-time-active", ".mv-create-time-cook"],
    totalTimeSelectors: [".mv-create-time-total"],
    yieldSelectors: [".mv-create-time-yield", ".mv-create-yield"],
  },
  {
    cardSelectors: [
      ".zip-recipes",
      ".easyrecipe",
      ".easy-recipes",
      ".recipe-card",
      ".recipe",
    ],
    nameSelectors: [
      ".recipe-title",
      ".recipe-card-title",
      ".ERSName",
      ".easyrecipe-title",
      "h2",
      "h3",
    ],
    descriptionSelectors: [
      ".recipe-summary",
      ".recipe-description",
      ".ERSDescription",
      ".summary",
    ],
    imageSelectors: [".recipe-image img", ".ERSPhoto img", "img"],
    ingredientSelectors: [
      ".ingredients li",
      ".ingredient-list li",
      ".ERSIngredients li",
      ".easyrecipe-ingredients li",
      "[class*='ingredient'] li",
    ],
    instructionSelectors: [
      ".instructions li",
      ".directions li",
      ".method li",
      ".ERSInstructions li",
      ".easyrecipe-instructions li",
      "[class*='instruction'] li",
      "[class*='direction'] li",
    ],
    prepTimeSelectors: [".prep-time", ".ERSTimePrep"],
    cookTimeSelectors: [".cook-time", ".ERSTimeCook"],
    totalTimeSelectors: [".total-time", ".ERSTimeTotal"],
    yieldSelectors: [".yield", ".servings", ".ERSYield"],
  },
];

function readFirstSelectorText(
  $: cheerio.CheerioAPI,
  $scope: CheerioSelection,
  selectors: string[] | undefined,
): string | undefined {
  if (!selectors) return undefined;

  for (const selector of selectors) {
    const el = $scope.find(selector).toArray()[0];
    if (!el) continue;

    const value = readElementValue($, el);
    if (value) return value;
  }

  return undefined;
}

function readSelectorTexts(
  $: cheerio.CheerioAPI,
  $scope: CheerioSelection,
  selectors: string[],
  maxLength = 500,
): string[] {
  const values: string[] = [];

  for (const selector of selectors) {
    $scope.find(selector).each((_i, el) => {
      const value = readElementValue($, el);
      if (value) values.push(value);
    });

    if (values.length > 0) break;
  }

  return uniqueUsefulValues(values, maxLength);
}

function readSelectorImages(
  $: cheerio.CheerioAPI,
  $scope: CheerioSelection,
  selectors: string[] | undefined,
): string[] {
  if (!selectors) return [];

  const values: string[] = [];
  for (const selector of selectors) {
    $scope.find(selector).each((_i, el) => {
      const url = readElementUrl($, el);
      if (url) values.push(url);
    });

    if (values.length > 0) break;
  }

  return uniqueUsefulValues(values, 1_000);
}

function parseRecipePluginCard(
  $: cheerio.CheerioAPI,
): Partial<SchemaOrgRecipe> {
  for (const config of RECIPE_PLUGIN_CONFIGS) {
    const cards = $(config.cardSelectors.join(",")).toArray();

    for (const card of cards) {
      const $card = $(card);
      const candidate: Partial<SchemaOrgRecipe> = {
        name: readFirstSelectorText($, $card, config.nameSelectors),
        description: readFirstSelectorText(
          $,
          $card,
          config.descriptionSelectors,
        ),
        image: readSelectorImages($, $card, config.imageSelectors),
        prepTime: readFirstSelectorText($, $card, config.prepTimeSelectors),
        cookTime: readFirstSelectorText($, $card, config.cookTimeSelectors),
        totalTime: readFirstSelectorText($, $card, config.totalTimeSelectors),
        recipeYield: readFirstSelectorText($, $card, config.yieldSelectors),
        recipeIngredient: readSelectorTexts(
          $,
          $card,
          config.ingredientSelectors,
          300,
        ),
        recipeInstructions: readSelectorTexts(
          $,
          $card,
          config.instructionSelectors,
          1_000,
        ),
      };

      if (hasMinimumRecipeData(candidate)) {
        return candidate;
      }
    }
  }

  return {};
}

function extractAssignedJsonBlocks(script: string): string[] {
  const blocks: string[] = [];
  const markers = [
    "__INITIAL_STATE__",
    "__APOLLO_STATE__",
    "__NUXT__",
    "__NEXT_DATA__",
  ];

  for (const marker of markers) {
    let searchIndex = 0;
    while (searchIndex < script.length) {
      const markerIndex = script.indexOf(marker, searchIndex);
      if (markerIndex === -1) break;

      const start = findJsonStart(script, markerIndex + marker.length);
      if (start === -1) {
        searchIndex = markerIndex + marker.length;
        continue;
      }

      const end = findBalancedJsonEnd(script, start);
      if (end !== -1) {
        blocks.push(script.slice(start, end + 1));
        searchIndex = end + 1;
      } else {
        searchIndex = start + 1;
      }
    }
  }

  return blocks;
}

function findJsonStart(script: string, fromIndex: number): number {
  const objectIndex = script.indexOf("{", fromIndex);
  const arrayIndex = script.indexOf("[", fromIndex);

  if (objectIndex === -1) return arrayIndex;
  if (arrayIndex === -1) return objectIndex;
  return Math.min(objectIndex, arrayIndex);
}

function findBalancedJsonEnd(script: string, startIndex: number): number {
  const opening = script[startIndex];
  const closing = opening === "{" ? "}" : "]";
  const stack: string[] = [closing];
  let inString = false;
  let escaped = false;

  for (let i = startIndex + 1; i < script.length; i += 1) {
    const char = script[i]!;

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === "{" || char === "[") {
      stack.push(char === "{" ? "}" : "]");
      continue;
    }

    if (char === "}" || char === "]") {
      if (stack.at(-1) !== char) return -1;
      stack.pop();
      if (stack.length === 0) return i;
    }
  }

  return -1;
}

/**
 * Normalize image property to array of resolved URLs
 */
function normalizeImages(
  image: OneOrMany<string | ImageObject>,
  baseUrl: string,
): string[] {
  const images = normalizeToArray(image);
  return images
    .map((img) => {
      if (typeof img === "string") {
        return resolveUrl(baseUrl, normalizeStructuredText(img));
      }
      if (img && typeof img === "object") {
        const url = img.url || img.contentUrl || img["@id"];
        return url ? resolveUrl(baseUrl, normalizeStructuredText(url)) : "";
      }
      return "";
    })
    .filter((url) => url !== "");
}

/**
 * Normalize a value that could be single or array to always be an array
 */
function normalizeToArray<T>(x?: OneOrMany<T>): T[] {
  if (x == null) return [];
  return Array.isArray(x) ? x : [x];
}

function normalizeStrings(x?: OneOrMany<string>): string[] {
  return normalizeToArray(x)
    .filter((s) => typeof s === "string")
    .map(normalizeStructuredText)
    .filter((s) => s !== "");
}

function extractServingsFromYield(
  yieldValue?: OneOrMany<string | number>,
): number | null {
  if (yieldValue == null) return null;

  // If it's already a number, return it directly
  if (typeof yieldValue === "number") {
    return yieldValue > 0 ? yieldValue : null;
  }

  // Handle array - join strings, or return first number
  if (Array.isArray(yieldValue)) {
    for (const val of yieldValue) {
      if (typeof val === "number" && val > 0) return val;
    }
    const yieldStr = yieldValue.map(String).join(" ");
    return parseServingsFromString(yieldStr);
  }

  return parseServingsFromString(String(yieldValue));
}

function parseServingsFromString(yieldStr: string): number | null {
  const normalizedYield = normalizeStructuredText(yieldStr);
  const patterns = [
    /(\d+)\s*servings?/i,
    /serves?\s*(\d+)/i,
    /makes?\s*(\d+)/i,
    /(\d+)\s*portions?/i,
    /(\d+)\s*people?/i,
    /yield:?\s*(\d+)/i,
    /^(\d+)$/,
    /(\d+)\s*-\s*(\d+)/,
  ];

  for (const pattern of patterns) {
    const match = normalizedYield.match(pattern);
    if (match) {
      const num = parseInt(match[1]!, 10);
      if (!isNaN(num) && num > 0) {
        return num;
      }
    }
  }

  return null;
}

/**
 * Extract image URL from a HowToStep if present
 */
function extractStepImage(step: HowToStep, baseUrl: string): string | null {
  if (!step.image) return null;

  const images = normalizeToArray(step.image);
  if (images.length === 0) return null;

  const firstImage = images[0];
  if (typeof firstImage === "string") {
    return resolveUrl(baseUrl, firstImage);
  }
  if (firstImage && typeof firstImage === "object") {
    const url = firstImage.url || firstImage.contentUrl;
    return url ? resolveUrl(baseUrl, url) : null;
  }
  return null;
}

/**
 * Extract recipeInstructions which may contain HowToStep, HowToSection, or strings
 * into a nested array of sections with their instructions
 */
function extractInstructionSections(
  instructions: OneOrMany<string | HowToStep | HowToSection>,
  baseUrl: string,
): InstructionSection[] {
  const items = normalizeToArray(instructions);
  const sections: InstructionSection[] = [];

  // Collect default section items (items not in a HowToSection)
  const defaultSectionItems: Instruction[] = [];
  let defaultIndex = 0;

  for (const item of items) {
    if (typeof item === "string") {
      // Plain string instruction - add to default section
      const trimmed = normalizeStructuredText(item);
      if (trimmed) {
        defaultSectionItems.push({
          index: defaultIndex++,
          instruction: trimmed,
          imageUrl: null,
        });
      }
    } else if (item && typeof item === "object") {
      if (item["@type"] === "HowToSection" && "itemListElement" in item) {
        // HowToSection contains nested steps - create a named section
        const section = item as HowToSection;
        const sectionName = section.name
          ? normalizeStructuredText(section.name)
          : null;
        const sectionInstructions: Instruction[] = [];
        let sectionIndex = 0;

        const nestedSteps = normalizeToArray(section.itemListElement);
        for (const nested of nestedSteps) {
          if (typeof nested === "string") {
            const trimmed = normalizeStructuredText(nested);
            if (trimmed) {
              sectionInstructions.push({
                index: sectionIndex++,
                instruction: trimmed,
                imageUrl: null,
              });
            }
          } else if (nested && typeof nested === "object") {
            const step = nested as HowToStep;
            const text = normalizeStructuredText(step.text || step.name || "");
            if (text) {
              sectionInstructions.push({
                index: sectionIndex++,
                instruction: text,
                imageUrl: extractStepImage(step, baseUrl),
              });
            }
          }
        }

        if (sectionInstructions.length > 0) {
          sections.push({
            name: sectionName,
            instructions: sectionInstructions,
          });
        }
      } else {
        // HowToStep without section - add to default section
        const step = item as HowToStep;
        const text = normalizeStructuredText(step.text || step.name || "");
        if (text) {
          defaultSectionItems.push({
            index: defaultIndex++,
            instruction: text,
            imageUrl: extractStepImage(step, baseUrl),
          });
        }
      }
    }
  }

  // If we have default section items, add them as the first section
  if (defaultSectionItems.length > 0) {
    sections.unshift({
      name: null,
      instructions: defaultSectionItems,
    });
  }

  return sections;
}

/**
 * Generate suggested tags from recipe metadata
 */
function generateTags(raw: Partial<SchemaOrgRecipe>): Tag[] {
  const tags: Tag[] = [];

  // Add cuisine tags
  const cuisines = normalizeStrings(raw.recipeCuisine);
  for (const cuisine of cuisines.slice(0, 2)) {
    tags.push({ type: "cuisine", name: cuisine });
  }

  // Add meal type from categories
  const categories = normalizeStrings(raw.recipeCategory);
  const mealTypes = [
    "breakfast",
    "lunch",
    "dinner",
    "dessert",
    "snack",
    "appetizer",
    "main course",
    "side dish",
  ];
  for (const cat of categories) {
    const lower = cat.toLowerCase();
    if (mealTypes.some((mt) => lower.includes(mt))) {
      tags.push({ type: "meal_type", name: cat });
      break;
    }
  }

  return tags;
}

function toParsedRecipe(
  raw: Partial<SchemaOrgRecipe>,
  sourceUrl: string,
): ParsedRecipe {
  // Parse ingredients - ensure each item is a string
  // For structured data, ingredients are typically a flat list without sections
  const rawIngredients = normalizeToArray(raw.recipeIngredient);
  const ingredients: Ingredient[] = rawIngredients
    .filter(
      (ing): ing is string =>
        typeof ing === "string" && normalizeStructuredText(ing) !== "",
    )
    .map((ing, index) => {
      const parsed = parseIngredientText(normalizeStructuredText(ing));
      return {
        index,
        quantity: parsed.quantity,
        unit: parsed.unit,
        name: parsed.name,
      };
    });

  // Wrap ingredients in a single default section
  const ingredientSections: IngredientSection[] =
    ingredients.length > 0 ? [{ name: null, ingredients }] : [];

  // Parse instructions (handles HowToStep, HowToSection, and plain strings)
  const instructionSections = raw.recipeInstructions
    ? extractInstructionSections(raw.recipeInstructions, sourceUrl)
    : [];

  // Get images (already normalized by parseJsonLd)
  const images: string[] = Array.isArray(raw.image)
    ? raw.image.filter((img): img is string => typeof img === "string")
    : [];

  return {
    name: raw.name ? normalizeStructuredText(raw.name) : "",
    description: raw.description
      ? normalizeStructuredText(raw.description)
      : null,
    prepTime: parseDurationToMinutes(raw.prepTime),
    cookTime: parseDurationToMinutes(raw.cookTime),
    totalTime: parseDurationToMinutes(raw.totalTime),
    servings: extractServingsFromYield(raw.recipeYield),
    sourceUrl,
    sourceType: "url" as const,
    ingredientSections,
    instructionSections,
    images,
    suggestedTags: generateTags(raw),
  };
}
