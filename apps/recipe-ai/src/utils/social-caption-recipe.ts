import type {
  Ingredient,
  IngredientSection,
  InstructionSection,
  ParsedRecipe,
  Tag,
} from "../schema";
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
        `${/\d/.test(prefix) ? `${prefix.trim()} ` : prefix}${UNICODE_FRACTIONS[fraction]}`,
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
  const beforeIngredients = value.split(/\bingredients\s*:/i)[0] ?? value;
  const beforeRecipeBy = value.split(/\brecipe\s+by\b/i)[0] ?? value;
  const titleSource =
    beforeIngredients.length < beforeRecipeBy.length
      ? beforeIngredients
      : beforeRecipeBy;
  const cleaned = removeSocialNoise(titleSource)
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
  return /\b(?:plus|and)\s+$/i.test(before) && !/\bjuice of\s+$/i.test(before);
}

function quantityStarts(text: string): number[] {
  const starts: number[] = [];
  const pattern =
    /(?:^|\s)(\d+(?:\s+\d+\/\d+|\/\d+|\.\d+)?)(?=\s+(?:[a-z]|\d))/gi;

  for (const match of text.matchAll(pattern)) {
    const leadingSpace = match[0].startsWith(" ") ? 1 : 0;
    let start = match.index + leadingSpace;
    const before = text.slice(0, start);
    const juicePrefix = before.match(/\bjuice of\s+$/i);
    if (juicePrefix) {
      start -= juicePrefix[0].length;
    }
    if (!isContinuationQuantity(text, start)) {
      starts.push(start);
    }
  }

  return [...new Set(starts)].sort((a, b) => a - b);
}

function splitKnownQuantitylessIngredients(items: string[]): string[] {
  const knownPhrases = ["Kosher salt and freshly ground black pepper"];

  return items.flatMap((item) => {
    for (const phrase of knownPhrases) {
      const index = item.toLowerCase().indexOf(phrase.toLowerCase());
      if (index > -1 && item.trim().toLowerCase() !== phrase.toLowerCase()) {
        return [
          item.slice(0, index).trim(),
          phrase,
          item.slice(index + phrase.length).trim(),
        ].filter(Boolean);
      }
    }

    return [item];
  });
}

function splitCompactIngredients(value: string): string[] {
  const text = removeSocialNoise(value.split("#")[0] ?? value);
  if (!text) return [];

  const hasItemSeparators = /[\n•·;|]|\s+\*\s+/.test(text);
  const lineIngredients = text
    .split(/\n|•|·|;|\||\s+\*\s+/g)
    .map((line) =>
      line
        .replace(/^[-*\s]+/, "")
        .replace(/^\d+[.)]\s+/, "")
        .trim(),
    )
    .filter((line) => line && !/^ingredients?$/i.test(line))
    .filter((line) => (hasItemSeparators ? true : /^\d/.test(line)));

  if (lineIngredients.length >= 2) {
    return splitKnownQuantitylessIngredients(lineIngredients);
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

function splitExplicitRecipeSections(caption: string): {
  intro: string;
  ingredientsText: string;
  directionsText: string;
} | null {
  const normalized = normalizeText(caption);
  const ingredientsMatch = /\bingredients\s*:/i.exec(normalized);
  if (ingredientsMatch?.index == null) return null;

  const afterIngredients = normalized.slice(
    ingredientsMatch.index + ingredientsMatch[0].length,
  );
  const directionsMatch = /\b(?:directions|instructions|method)\s*:/i.exec(
    afterIngredients,
  );

  if (directionsMatch?.index == null) return null;

  return {
    intro: normalized.slice(0, ingredientsMatch.index).trim(),
    ingredientsText: afterIngredients.slice(0, directionsMatch.index).trim(),
    directionsText: afterIngredients
      .slice(directionsMatch.index + directionsMatch[0].length)
      .trim(),
  };
}

function splitIngredientItems(value: string): string[] {
  const text = removeSocialNoise(value);
  if (!text) return [];

  const lineItems = text
    .split(/\n|•|·|;|\|/g)
    .map((line) =>
      line
        .replace(/^[-*\s]+/, "")
        .replace(/^\d+[.)]\s+/, "")
        .trim(),
    )
    .filter(Boolean);

  if (lineItems.length >= 2) {
    return splitKnownQuantitylessIngredients(lineItems);
  }

  const starts = quantityStarts(text);
  if (starts.length === 0) return text ? [text] : [];

  const leading = text.slice(0, starts[0]).trim();
  const items = starts.map((start, index) => {
    const end = starts[index + 1] ?? text.length;
    return text.slice(start, end).trim();
  });

  if (leading && !/^(?:soup|garnishes?|ingredients?)$/i.test(leading)) {
    items.unshift(leading);
  }

  return splitKnownQuantitylessIngredients(items).filter(Boolean);
}

