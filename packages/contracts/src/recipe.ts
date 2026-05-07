export interface ParsedIngredient {
  index: number;
  quantity?: number | null;
  unit?: string | null;
  name: string;
}

export interface ParsedInstruction {
  index: number;
  instruction: string;
  imageUrl?: string | null;
}

export interface ParsedIngredientSection {
  name: string | null;
  ingredients: ParsedIngredient[];
}

export interface ParsedInstructionSection {
  name: string | null;
  instructions: ParsedInstruction[];
}

export interface ParsedRecipeTag {
  type: "cuisine" | "meal_type" | "occasion";
  name: string;
}

export type ParsedRecipeSourceType = "url" | "image" | "text" | "ai" | "manual";

export interface ParsedRecipe {
  name: string;
  description?: string | null;
  prepTime?: number | null;
  cookTime?: number | null;
  totalTime?: number | null;
  servings?: number | null;
  sourceUrl?: string | null;
  sourceType?: ParsedRecipeSourceType;
  ingredientSections: ParsedIngredientSection[];
  instructionSections: ParsedInstructionSection[];
  images?: string[];
  suggestedTags?: ParsedRecipeTag[];
}
