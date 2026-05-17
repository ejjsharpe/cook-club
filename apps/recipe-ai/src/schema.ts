import { type } from "arktype";

export const IngredientSchema = type({
  index: "number >= 0",
  "quantity?": "number | null",
  "unit?": "string | null",
  name: "string",
});

export const InstructionSchema = type({
  index: "number >= 0",
  instruction: "string",
  "imageUrl?": "string | null",
});

export const IngredientSectionSchema = type({
  name: "string | null",
  ingredients: IngredientSchema.array(),
});

export const InstructionSectionSchema = type({
  name: "string | null",
  instructions: InstructionSchema.array(),
});

export const TagSchema = type({
  type: "'cuisine' | 'meal_type' | 'occasion'",
  name: "string",
});

export const SourceTypeSchema = type(
  "'url' | 'image' | 'text' | 'ai' | 'manual'",
);

export const NutritionSourceSchema = type(
  "'extracted' | 'ai_estimated' | 'manual' | 'imported'",
);

export const NutritionConfidenceSchema = type("'high' | 'medium' | 'low'");

export const NutritionSchema = type({
  "calories?": "number | null",
  "protein?": "number | null",
  "carbohydrates?": "number | null",
  "fat?": "number | null",
  "saturatedFat?": "number | null",
  "fiber?": "number | null",
  "sugar?": "number | null",
  "sodium?": "number | null",
  "cholesterol?": "number | null",
  "potassium?": "number | null",
  "vitaminA?": "number | null",
  "vitaminC?": "number | null",
  "calcium?": "number | null",
  "iron?": "number | null",
  "source?": NutritionSourceSchema,
  "confidence?": "('high' | 'medium' | 'low') | null",
});

export const ParsedRecipeSchema = type({
  name: "string",
  "description?": "string | null",
  "prepTime?": "number | null", // minutes
  "cookTime?": "number | null", // minutes
  "totalTime?": "number | null", // minutes
  "servings?": "number | null",
  "sourceUrl?": "string | null",
  "sourceType?": SourceTypeSchema,
  ingredientSections: IngredientSectionSchema.array().atLeastLength(1),
  instructionSections: InstructionSectionSchema.array().atLeastLength(1),
  "images?": "string[]",
  "suggestedTags?": TagSchema.array(),
  "nutrition?": "object | null",
});

export type ParsedRecipe = typeof ParsedRecipeSchema.infer;
export type Ingredient = typeof IngredientSchema.infer;
export type Instruction = typeof InstructionSchema.infer;
export type IngredientSection = typeof IngredientSectionSchema.infer;
export type InstructionSection = typeof InstructionSectionSchema.infer;
export type Tag = typeof TagSchema.infer;
export type SourceType = typeof SourceTypeSchema.infer;
export type Nutrition = typeof NutritionSchema.infer;
