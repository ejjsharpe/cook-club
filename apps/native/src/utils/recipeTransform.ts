import type { ParsedRecipe, Recipe } from "@/api/recipe";

/**
 * Type for a parsed recipe that can be displayed in preview mode
 */
export type PreviewRecipe = Omit<Recipe, "id"> & {
  isPreview: true;
  id: -1;
};

/**
 * Transform a ParsedRecipe into a display-compatible Recipe format for preview mode.
 * This creates a "mock" recipe object that can be rendered by RecipeDetailScreen
 * without fetching from the server.
 */
export function transformParsedRecipeForPreview(
  parsedRecipe: ParsedRecipe,
): PreviewRecipe | null {
  if (!parsedRecipe.success || !parsedRecipe.data) {
    return null;
  }

  const data = parsedRecipe.data;

  // Build ingredient sections from parsed data
  const ingredientSections = data.ingredientSections?.length
    ? data.ingredientSections.map((section, sectionIndex) => ({
        id: -(sectionIndex + 1),
        name: section.name,
        index: sectionIndex,
        ingredients: section.ingredients.map((ing, ingIndex) => ({
          id: -(sectionIndex * 1000 + ingIndex + 1),
          index: ingIndex,
          quantity: ing.quantity?.toString() ?? null,
          unit: ing.unit ?? null,
          name: ing.name,
        })),
      }))
    : [
        {
          id: -1,
          name: null,
          index: 0,
          ingredients: [],
        },
      ];

  // Build instruction sections from parsed data
  const instructionSections = data.instructionSections?.length
    ? data.instructionSections.map((section, sectionIndex) => ({
        id: -(sectionIndex + 1),
        name: section.name,
        index: sectionIndex,
        instructions: section.instructions.map((inst, instIndex) => ({
          id: -(sectionIndex * 1000 + instIndex + 1),
          index: instIndex,
          instruction: inst.instruction,
          imageUrl: inst.imageUrl ?? null,
        })),
      }))
    : [
        {
          id: -1,
          name: null,
          index: 0,
          instructions: [],
        },
      ];

  return {
    isPreview: true,
    id: -1,
    name: data.name,
    description: data.description ?? null,
    prepTime: data.prepTime ?? null,
    cookTime: data.cookTime ?? null,
    totalTime: data.totalTime ?? null,
    servings: data.servings ?? 4,
    sourceUrl: data.sourceUrl ?? null,
    sourceType: parsedRecipe.metadata.source,
    createdAt: new Date(),
    updatedAt: new Date(),

    // Mock owner (will be replaced with actual user on save)
    owner: {
      id: "",
      name: data.author ?? "Unknown",
      email: "",
      image: null,
    },

    // Transform images - assign temporary IDs
    images: (data.images ?? []).map((url, index) => ({
      id: -(index + 1),
      url,
    })),

    ingredientSections,
    instructionSections,

    // Preview-specific defaults
    userRecipesCount: 0,
    collectionIds: [],
    isInShoppingList: false,
    saveCount: 0,
    originalOwner: null,
    userReviewRating: null,
    tags: [],
  };
}

/**
 * Validation result for recipe save
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Validate a parsed recipe has all required fields before saving
 */
export function validateRecipeForSave(
  parsedRecipe: ParsedRecipe,
): ValidationResult {
  const errors: string[] = [];

  if (!parsedRecipe.success || !parsedRecipe.data) {
    errors.push("Recipe parsing failed");
    return { isValid: false, errors };
  }

  const data = parsedRecipe.data;

  // Required: title
  if (!data.name || !data.name.trim()) {
    errors.push("Recipe must have a title");
  }

  // Required: at least 1 ingredient
  const hasIngredients = data.ingredientSections?.some(
    (section) => section.ingredients.length > 0,
  );
  if (!hasIngredients) {
    errors.push("Recipe must have at least one ingredient");
  }

  // Required: at least 1 instruction
  const hasInstructions = data.instructionSections?.some(
    (section) => section.instructions.length > 0,
  );
  if (!hasInstructions) {
    errors.push("Recipe must have at least one instruction");
  }

  // Required: at least 1 image
  if (!data.images || data.images.length === 0) {
    errors.push("Recipe must have at least one image");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Transform a ParsedRecipe into the format expected by postRecipe mutation
 */
export function transformParsedRecipeForSave(parsedRecipe: ParsedRecipe) {
  if (!parsedRecipe.success || !parsedRecipe.data) {
    throw new Error("Cannot save invalid parsed recipe");
  }

  const data = parsedRecipe.data;

  return {
    name: data.name.trim(),
    description: data.description?.trim() || undefined,
    prepTime: data.prepTime ?? undefined,
    cookTime: data.cookTime ?? undefined,
    totalTime: data.totalTime ?? undefined,
    servings: data.servings ?? 4,
    ingredientSections: (data.ingredientSections ?? []).map((section) => ({
      name: section.name,
      ingredients: section.ingredients.map((ing, idx) => ({
        index: idx,
        quantity: ing.quantity?.toString() ?? null,
        unit: ing.unit ?? null,
        name: ing.name,
      })),
    })),
    instructionSections: (data.instructionSections ?? []).map((section) => ({
      name: section.name,
      instructions: section.instructions.map((inst, idx) => ({
        index: idx,
        instruction: inst.instruction,
        imageUrl: inst.imageUrl ?? null,
      })),
    })),
    images: (data.images ?? []).map((url) => ({ url })),
    sourceUrl: data.sourceUrl || undefined,
    sourceType: parsedRecipe.metadata.source as
      | "url"
      | "text"
      | "image"
      | "ai"
      | "manual",
  };
}
