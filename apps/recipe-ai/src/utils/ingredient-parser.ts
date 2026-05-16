import type { Ingredient } from "../schema";
import { normalizeUnit } from "./unit-normalizer";

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

function normalizeIngredientText(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .replace(
      /([\d\s]?)([\u00bc\u00bd\u00be\u2153\u2154\u215b\u215c\u215d\u215e])/g,
      (_, prefix: string, fraction: string) =>
        `${prefix.trim() ? `${prefix.trim()} ` : ""}${UNICODE_FRACTIONS[fraction]}`,
    )
    .trim();
}

export function parseFraction(value: string): number | null {
  const trimmed = value.trim();

  const mixed = trimmed.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) {
    const whole = Number(mixed[1]);
    const numerator = Number(mixed[2]);
    const denominator = Number(mixed[3]);
    return denominator > 0 ? whole + numerator / denominator : null;
  }

  const fraction = trimmed.match(/^(\d+)\/(\d+)$/);
  if (fraction) {
    const numerator = Number(fraction[1]);
    const denominator = Number(fraction[2]);
    return denominator > 0 ? numerator / denominator : null;
  }

  const numeric = Number(trimmed);
  return Number.isFinite(numeric) ? numeric : null;
}

export function parseIngredientText(value: string): Omit<Ingredient, "index"> {
  const text = normalizeIngredientText(value);
  const quantityMatch = text.match(/^(\d+(?:\.\d+)?(?:\s+\d+\/\d+|\/\d+)?)/);
  const quantity = quantityMatch ? parseFraction(quantityMatch[1]!) : null;
  let remaining = quantityMatch
    ? text.slice(quantityMatch[0].length).trim()
    : text;

  const parentheticalAmount = remaining.match(/^(\([^)]+\))\s+/);
  const unitSearchText = parentheticalAmount
    ? remaining.slice(parentheticalAmount[0].length)
    : remaining;
  const unitMatch = unitSearchText.match(
    /^(cups?|c|tablespoons?|tbsps?|tbsp|teaspoons?|tsps?|tsp|ounces?|oz|fluid ounces?|fl oz|pounds?|lbs?|lb|grams?|g|kilograms?|kg|ml|milliliters?|liters?|litres?|l|pinch(?:es)?|dash(?:es)?|cloves?|cans?|containers?|cartons?|packages?|packets?|boxes?|box|sticks?|slices?|pieces?|heads?|stalks?|sprigs?|bunch(?:es)?|sheets?)\b/i,
  );
  const unit = unitMatch ? normalizeUnit(unitMatch[1]!) : null;

  if (unitMatch) {
    if (parentheticalAmount) {
      remaining = `${parentheticalAmount[1]} ${unitSearchText
        .slice(unitMatch[0].length)
        .trim()}`.trim();
    } else {
      remaining = remaining.slice(unitMatch[0].length).trim();
    }
  }

  return {
    quantity,
    unit,
    name: remaining || text,
  };
}
