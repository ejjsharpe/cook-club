/**
 * Unit Normalization Utility
 *
 * Normalizes cooking measurement units to canonical forms.
 * This ensures that "cup", "cups", "c", and "C" all map to the same unit.
 */

/**
 * Mapping of canonical unit names to their variations
 * Note: Case-sensitive entries are handled separately in CASE_SENSITIVE_MAPPINGS
 */
const UNIT_MAPPINGS: Record<string, string[]> = {
  // Volume - Large
  cup: ["cup", "cups", "c"],
  gallon: ["gallon", "gallons", "gal", "gals"],
  quart: ["quart", "quarts", "qt", "qts"],
  pint: ["pint", "pints", "pt", "pts"],

  // Volume - Small (note: "T" and "t" handled separately for case sensitivity)
  tablespoon: ["tablespoon", "tablespoons", "tbsp", "tbs"],
  teaspoon: ["teaspoon", "teaspoons", "tsp", "ts"],

  // Volume - Metric
  liter: ["liter", "liters", "litre", "litres", "l"],
  milliliter: ["milliliter", "milliliters", "millilitre", "millilitres", "ml"],

  // Weight - Imperial
  pound: ["pound", "pounds", "lb", "lbs"],
  ounce: ["ounce", "ounces", "oz"],

  // Weight - Metric
  kilogram: ["kilogram", "kilograms", "kg", "kgs"],
  gram: ["gram", "grams", "g", "gm", "gms"],
  milligram: ["milligram", "milligrams", "mg"],

  // Other
  pinch: ["pinch", "pinches"],
  dash: ["dash", "dashes"],
  clove: ["clove", "cloves"],
  package: ["package", "packages", "pkg", "pkgs"],
  can: ["can", "cans"],
  jar: ["jar", "jars"],
  slice: ["slice", "slices"],
  piece: ["piece", "pieces"],
  whole: ["whole"],
  bunch: ["bunch", "bunches"],
  head: ["head", "heads"],
  stick: ["stick", "sticks"],
};

/**
 * Case-sensitive mappings for single-letter abbreviations
 * "T" = tablespoon, "t" = teaspoon (common convention)
 */
const CASE_SENSITIVE_MAPPINGS: Record<string, string> = {
  T: "tablespoon",
  t: "teaspoon",
};

/**
 * Reverse mapping for faster lookup: variation → canonical
 */
const VARIATION_TO_CANONICAL: Record<string, string> = {};

// Build reverse mapping
for (const [canonical, variations] of Object.entries(UNIT_MAPPINGS)) {
  for (const variation of variations) {
    VARIATION_TO_CANONICAL[variation.toLowerCase()] = canonical;
  }
}

/**
 * Normalize a unit to its canonical form
 *
 * Examples:
 * - "cups" → "cup"
 * - "TBSP" → "tablespoon"
 * - "lbs" → "pound"
 * - "unknown" → "unknown" (returns as-is if not in mapping)
 */
export function normalizeUnit(input: string | null): string | null {
  if (!input) return null;

  const trimmed = input.trim();

  // Check case-sensitive mappings first (e.g., "T" vs "t")
  if (trimmed in CASE_SENSITIVE_MAPPINGS) {
    return CASE_SENSITIVE_MAPPINGS[trimmed]!;
  }

  const lowercased = trimmed.toLowerCase();

  // Return canonical form if found, otherwise return original (lowercased)
  return VARIATION_TO_CANONICAL[lowercased] || lowercased;
}

/**
 * Check if a unit is recognized in our mappings
 */
export function isRecognizedUnit(unit: string | null): boolean {
  if (!unit) return false;
  const trimmed = unit.trim();
  if (trimmed in CASE_SENSITIVE_MAPPINGS) return true;
  return trimmed.toLowerCase() in VARIATION_TO_CANONICAL;
}

/**
 * Get all recognized canonical units
 */
export function getCanonicalUnits(): string[] {
  return Object.keys(UNIT_MAPPINGS);
}

/**
 * Get all variations for a canonical unit
 */
export function getUnitVariations(canonical: string): string[] {
  return UNIT_MAPPINGS[canonical] || [];
}
