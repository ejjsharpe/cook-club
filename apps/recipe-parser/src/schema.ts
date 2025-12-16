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
});

export const TagSchema = type({
  type: "'cuisine' | 'meal_type' | 'occasion'",
  name: "string",
});

export const ParsedRecipeSchema = type({
  name: "string",
  "description?": "string | null",
  "prepTime?": "string | null",
  "cookTime?": "string | null",
  "totalTime?": "string | null",
  "servings?": "number | null",
  "sourceUrl?": "string | null",
  ingredients: IngredientSchema.array().atLeastLength(1),
  instructions: InstructionSchema.array().atLeastLength(1),
  "images?": "string[]",
  "suggestedTags?": TagSchema.array(),
});

export type ParsedRecipe = typeof ParsedRecipeSchema.infer;
export type Ingredient = typeof IngredientSchema.infer;
export type Instruction = typeof InstructionSchema.infer;
export type Tag = typeof TagSchema.infer;
