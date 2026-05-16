import type {
  IngredientSection,
  InstructionSection,
  ParsedRecipe,
  SourceType,
} from "../schema";
import type { AiRecipeResult } from "./ai-client";
import { normalizeUnit } from "../utils/unit-normalizer";

interface AiRecipeMappingOptions {
  sourceType: SourceType;
  sourceUrl: string | null;
  images?: string[];
}

export function aiResultToRecipe(
  ai: AiRecipeResult,
  options: AiRecipeMappingOptions,
): ParsedRecipe {
  const ingredientSections: IngredientSection[] = ai.ingredientSections.map(
    (section) => ({
      name: section.name,
      ingredients: section.ingredients.map((ingredient, index) => ({
        index,
        quantity: ingredient.quantity,
        unit: ingredient.unit ? normalizeUnit(ingredient.unit) : null,
        name: ingredient.name,
      })),
    }),
  );

  const instructionSections: InstructionSection[] = ai.instructionSections.map(
    (section) => ({
      name: section.name,
      instructions: section.instructions.map((instruction, index) => ({
        index,
        instruction: instruction.instruction,
        imageUrl: instruction.imageUrl || null,
      })),
    }),
  );

  return {
    name: ai.name,
    description: ai.description,
    prepTime: ai.prepTime,
    cookTime: ai.cookTime,
    totalTime: ai.totalTime,
    servings: ai.servings,
    sourceUrl: options.sourceUrl,
    sourceType: options.sourceType,
    ingredientSections,
    instructionSections,
    images: options.images ?? [],
    suggestedTags: ai.suggestedTags,
  };
}
