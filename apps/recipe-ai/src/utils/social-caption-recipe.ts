import type { Ingredient, ParsedRecipe, Tag } from "../schema";
import { parseIngredientText } from "./ingredient-parser";

const UNICODE_FRACTIONS: Record<string, string> = {
  "\u00bc": "1/4",
  "\u00bd": "1/2",
  "\u00be": "3/4",
  "\u2153": "1/3",
  "\u2154": "2/3",
  "\u215b": "1/8",
  "\u215c": "3/8",
  "\u215d": "5/8",
  "\u215e": "7/8",
};

function normalizeText(value: string): string {
  return value
    .replace(
      /([\d\s]?)([\u00bc\u00bd\u00be\u2153\u2154\u215b\u215c\u215d\u215e])/g,
      (_, prefix: string, fraction: string) =>
        `${prefix.trim() ? `${prefix.trim()} ` : ""}${UNICODE_FRACTIONS[fraction]}`,
    )
    .replace(/\s+/g, " ")
    .trim();
}

function removeSocialNoise(value: string): string {
  return normalizeText(
    value
      .replace(/#[\p{L}\p{N}_-]+/gu, " ")
      .replace(/@\w+/g, " ")
      .replace(/\b(?:link in bio|follow for more|save this)\b/gi, " "),
  );
}

function titleCase(value: string): string {
  return value
    .split(" ")
    .filter(Boolean)
    .map((word) =>
      word.length <= 2
        ? word.toLowerCase()
        : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
    )
    .join(" ");
}

function cleanTitle(value: string): string {
  const beforeRecipeBy = value.split(/\brecipe\s+by\b/i)[0] ?? value;
  const cleaned = removeSocialNoise(beforeRecipeBy)
    .replace(/[^\p{L}\p{N}\s'&-]/gu, " ")
    .replace(/\b([a-z]+ies)s\b/gi, "$1")
    .replace(/\brecipe\b/gi, " ")
    .trim();

  return cleaned ? titleCase(cleaned) : "Imported Social Recipe";
}

function extractCredit(value: string): string | null {
  const match = value.match(/\brecipe\s+by\s+([^:#]+?)(?:[:#]|$)/i);
  if (!match?.[1]) return null;

  const credit = removeSocialNoise(match[1])
    .replace(/[^\p{L}\p{N}\s'&-]/gu, " ")
    .trim();

  return credit ? `Recipe by ${credit}.` : null;
}

function captionAfterRecipeIntro(caption: string): string {
  const colonIndex = caption.indexOf(":");
  if (colonIndex > -1 && colonIndex < 180) {
    return caption.slice(colonIndex + 1);
  }

  return caption;
}

function isContinuationQuantity(text: string, start: number): boolean {
  const before = text.slice(Math.max(0, start - 12), start);
  return /\b(?:plus|and)\s+$/i.test(before);
}

function quantityStarts(text: string): number[] {
  const starts: number[] = [];
  const pattern =
    /(?:^|\s)(\d+(?:\s+\d+\/\d+|\/\d+|\.\d+)?)(?=\s+(?:[a-z]|\d))/gi;

  for (const match of text.matchAll(pattern)) {
    const leadingSpace = match[0].startsWith(" ") ? 1 : 0;
    const start = match.index + leadingSpace;
    if (!isContinuationQuantity(text, start)) {
      starts.push(start);
    }
  }

  return starts;
}

function splitCompactIngredients(value: string): string[] {
  const text = removeSocialNoise(value.split("#")[0] ?? value);
  if (!text) return [];

  const lineIngredients = text
    .split(/\n|•|·|;|\|/g)
    .map((line) => line.replace(/^[-*\d.)\s]+/, "").trim())
    .filter((line) => /^\d/.test(line));

  if (lineIngredients.length >= 2) {
    return lineIngredients;
  }

  const starts = quantityStarts(text);
  if (starts.length < 2) return [];

  return starts
    .map((start, index) => {
      const end = starts[index + 1] ?? text.length;
      return text.slice(start, end).trim();
    })
    .filter(Boolean);
}

function ingredientsFromCaption(caption: string): Ingredient[] {
  const ingredientsText = captionAfterRecipeIntro(caption);
  return splitCompactIngredients(ingredientsText)
    .map((ingredient, index) => ({
      index,
      ...parseIngredientText(ingredient),
    }))
    .filter((ingredient) => ingredient.name.length > 0);
}

function tagsFromCaption(caption: string): Tag[] {
  const lower = caption.toLowerCase();
  if (
    /\b(brownie|cake|cookie|dessert|baking|baketok|sweet)\b/.test(lower) ||
    /#(?:brownie|cake|cookie|dessert|baking|baketok)/i.test(caption)
  ) {
    return [{ type: "meal_type", name: "dessert" }];
  }

  return [];
}

export function extractSocialCaptionRecipe(
  caption: string | null | undefined,
  sourceUrl: string,
  images: string[] = [],
): ParsedRecipe | null {
  if (!caption) return null;

  const ingredients = ingredientsFromCaption(caption);
  if (ingredients.length < 2) return null;

  return {
    name: cleanTitle(caption),
    description: extractCredit(caption),
    prepTime: null,
    cookTime: null,
    totalTime: null,
    servings: null,
    sourceUrl,
    sourceType: "url",
    ingredientSections: [{ name: null, ingredients }],
    instructionSections: [
      {
        name: null,
        instructions: [
          {
            index: 0,
            instruction:
              "Follow the method shown in the source video using the listed ingredients.",
            imageUrl: null,
          },
        ],
      },
    ],
    images,
    suggestedTags: tagsFromCaption(caption),
  };
}
