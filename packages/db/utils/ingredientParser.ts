/**
 * Ingredient Parser Utility
 *
 * Parses ingredient text like "2 cups flour" into structured data:
 * { quantity: 2, unit: "cups", name: "flour" }
 *
 * Based on the parsing logic from shopping-router.ts, enhanced with
 * confidence levels and better normalization.
 */

export interface ParsedIngredient {
  quantity: number | null;
  unit: string | null;
  name: string;
  preparation: string | null;
  confidence: "high" | "medium" | "low";
  originalText: string;
}

// Preparation words to extract from ingredient text
export const PREPARATION_WORDS = [
  "chopped",
  "diced",
  "sliced",
  "minced",
  "crushed",
  "grated",
  "shredded",
  "julienned",
  "cubed",
  "melted",
  "softened",
  "beaten",
  "whisked",
  "room temperature",
  "chilled",
  "frozen",
  "thawed",
  "peeled",
  "seeded",
  "deveined",
  "trimmed",
  "quartered",
  "halved",
  "thinly sliced",
  "finely chopped",
  "roughly chopped",
  "finely diced",
  "coarsely chopped",
];

/**
 * Extract preparation method from ingredient name
 * Returns the cleaned name and extracted preparation
 */
export function extractPreparation(text: string): {
  name: string;
  preparation: string | null;
} {
  const lower = text.toLowerCase();

  // Sort by length descending to match longer phrases first (e.g., "finely chopped" before "chopped")
  const sortedPreps = [...PREPARATION_WORDS].sort(
    (a, b) => b.length - a.length,
  );

  for (const prep of sortedPreps) {
    if (lower.includes(prep)) {
      // Remove the preparation word and any surrounding commas/spaces
      const cleanedName = text
        .replace(new RegExp(`\\s*,?\\s*${prep}\\s*,?`, "gi"), " ")
        .replace(/\s+/g, " ")
        .trim();
      return {
        name: cleanedName,
        preparation: prep,
      };
    }
  }

  return { name: text, preparation: null };
}

/**
 * Parse ingredient text to extract quantity, unit, and ingredient name
 *
 * Examples:
 * - "2 cups flour" → { quantity: 2, unit: "cups", name: "flour", confidence: "high" }
 * - "1/2 tsp salt" → { quantity: 0.5, unit: "tsp", name: "salt", confidence: "high" }
 * - "3 large carrots" → { quantity: 3, unit: null, name: "large carrots", confidence: "medium" }
 * - "salt to taste" → { quantity: null, unit: null, name: "salt to taste", confidence: "low" }
 */
export function parseIngredient(ingredientText: string): ParsedIngredient {
  if (!ingredientText || typeof ingredientText !== "string") {
    return {
      quantity: null,
      unit: null,
      name: ingredientText || "",
      preparation: null,
      confidence: "low",
      originalText: ingredientText || "",
    };
  }

  const trimmed = ingredientText.trim();

  // Regex matches: [quantity] [unit] [ingredient name]
  // Examples: "2 cups flour", "1/2 tsp salt", "3 large carrots"
  const match = trimmed.match(
    /^(\d+(?:\/\d+)?|\d*\.?\d+)\s*([a-zA-Z\s]*?)\s+(.+)$/,
  );

  if (match) {
    const quantityStr = match[1];
    const unit = match[2]?.trim() || null;
    const rawName = match[3]?.trim() || trimmed;

    // Extract preparation from the ingredient name
    const { name, preparation } = extractPreparation(rawName);

    // Convert fractions to decimals (e.g., "1/2" -> 0.5)
    let quantity: number | null = null;
    if (quantityStr) {
      if (quantityStr.includes("/")) {
        const [numerator, denominator] = quantityStr.split("/");
        const num = numerator ?? "0";
        const denom = denominator ?? "1";
        quantity = parseFloat(num) / parseFloat(denom);
      } else {
        quantity = parseFloat(quantityStr);
      }
    }

    // Determine confidence based on how well the parse worked
    let confidence: "high" | "medium" | "low";
    if (quantity && unit && name) {
      confidence = "high"; // All components extracted
    } else if (quantity && name) {
      confidence = "medium"; // Quantity and name, but no unit
    } else {
      confidence = "low"; // Partial match
    }

    return {
      quantity,
      unit,
      name,
      preparation,
      confidence,
      originalText: trimmed,
    };
  }

  // If no match, try to extract preparation from the entire text
  const { name, preparation } = extractPreparation(trimmed);

  return {
    quantity: null,
    unit: null,
    name,
    preparation,
    confidence: "low",
    originalText: trimmed,
  };
}

/**
 * Normalize ingredient name for consistent grouping
 *
 * Performs:
 * - Lowercase conversion
 * - Whitespace trimming
 * - Basic plural handling (simple cases only)
 * - Common adjective removal (optional, can be enhanced)
 *
 * Examples:
 * - "Chicken Breast" → "chicken breast"
 * - "carrots" → "carrot"
 * - "Fresh Basil" → "basil"
 */
export function normalizeIngredientName(name: string): string {
  if (!name) return "";

  let normalized = name.toLowerCase().trim();

  // Remove common adjectives (basic set - can be expanded)
  const adjectivesToRemove = [
    "fresh",
    "large",
    "small",
    "medium",
    "whole",
    "chopped",
    "diced",
    "sliced",
    "minced",
  ];

  for (const adj of adjectivesToRemove) {
    // Remove adjective at start of string followed by space
    const regex = new RegExp(`^${adj}\\s+`, "i");
    normalized = normalized.replace(regex, "");
  }

  // Basic plural handling - remove trailing 's' if:
  // - Word ends in 's' but not 'ss'
  // - Word is longer than 3 characters (avoid "peas" → "pea")
  if (
    normalized.length > 3 &&
    normalized.endsWith("s") &&
    !normalized.endsWith("ss")
  ) {
    // Check if it's a common plural form
    // This is a simple heuristic - can be improved with a proper pluralization library
    const exceptions = ["lentils", "beans", "peas", "oats", "noodles"];
    if (!exceptions.includes(normalized)) {
      normalized = normalized.slice(0, -1);
    }
  }

  return normalized.trim();
}

/**
 * Parse multiple ingredients at once
 * Useful for batch processing
 */
export function parseIngredients(
  ingredientTexts: string[],
): ParsedIngredient[] {
  return ingredientTexts.map(parseIngredient);
}
