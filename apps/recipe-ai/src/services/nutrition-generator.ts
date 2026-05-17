import type { NutritionInput, NutritionResponse } from "@repo/contracts";

import type { Nutrition } from "../schema";
import type { Env } from "../types";
import { fetchHtml } from "../utils/html-fetcher";
import { extractStructuredRecipeCandidates } from "../utils/structured-data";

const TEXT_MODEL = "@cf/meta/llama-4-scout-17b-16e-instruct" as const;

function parseJsonResponse(response: unknown): Record<string, unknown> {
  const value =
    typeof response === "string"
      ? response
      : ((response as Record<string, unknown>)?.response ??
        (response as Record<string, unknown>)?.generated_text ??
        (response as Record<string, unknown>)?.result ??
        response);

  if (typeof value !== "string") {
    return value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  }

  let json = value.trim();
  if (json.startsWith("```json")) json = json.slice(7);
  if (json.startsWith("```")) json = json.slice(3);
  if (json.endsWith("```")) json = json.slice(0, -3);

  return JSON.parse(json.trim()) as Record<string, unknown>;
}

function numberOrNull(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;

  const match = value.replace(/,/g, "").match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;

  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeNutrition(
  input: Record<string, unknown>,
  source: Nutrition["source"],
): Nutrition {
  return {
    calories: numberOrNull(input.calories),
    protein: numberOrNull(input.protein),
    carbohydrates: numberOrNull(input.carbohydrates),
    fat: numberOrNull(input.fat),
    saturatedFat: numberOrNull(input.saturatedFat),
    fiber: numberOrNull(input.fiber),
    sugar: numberOrNull(input.sugar),
    sodium: numberOrNull(input.sodium),
    cholesterol: numberOrNull(input.cholesterol),
    potassium: numberOrNull(input.potassium),
    vitaminA: numberOrNull(input.vitaminA),
    vitaminC: numberOrNull(input.vitaminC),
    calcium: numberOrNull(input.calcium),
    iron: numberOrNull(input.iron),
    source,
    confidence:
      input.confidence === "high" ||
      input.confidence === "medium" ||
      input.confidence === "low"
        ? input.confidence
        : source === "extracted"
          ? "high"
          : "medium",
  };
}

function hasNutritionValues(nutrition: Nutrition | null | undefined) {
  if (!nutrition) return false;
  return [
    nutrition.calories,
    nutrition.protein,
    nutrition.carbohydrates,
    nutrition.fat,
    nutrition.saturatedFat,
    nutrition.fiber,
    nutrition.sugar,
    nutrition.sodium,
    nutrition.cholesterol,
    nutrition.potassium,
    nutrition.vitaminA,
    nutrition.vitaminC,
    nutrition.calcium,
    nutrition.iron,
  ].some((value) => typeof value === "number" && Number.isFinite(value));
}

async function extractNutritionFromSource(
  sourceUrl: string | null | undefined,
): Promise<Nutrition | null> {
  if (!sourceUrl) return null;

  try {
    const html = await fetchHtml(sourceUrl, 0);
    const structuredRecipe = extractStructuredRecipeCandidates(
      html,
      sourceUrl,
    ).find((recipe) => hasNutritionValues(recipe.nutrition));

    return structuredRecipe?.nutrition ?? null;
  } catch (error) {
    console.log(
      "Nutrition source extraction failed:",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

function recipeToNutritionPrompt(recipe: NutritionInput["recipe"]) {
  const ingredients = recipe.ingredientSections
    .flatMap((section) => section.ingredients)
    .map((ingredient) =>
      [
        ingredient.quantity,
        ingredient.unit,
        ingredient.name,
      ].filter(Boolean).join(" "),
    )
    .join("\n");

  const instructions = recipe.instructionSections
    .flatMap((section) => section.instructions)
    .map((instruction) => instruction.instruction)
    .join("\n");

  return `
Estimate nutrition per serving for this recipe. Return JSON only, with numeric values or null:
{
  "calories": number | null,
  "protein": number | null,
  "carbohydrates": number | null,
  "fat": number | null,
  "saturatedFat": number | null,
  "fiber": number | null,
  "sugar": number | null,
  "sodium": number | null,
  "cholesterol": number | null,
  "potassium": number | null,
  "vitaminA": number | null,
  "vitaminC": number | null,
  "calcium": number | null,
  "iron": number | null,
  "confidence": "low" | "medium" | "high"
}

Use kcal for calories, grams for protein/carbohydrates/fat/saturatedFat/fiber/sugar, milligrams for sodium/cholesterol/potassium, and percent daily value for vitaminA/vitaminC/calcium/iron. Estimate conservatively from the ingredient amounts and servings. If servings are missing, assume 4 servings and set confidence to low.

Recipe: ${recipe.name}
Description: ${recipe.description ?? ""}
Servings: ${recipe.servings ?? "unknown"}
Ingredients:
${ingredients}

Method:
${instructions}
`;
}

async function estimateNutritionWithAi(
  ai: Env["AI"],
  recipe: NutritionInput["recipe"],
): Promise<Nutrition> {
  const response = await (ai as any).run(TEXT_MODEL, {
    messages: [
      {
        role: "system",
        content:
          "You are a nutrition analysis assistant. Return only valid JSON. Values must be per serving estimates.",
      },
      { role: "user", content: recipeToNutritionPrompt(recipe) },
    ],
    max_tokens: 1024,
  });

  return normalizeNutrition(parseJsonResponse(response), "ai_estimated");
}

export async function generateNutrition(
  env: Env,
  input: NutritionInput,
): Promise<NutritionResponse> {
  const existing = input.recipe.nutrition;
  if (hasNutritionValues(existing)) {
    const source =
      existing?.source === "ai_estimated" ||
      existing?.source === "manual" ||
      existing?.source === "imported"
        ? existing.source
        : "extracted";
    return {
      success: true,
      data: normalizeNutrition(existing as Record<string, unknown>, source),
    };
  }

  const extracted = await extractNutritionFromSource(
    input.sourceUrl ?? input.recipe.sourceUrl,
  );
  if (hasNutritionValues(extracted)) {
    return { success: true, data: extracted! };
  }

  try {
    const estimated = await estimateNutritionWithAi(env.AI, input.recipe);
    return { success: true, data: estimated };
  } catch (error) {
    return {
      success: false,
      error: {
        code: "NUTRITION_GENERATION_FAILED",
        message:
          error instanceof Error
            ? error.message
            : "Could not generate nutrition for this recipe",
      },
    };
  }
}
