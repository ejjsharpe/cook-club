export interface ParsedIngredient {
  quantity: number | null;
  unit: string | null;
  name: string;
  preparation: string | null;
  confidence: "high" | "medium" | "low";
  originalText: string;
}

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

export function extractPreparation(text: string): {
  name: string;
  preparation: string | null;
} {
  const lower = text.toLowerCase();
  const sortedPreps = [...PREPARATION_WORDS].sort(
    (a, b) => b.length - a.length,
  );

  for (const prep of sortedPreps) {
    if (lower.includes(prep)) {
      const cleanedName = text
        .replace(new RegExp(`\\s*,?\\s*${prep}\\s*,?`, "gi"), " ")
        .replace(/\s+/g, " ")
        .trim();
      return { name: cleanedName, preparation: prep };
    }
  }

  return { name: text, preparation: null };
}

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
  const match = trimmed.match(
    /^(\d+(?:\/\d+)?|\d*\.?\d+)\s*([a-zA-Z\s]*?)\s+(.+)$/,
  );

  if (match) {
    const quantityStr = match[1];
    const unit = match[2]?.trim() || null;
    const rawName = match[3]?.trim() || trimmed;
    const { name, preparation } = extractPreparation(rawName);

    let quantity: number | null = null;
    if (quantityStr) {
      if (quantityStr.includes("/")) {
        const [numerator, denominator] = quantityStr.split("/");
        quantity = parseFloat(numerator ?? "0") / parseFloat(denominator ?? "1");
      } else {
        quantity = parseFloat(quantityStr);
      }
    }

    let confidence: ParsedIngredient["confidence"];
    if (quantity && unit && name) {
      confidence = "high";
    } else if (quantity && name) {
      confidence = "medium";
    } else {
      confidence = "low";
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

export function normalizeIngredientName(name: string): string {
  if (!name) return "";

  let normalized = name.toLowerCase().trim();
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
    normalized = normalized.replace(new RegExp(`^${adj}\\s+`, "i"), "");
  }

  if (
    normalized.length > 3 &&
    normalized.endsWith("s") &&
    !normalized.endsWith("ss")
  ) {
    const exceptions = ["lentils", "beans", "peas", "oats", "noodles"];
    if (!exceptions.includes(normalized)) {
      normalized = normalized.slice(0, -1);
    }
  }

  return normalized.trim();
}

export function parseIngredients(
  ingredientTexts: string[],
): ParsedIngredient[] {
  return ingredientTexts.map(parseIngredient);
}

export function formatQuantity(quantity: number | null): string {
  if (!quantity) return "";
  return quantity % 1 === 0
    ? quantity.toString()
    : quantity.toFixed(2).replace(/\.?0+$/, "");
}
