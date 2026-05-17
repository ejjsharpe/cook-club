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

export type ParsedRecipeNutritionSource =
  | "extracted"
  | "ai_estimated"
  | "manual"
  | "imported";

export type ParsedRecipeNutritionConfidence = "high" | "medium" | "low";

export interface ParsedRecipeNutrition {
  calories?: number | null;
  protein?: number | null;
  carbohydrates?: number | null;
  fat?: number | null;
  saturatedFat?: number | null;
  fiber?: number | null;
  sugar?: number | null;
  sodium?: number | null;
  cholesterol?: number | null;
  potassium?: number | null;
  vitaminA?: number | null;
  vitaminC?: number | null;
  calcium?: number | null;
  iron?: number | null;
  source?: ParsedRecipeNutritionSource;
  confidence?: ParsedRecipeNutritionConfidence | null;
}

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
  nutrition?: ParsedRecipeNutrition | null;
}