function parseIngredientItems(items: string[]): Ingredient[] {
  return items
    .map((ingredient, index) => ({
      index,
      ...parseIngredientText(ingredient),
    }))
    .filter((ingredient) => ingredient.name.length > 0);
}

function parseExplicitIngredientSections(
  ingredientsText: string,
): IngredientSection[] {
  const sectionMatches = [
    ...ingredientsText.matchAll(/\b(Soup|Garnishes?)\b/gi),
  ].filter((match) => match.index != null);

  if (sectionMatches.length >= 2) {
    return sectionMatches
      .map((match, index) => {
        const start = match.index! + match[0].length;
        const end = sectionMatches[index + 1]?.index ?? ingredientsText.length;
        const ingredients = parseIngredientItems(
          splitIngredientItems(ingredientsText.slice(start, end)),
        );

        return {
          name: titleCase(match[0]),
          ingredients,
        };
      })
      .filter((section) => section.ingredients.length > 0);
  }

  const ingredients = parseIngredientItems(
    splitIngredientItems(ingredientsText),
  );
  return ingredients.length > 0 ? [{ name: null, ingredients }] : [];
}

function parseExplicitInstructionSections(
  directionsText: string,
): InstructionSection[] {
  const text = removeSocialNoise(directionsText);
  const matches = [...text.matchAll(/(?:^|\s)(\d+)\.\s+/g)].filter(
    (match) => match.index != null,
  );

  const instructions =
    matches.length >= 2
      ? matches.map((match, index) => {
          const start = match.index! + match[0].length;
          const end = matches[index + 1]?.index ?? text.length;
          return text.slice(start, end).trim();
        })
      : text
          .split(/\n|(?:\.\s+)(?=[A-Z])/g)
          .map((step) => step.trim())
          .filter(Boolean);

  const parsedInstructions = instructions
    .map((instruction, index) => ({
      index,
      instruction,
      imageUrl: null,
    }))
    .filter((instruction) => instruction.instruction.length > 0);

  return parsedInstructions.length > 0
    ? [{ name: null, instructions: parsedInstructions }]
    : [];
}

function minutesFromCaption(caption: string): number | null {
  const match = caption.match(
    /\b(?:ready in|in just|just)\s+(\d{1,3})\s*(?:minutes?|mins?|minute\b|min\b)?/i,
  );
  if (!match?.[1]) return null;

  const minutes = Number(match[1]);
  return Number.isFinite(minutes) ? minutes : null;
}

function titleFromIntro(intro: string): string {
  const thisWillBeMatch = intro.match(/\bthis\s+(.+?)\s+will be\b/i);
  if (thisWillBeMatch?.[1]) {
    return cleanTitle(thisWillBeMatch[1]);
  }

  return cleanTitle(intro);
}

function extractExplicitSocialCaptionRecipe(
  caption: string,
  sourceUrl: string,
  images: string[],
): ParsedRecipe | null {
  const sections = splitExplicitRecipeSections(caption);
  if (!sections) return null;

  const ingredientSections = parseExplicitIngredientSections(
    sections.ingredientsText,
  );
  const instructionSections = parseExplicitInstructionSections(
    sections.directionsText,
  );

  const ingredientCount = ingredientSections.reduce(
    (count, section) => count + section.ingredients.length,
    0,
  );
  const instructionCount = instructionSections.reduce(
    (count, section) => count + section.instructions.length,
    0,
  );

  if (ingredientCount < 2 || instructionCount < 1) return null;

  const totalTime = minutesFromCaption(caption);
  const description = removeSocialNoise(sections.intro);

  return {
    name: titleFromIntro(sections.intro),
    description: description || extractCredit(caption),
    prepTime: totalTime,
    cookTime: null,
    totalTime,
    servings: null,
    sourceUrl,
    sourceType: "url",
    ingredientSections,
    instructionSections,
    images,
    suggestedTags: tagsFromCaption(caption),
  };
}

function ingredientsFromCaption(caption: string): Ingredient[] {
  const ingredientsText = captionAfterRecipeIntro(caption);
  return parseIngredientItems(splitCompactIngredients(ingredientsText));
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

  const explicitRecipe = extractExplicitSocialCaptionRecipe(
    caption,
    sourceUrl,
    images,
  );
  if (explicitRecipe) return explicitRecipe;

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
