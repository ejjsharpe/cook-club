/**
 * Unit Normalization Utility
 *
 * Normalizes cooking measurement units to canonical forms.
 * This ensures that "cup", "cups", "c", and "C" all map to the same unit.
 *
 * Benefits:
 * - Better aggregation in shopping lists
 * - Consistent database storage
 * - Foundation for unit conversion features
 */

/**
 * Mapping of canonical unit names to their variations
 */
const UNIT_MAPPINGS: Record<string, string[]> = {
  // Volume - Large
  cup: ['cup', 'cups', 'c'],
  gallon: ['gallon', 'gallons', 'gal', 'gals'],
  quart: ['quart', 'quarts', 'qt', 'qts'],
  pint: ['pint', 'pints', 'pt', 'pts'],

  // Volume - Small
  tablespoon: ['tablespoon', 'tablespoons', 'tbsp', 'tbs', 'T'],
  teaspoon: ['teaspoon', 'teaspoons', 'tsp', 'ts', 't'],

  // Volume - Metric
  liter: ['liter', 'liters', 'litre', 'litres', 'l'],
  milliliter: ['milliliter', 'milliliters', 'millilitre', 'millilitres', 'ml'],

  // Weight - Imperial
  pound: ['pound', 'pounds', 'lb', 'lbs'],
  ounce: ['ounce', 'ounces', 'oz'],

  // Weight - Metric
  kilogram: ['kilogram', 'kilograms', 'kg', 'kgs'],
  gram: ['gram', 'grams', 'g', 'gm', 'gms'],
  milligram: ['milligram', 'milligrams', 'mg'],

  // Other
  pinch: ['pinch', 'pinches'],
  dash: ['dash', 'dashes'],
  clove: ['clove', 'cloves'],
  package: ['package', 'packages', 'pkg', 'pkgs'],
  can: ['can', 'cans'],
  jar: ['jar', 'jars'],
  slice: ['slice', 'slices'],
  piece: ['piece', 'pieces'],
  whole: ['whole'],
  bunch: ['bunch', 'bunches'],
  head: ['head', 'heads'],
  stick: ['stick', 'sticks'],
};

/**
 * Reverse mapping for faster lookup: variation → canonical
 * Built from UNIT_MAPPINGS
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
 *
 * @param input - The unit to normalize (e.g., "cups", "TBSP")
 * @returns The canonical unit name, or the input if no mapping exists
 */
export function normalizeUnit(input: string | null): string | null {
  if (!input) return null;

  const lowercased = input.toLowerCase().trim();

  // Return canonical form if found, otherwise return original (lowercased)
  return VARIATION_TO_CANONICAL[lowercased] || lowercased;
}

/**
 * Check if a unit is recognized in our mappings
 *
 * @param unit - The unit to check
 * @returns true if the unit is in our mappings, false otherwise
 */
export function isRecognizedUnit(unit: string | null): boolean {
  if (!unit) return false;
  const lowercased = unit.toLowerCase().trim();
  return lowercased in VARIATION_TO_CANONICAL;
}

/**
 * Get all recognized canonical units
 *
 * @returns Array of canonical unit names
 */
export function getCanonicalUnits(): string[] {
  return Object.keys(UNIT_MAPPINGS);
}

/**
 * Get all variations for a canonical unit
 *
 * @param canonical - The canonical unit name
 * @returns Array of variations, or empty array if not found
 */
export function getUnitVariations(canonical: string): string[] {
  return UNIT_MAPPINGS[canonical] || [];
}
