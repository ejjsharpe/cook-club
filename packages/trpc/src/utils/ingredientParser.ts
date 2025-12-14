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
  confidence: 'high' | 'medium' | 'low';
  originalText: string;
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
  if (!ingredientText || typeof ingredientText !== 'string') {
    return {
      quantity: null,
      unit: null,
      name: ingredientText || '',
      confidence: 'low',
      originalText: ingredientText || '',
    };
  }

  const trimmed = ingredientText.trim();

  // Regex matches: [quantity] [unit] [ingredient name]
  // Examples: "2 cups flour", "1/2 tsp salt", "3 large carrots"
  const match = trimmed.match(
    /^(\d+(?:\/\d+)?|\d*\.?\d+)\s*([a-zA-Z\s]*?)\s+(.+)$/
  );

  if (match) {
    const quantityStr = match[1];
    const unit = match[2]?.trim() || null;
    const name = match[3]?.trim() || trimmed;

    // Convert fractions to decimals (e.g., "1/2" -> 0.5)
    let quantity: number | null = null;
    if (quantityStr) {
      if (quantityStr.includes('/')) {
        const [numerator, denominator] = quantityStr.split('/');
        const num = numerator ?? '0';
        const denom = denominator ?? '1';
        quantity = parseFloat(num) / parseFloat(denom);
      } else {
        quantity = parseFloat(quantityStr);
      }
    }

    // Determine confidence based on how well the parse worked
    let confidence: 'high' | 'medium' | 'low';
    if (quantity && unit && name) {
      confidence = 'high'; // All components extracted
    } else if (quantity && name) {
      confidence = 'medium'; // Quantity and name, but no unit
    } else {
      confidence = 'low'; // Partial match
    }

    return {
      quantity,
      unit,
      name,
      confidence,
      originalText: trimmed,
    };
  }

  // If no match, treat entire text as ingredient name
  return {
    quantity: null,
    unit: null,
    name: trimmed,
    confidence: 'low',
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
  if (!name) return '';

  let normalized = name.toLowerCase().trim();

  // Remove common adjectives (basic set - can be expanded)
  const adjectivesToRemove = [
    'fresh',
    'large',
    'small',
    'medium',
    'whole',
    'chopped',
    'diced',
    'sliced',
    'minced',
  ];

  for (const adj of adjectivesToRemove) {
    // Remove adjective at start of string followed by space
    const regex = new RegExp(`^${adj}\\s+`, 'i');
    normalized = normalized.replace(regex, '');
  }

  // Basic plural handling - remove trailing 's' if:
  // - Word ends in 's' but not 'ss'
  // - Word is longer than 3 characters (avoid "peas" → "pea")
  if (
    normalized.length > 3 &&
    normalized.endsWith('s') &&
    !normalized.endsWith('ss')
  ) {
    // Check if it's a common plural form
    // This is a simple heuristic - can be improved with a proper pluralization library
    const exceptions = ['lentils', 'beans', 'peas', 'oats', 'noodles'];
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
export function parseIngredients(ingredientTexts: string[]): ParsedIngredient[] {
  return ingredientTexts.map(parseIngredient);
}
