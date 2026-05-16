import type {
  ParsedRecipe,
  IngredientSection,
  InstructionSection,
} from "../schema";

export type RecipeQualitySource =
  | "cached"
  | "structured"
  | "visible"
  | "reader"
  | "ai"
  | "social_ai";

export interface RecipeQuality {
  score: number;
  confidence: "high" | "medium" | "low";
  usable: boolean;
  ingredientCount: number;
  instructionCount: number;
  reasons: string[];
}

const BAD_DESCRIPTION_PATTERNS = [
  /\bread more\b/i,
  /\bfollow\b/i,
  /\bsign in\b/i,
  /\bsign up\b/i,
  /\bcreate an account\b/i,
  /\badvertisement\b/i,
  /\bsponsored\b/i,
  /\bnutritional info\b/i,
  /\bimage credit\b/i,
  /\bphoto credit\b/i,
  /^\s*published\s+/i,
  /^\s*updated\s+/i,
];

const TRACKING_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "fbclid",
  "gclid",
  "gbraid",
  "wbraid",
  "mc_cid",
  "mc_eid",
  "igshid",
  "ref",
]);

function countIngredients(sections: IngredientSection[]): number {
  return sections.reduce((sum, section) => sum + section.ingredients.length, 0);
}

function countInstructions(sections: InstructionSection[]): number {
  return sections.reduce(
    (sum, section) => sum + section.instructions.length,
    0,
  );
}

function isBadDescription(description: string | null | undefined): boolean {
  if (!description) return false;
  const normalized = description.trim();
  if (normalized.length > 700) return true;
  return BAD_DESCRIPTION_PATTERNS.some((pattern) => pattern.test(normalized));
}

function isBadImageUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return (
    !/^https?:\/\//i.test(url) ||
    lower.startsWith("blob:") ||
    lower.startsWith("data:") ||
    lower.includes("/api/v1/") ||
    lower.includes("ad.gt") ||
    lower.includes("adnxs") ||
    lower.includes("pubmatic") ||
    lower.includes("rubiconproject") ||
    lower.includes("adsrvr") ||
    lower.includes("avatar") ||
    lower.includes("logo") ||
    lower.includes("placeholder")
  );
}

function sourceBonus(source: RecipeQualitySource): number {
  switch (source) {
    case "structured":
      return 16;
    case "visible":
      return 12;
    case "reader":
      return 10;
    case "cached":
      return 8;
    case "social_ai":
      return 8;
    case "ai":
      return 5;
  }
}

function sourceThreshold(source: RecipeQualitySource): number {
  switch (source) {
    case "structured":
      return 45;
    case "visible":
      return 50;
    case "reader":
      return 50;
    case "cached":
      return 45;
    case "social_ai":
      return 52;
    case "ai":
      return 60;
  }
}

export function normalizeRecipeForImport(recipe: ParsedRecipe): ParsedRecipe {
  const ingredientSections = recipe.ingredientSections
    .map((section) => ({
      name: section.name?.trim() || null,
      ingredients: section.ingredients
        .filter((ingredient) => ingredient.name.trim().length > 0)
        .map((ingredient, index) => ({
          ...ingredient,
          index,
          name: ingredient.name.trim(),
          unit: ingredient.unit?.trim() || null,
        })),
    }))
    .filter((section) => section.ingredients.length > 0);

  const instructionSections = recipe.instructionSections
    .map((section) => ({
      name: section.name?.trim() || null,
      instructions: section.instructions
        .filter((instruction) => instruction.instruction.trim().length > 0)
        .map((instruction, index) => ({
          ...instruction,
          index,
          instruction: instruction.instruction.trim(),
          imageUrl: instruction.imageUrl?.trim() || null,
        })),
    }))
    .filter((section) => section.instructions.length > 0);

  const images = Array.from(
    new Set((recipe.images ?? []).map((url) => url.trim()).filter(Boolean)),
  ).filter((url) => !isBadImageUrl(url));

  return {
    ...recipe,
    name: recipe.name.trim(),
    description:
      recipe.description && !isBadDescription(recipe.description)
        ? recipe.description.trim()
        : null,
    ingredientSections,
    instructionSections,
    images,
  };
}

export function mergeRecipeImages(
  recipe: ParsedRecipe,
  images: string[],
): ParsedRecipe {
  const merged = Array.from(new Set([...(recipe.images ?? []), ...images]));
  return normalizeRecipeForImport({ ...recipe, images: merged });
}

export function normalizeRecipeUrl(url: string): string {
  const parsed = new URL(url);
  parsed.hash = "";

  for (const key of Array.from(parsed.searchParams.keys())) {
    if (
      TRACKING_PARAMS.has(key.toLowerCase()) ||
      key.toLowerCase().startsWith("utm_")
    ) {
      parsed.searchParams.delete(key);
    }
  }

  parsed.searchParams.sort();
  return parsed.toString();
}

export function evaluateRecipeQuality(
  inputRecipe: ParsedRecipe,
  source: RecipeQualitySource,
): RecipeQuality {
  const recipe = normalizeRecipeForImport(inputRecipe);
  const ingredientCount = countIngredients(recipe.ingredientSections);
  const instructionCount = countInstructions(recipe.instructionSections);
  const reasons: string[] = [];
  let score = sourceBonus(source);

  if (recipe.name.length >= 3) {
    score += 24;
  } else {
    reasons.push("missing_title");
    score -= 25;
  }

  if (/^(recipe|untitled|food)$/i.test(recipe.name)) {
    reasons.push("generic_title");
    score -= 20;
  }

  score += Math.min(ingredientCount * 5, 30);
  score += Math.min(instructionCount * 7, 30);

  if ((recipe.images ?? []).length > 0) score += 8;
  if (recipe.prepTime || recipe.cookTime || recipe.totalTime) score += 5;
  if (recipe.servings) score += 4;
  if (recipe.description) score += 4;
  if (isBadDescription(inputRecipe.description)) {
    reasons.push("bad_description");
    score -= 12;
  }

  if (ingredientCount === 0) reasons.push("missing_ingredients");
  if (instructionCount === 0) reasons.push("missing_instructions");

  const hasMinimumShape =
    recipe.name.length >= 3 && ingredientCount >= 1 && instructionCount >= 1;
  const threshold = sourceThreshold(source);
  const usable = hasMinimumShape && score >= threshold;
  const confidence =
    score >= 75 ? "high" : score >= threshold ? "medium" : "low";

  return {
    score,
    confidence,
    usable,
    ingredientCount,
    instructionCount,
    reasons,
  };
}
