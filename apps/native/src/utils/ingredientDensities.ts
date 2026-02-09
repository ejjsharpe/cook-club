/**
 * Ingredient density lookup for volume ↔ weight conversions.
 * Values are grams per US cup (236.588 ml).
 * Sources: AllRecipes, King Arthur Baking.
 */

const DENSITY_MAP: Record<string, number> = {
  // Flours
  "all-purpose flour": 125,
  "plain flour": 125,
  flour: 125,
  "bread flour": 136,
  "strong flour": 136,
  "whole wheat flour": 113,
  "wholemeal flour": 113,
  "cake flour": 120,
  "self-rising flour": 113,
  "self-raising flour": 113,
  "almond flour": 96,
  "almond meal": 96,
  "coconut flour": 128,
  "oat flour": 92,
  "rice flour": 142,
  "semolina flour": 163,
  semolina: 163,
  cornstarch: 112,
  "corn starch": 112,
  cornmeal: 138,
  "buckwheat flour": 120,
  "rye flour": 106,
  "chickpea flour": 85,
  "spelt flour": 99,
  "tapioca flour": 113,
  "tapioca starch": 113,

  // Sugars
  sugar: 200,
  "granulated sugar": 200,
  "white sugar": 200,
  "caster sugar": 200,
  "castor sugar": 200,
  "brown sugar": 220,
  "light brown sugar": 220,
  "dark brown sugar": 220,
  "powdered sugar": 120,
  "confectioners sugar": 120,
  "icing sugar": 120,
  "coconut sugar": 154,
  "demerara sugar": 220,
  "turbinado sugar": 220,
  "raw sugar": 220,

  // Dairy
  butter: 227,
  "cream cheese": 227,
  "sour cream": 227,
  "heavy cream": 227,
  "whipping cream": 227,
  "double cream": 227,
  cream: 227,
  milk: 249,
  "whole milk": 249,
  buttermilk: 227,
  yogurt: 227,
  yoghurt: 227,
  "greek yogurt": 227,
  ricotta: 227,
  "ricotta cheese": 227,
  mascarpone: 227,
  "cottage cheese": 226,

  // Fats/Oils
  "vegetable oil": 198,
  "olive oil": 200,
  "coconut oil": 226,
  lard: 226,

  // Sweeteners
  honey: 340,
  molasses: 340,
  "maple syrup": 340,
  "corn syrup": 340,
  "golden syrup": 340,
  "agave syrup": 336,
  "agave nectar": 336,

  // Nuts
  almonds: 142,
  walnuts: 113,
  pecans: 105,
  cashews: 113,
  peanuts: 142,
  hazelnuts: 142,
  "macadamia nuts": 149,
  "pine nuts": 142,
  pistachios: 120,

  // Dry Goods
  oats: 85,
  "rolled oats": 85,
  "old-fashioned oats": 85,
  "cocoa powder": 85,
  cocoa: 85,
  "unsweetened cocoa": 85,
  "chocolate chips": 170,
  breadcrumbs: 112,
  coconut: 85,
  "shredded coconut": 85,
  "desiccated coconut": 85,
  rice: 185,
  "white rice": 185,
  "long grain rice": 185,
  quinoa: 177,
  polenta: 163,
  "baking powder": 192,
  "baking soda": 288,

  // Spreads
  "peanut butter": 270,
  "almond butter": 272,
  tahini: 256,

  // Other
  applesauce: 255,
  "pumpkin puree": 227,
  "pumpkin purée": 227,
  "mashed bananas": 227,
  banana: 227,
  water: 237,
};

// Keys sorted longest-first so "all-purpose flour" is tried before "flour"
const DENSITY_KEYS_BY_LENGTH = Object.keys(DENSITY_MAP).sort(
  (a, b) => b.length - a.length,
);

const PREP_WORDS = new Set([
  "chopped",
  "diced",
  "melted",
  "softened",
  "sifted",
  "packed",
  "sliced",
  "minced",
  "grated",
  "crushed",
  "toasted",
  "unsalted",
  "salted",
  "fresh",
  "frozen",
  "dried",
  "raw",
  "cooked",
]);

function cleanIngredientName(name: string): string {
  // Strip everything after a comma
  let cleaned = name.split(",")[0]!;

  // Normalize: lowercase, trim
  cleaned = cleaned.toLowerCase().trim();

  // Remove prep words
  cleaned = cleaned
    .split(/\s+/)
    .filter((word) => !PREP_WORDS.has(word))
    .join(" ")
    .trim();

  // Collapse whitespace
  cleaned = cleaned.replace(/\s+/g, " ");

  return cleaned;
}

/**
 * Check if `key` appears in `text` at a word boundary.
 * Word boundaries are: start/end of string, spaces, or hyphens.
 * This avoids \b which breaks on hyphens in keys like "all-purpose flour".
 */
function containsAtWordBoundary(text: string, key: string): boolean {
  const index = text.indexOf(key);
  if (index === -1) return false;

  const before = index === 0 || /[\s-]/.test(text[index - 1]!);
  const afterIndex = index + key.length;
  const after = afterIndex === text.length || /[\s-]/.test(text[afterIndex]!);

  return before && after;
}

/**
 * Look up the density (grams per cup) for an ingredient.
 * Returns null if no match found — caller should fall back to standard conversion.
 */
export function findIngredientDensity(ingredientName: string): number | null {
  const cleaned = cleanIngredientName(ingredientName);
  if (!cleaned) return null;

  // Exact match
  const exact = DENSITY_MAP[cleaned];
  if (exact !== undefined) return exact;

  // Substring match, longest key first
  for (const key of DENSITY_KEYS_BY_LENGTH) {
    if (containsAtWordBoundary(cleaned, key)) {
      return DENSITY_MAP[key]!;
    }
  }

  return null;
}
