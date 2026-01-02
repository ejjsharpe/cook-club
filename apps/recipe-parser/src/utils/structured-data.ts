import * as cheerio from "cheerio";

import type {
  ParsedRecipe,
  Ingredient,
  Instruction,
  IngredientSection,
  InstructionSection,
  Tag,
} from "../schema";
import { normalizeUnit } from "./unit-normalizer";

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

type OneOrMany<T> = T | T[];

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
 * Extract recipe structured data from HTML (JSON-LD only)
 * Returns null if no valid recipe data found
 */
export function extractStructuredRecipe(
  html: string,
  sourceUrl: string,
): ParsedRecipe | null {
  try {
    const $ = cheerio.load(html);

    const raw = parseJsonLd($, sourceUrl);

    // Validate we have minimum required data per schema.org Recipe
    const ingredients = normalizeToArray(raw.recipeIngredient);
    if (!raw.name || ingredients.length === 0 || !raw.recipeInstructions) {
      return null;
    }

    return toParsedRecipe(raw, sourceUrl);
  } catch (error) {
    console.error("Error extracting structured recipe data:", error);
    return null;
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
function parseJsonLd(
  $: cheerio.CheerioAPI,
  baseUrl: string,
): Partial<SchemaOrgRecipe> {
  let result: Partial<SchemaOrgRecipe> = {};

  $('script[type="application/ld+json"]').each((_i, el) => {
    // Skip if we already found a recipe
    if (result.name) return;

    let data: unknown;
    try {
      data = JSON.parse($(el).text());
    } catch {
      return;
    }

    const recipe = findRecipeInJsonLd(data);
    if (recipe) {
      result = recipe;
    }
  });

  // Resolve relative image URLs
  if (result.image) {
    result.image = normalizeImages(result.image, baseUrl);
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

  // Check if this object is a Recipe
  const types = normalizeToArray(obj["@type"] as string | string[] | undefined);
  if (types.includes("Recipe")) {
    return obj as Partial<SchemaOrgRecipe>;
  }

  return null;
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
        return resolveUrl(baseUrl, img);
      }
      if (img && typeof img === "object") {
        const url = img.url || img.contentUrl || img["@id"];
        return url ? resolveUrl(baseUrl, url) : "";
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
  return normalizeToArray(x).filter((s) => typeof s === "string");
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

/**
 * Parse an ingredient string into structured parts
 * e.g., "2 cups flour" -> { quantity: 2, unit: "cup", name: "flour" }
 */
function parseIngredient(ingredientStr: string): {
  quantity: number | null;
  unit: string | null;
  name: string;
} {
  const str = ingredientStr.trim();

  // Match patterns like "1 1/2 cups flour", "2 tbsp sugar", "3 large eggs"
  // Pattern: optional quantity (number, fraction, or mixed), optional unit, then the rest is the name
  const quantityPattern = /^([\d]+(?:\s*[\d/]+)?(?:\/[\d]+)?)\s*/;
  const quantityMatch = str.match(quantityPattern);

  let quantity: number | null = null;
  let remaining = str;

  if (quantityMatch) {
    const quantityStr = quantityMatch[1]!.trim();
    quantity = parseFraction(quantityStr);
    remaining = str.slice(quantityMatch[0].length);
  }

  // Common units to look for
  const unitPattern =
    /^(cups?|tablespoons?|tbsps?|teaspoons?|tsps?|ounces?|oz|pounds?|lbs?|grams?|g|kilograms?|kg|ml|milliliters?|liters?|l|pinch(?:es)?|dash(?:es)?|cloves?|cans?|bunche?s?|sprigs?|slices?|pieces?|heads?|stalks?)\s+/i;
  const unitMatch = remaining.match(unitPattern);

  let unit: string | null = null;

  if (unitMatch) {
    unit = normalizeUnit(unitMatch[1]!);
    remaining = remaining.slice(unitMatch[0].length);
  }

  return {
    quantity,
    unit,
    name: remaining.trim(),
  };
}

/**
 * Parse a fraction or mixed number string to a decimal
 * e.g., "1/2" -> 0.5, "1 1/2" -> 1.5, "2" -> 2
 */
function parseFraction(str: string): number | null {
  const trimmed = str.trim();

  // Check for mixed number like "1 1/2"
  const mixedMatch = trimmed.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixedMatch) {
    const whole = parseInt(mixedMatch[1]!, 10);
    const num = parseInt(mixedMatch[2]!, 10);
    const denom = parseInt(mixedMatch[3]!, 10);
    return denom !== 0 ? whole + num / denom : null;
  }

  // Check for simple fraction like "1/2"
  const fractionMatch = trimmed.match(/^(\d+)\/(\d+)$/);
  if (fractionMatch) {
    const num = parseInt(fractionMatch[1]!, 10);
    const denom = parseInt(fractionMatch[2]!, 10);
    return denom !== 0 ? num / denom : null;
  }

  // Check for whole number
  const num = parseFloat(trimmed);
  return isNaN(num) ? null : num;
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
      const trimmed = item.trim();
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
        const sectionName = section.name?.trim() || null;
        const sectionInstructions: Instruction[] = [];
        let sectionIndex = 0;

        const nestedSteps = normalizeToArray(section.itemListElement);
        for (const nested of nestedSteps) {
          if (typeof nested === "string") {
            const trimmed = nested.trim();
            if (trimmed) {
              sectionInstructions.push({
                index: sectionIndex++,
                instruction: trimmed,
                imageUrl: null,
              });
            }
          } else if (nested && typeof nested === "object") {
            const step = nested as HowToStep;
            const text = (step.text || step.name || "").trim();
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
        const text = (step.text || step.name || "").trim();
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
      (ing): ing is string => typeof ing === "string" && ing.trim() !== "",
    )
    .map((ing, index) => {
      const parsed = parseIngredient(ing);
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
    name: raw.name || "",
    description: raw.description || null,
    prepTime: parseIsoDurationToMinutes(raw.prepTime),
    cookTime: parseIsoDurationToMinutes(raw.cookTime),
    totalTime: parseIsoDurationToMinutes(raw.totalTime),
    servings: extractServingsFromYield(raw.recipeYield),
    sourceUrl,
    sourceType: "url" as const,
    ingredientSections,
    instructionSections,
    images,
    suggestedTags: generateTags(raw),
  };
}
