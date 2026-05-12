import type {
  ParseResponse,
  PersonalizeRecipeInput,
  PersonalizationGoal,
} from "@repo/contracts/recipe-ai";

import type { ParsedRecipe } from "../schema";
import type { Env } from "../types";

const TEXT_MODEL = "@cf/meta/llama-4-scout-17b-16e-instruct" as const;

const GOAL_LABELS: Record<PersonalizationGoal, string> = {
  vegetarian: "make it vegetarian",
  vegan: "make it vegan",
  gluten_free: "make it gluten-free",
  dairy_free: "make it dairy-free",
  low_carb: "make it lower carb",
  high_protein: "make it higher protein",
  budget: "make it cheaper using budget swaps",
  healthier: "make it healthier while keeping the same style",
  kid_friendly: "make it kid-friendly",
  batch_cook: "make it batch-cook friendly",
  meal_prep: "make it meal-prep friendly",
};

const PERSONALIZE_RECIPE_SYSTEM_PROMPT = `You are a Recipe Personalisation API. Rewrite the provided recipe to match the user's selected goals.

### RULES:
1. JSON ONLY: Output strictly valid JSON. No markdown code blocks, no explanation, no extra text.
2. Preserve the original recipe's core dish, cuisine style, structure, and practicality unless the selected goals require a change.
3. Apply every selected goal and note. For allergies or avoided ingredients, remove or replace those ingredients throughout the recipe.
4. Do not claim a recipe is medically safe, allergen-free, or suitable for a condition. Only adapt ingredients and wording.
5. Keep quantities realistic for the serving count. Update prepTime, cookTime, totalTime, servings, ingredients, and instructions if the changes require it.
6. Keep sections when useful. If there are no groupings, use a single section with name: null.
7. Ingredients must be structured with quantity, unit, name, and preparation separated.
8. Instructions must be complete, actionable cooking steps.

### OUTPUT FORMAT:
{
  "name": "Recipe Name",
  "description": "Brief description or null",
  "prepTime": 15,
  "cookTime": 30,
  "totalTime": 45,
  "servings": 4,
  "ingredientSections": [
    {
      "name": null,
      "ingredients": [
        {"index": 0, "quantity": 2, "unit": "cup", "name": "flour", "preparation": null}
      ]
    }
  ],
  "instructionSections": [
    {
      "name": null,
      "instructions": [
        {"index": 0, "instruction": "Preheat oven to 350°F.", "imageUrl": null}
      ]
    }
  ],
  "suggestedTags": [
    {"type": "cuisine", "name": "Italian"},
    {"type": "meal_type", "name": "dinner"}
  ]
}`;

function parseJsonResponse(response: string): ParsedRecipe {
  let jsonStr = response.trim();

  if (jsonStr.startsWith("```json")) {
    jsonStr = jsonStr.slice(7);
  } else if (jsonStr.startsWith("```")) {
    jsonStr = jsonStr.slice(3);
  }

  if (jsonStr.endsWith("```")) {
    jsonStr = jsonStr.slice(0, -3);
  }

  jsonStr = jsonStr.trim();

  try {
    return JSON.parse(jsonStr) as ParsedRecipe;
  } catch {
    throw new Error(`Failed to parse AI response as JSON: ${jsonStr}`);
  }
}

function parseAiResponse(response: unknown): ParsedRecipe {
  const aiResponse =
    typeof response === "string"
      ? response
      : (response as Record<string, unknown>)?.response;

  if (!aiResponse) {
    throw new Error("Invalid AI response format");
  }

  if (typeof aiResponse !== "string") {
    return aiResponse as ParsedRecipe;
  }

  return parseJsonResponse(aiResponse);
}

function createPersonalizationPrompt(input: PersonalizeRecipeInput): string {
  const goals =
    input.goals.length > 0
      ? input.goals.map((goal) => GOAL_LABELS[goal]).join(", ")
      : "use the user's notes only";

  return `Personalise this recipe.

Selected goals: ${goals}
Allergies or ingredients to avoid: ${input.allergyNotes?.trim() || "none"}
Extra notes: ${input.customNotes?.trim() || "none"}

Original recipe JSON:
${JSON.stringify(input.recipe, null, 2)}`;
}

function withPreservedMetadata(
  generated: ParsedRecipe,
  original: ParsedRecipe,
): ParsedRecipe {
  return {
    ...generated,
    sourceType: "ai",
    sourceUrl: original.sourceUrl ?? generated.sourceUrl ?? null,
    images: original.images ?? generated.images ?? [],
  };
}

export async function personalizeRecipe(
  ai: Env["AI"],
  input: PersonalizeRecipeInput,
): Promise<ParseResponse> {
  try {
    const response = await (ai as any).run(TEXT_MODEL, {
      messages: [
        { role: "system", content: PERSONALIZE_RECIPE_SYSTEM_PROMPT },
        { role: "user", content: createPersonalizationPrompt(input) },
      ],
      max_tokens: 4096,
    });

    const recipe = withPreservedMetadata(
      parseAiResponse(response),
      input.recipe,
    );

    return {
      success: true,
      data: recipe,
      metadata: {
        source: "text",
        parseMethod: "ai_only",
        confidence: "medium",
      },
    };
  } catch (error) {
    console.error("Recipe personalisation error:", error);
    return {
      success: false,
      error: {
        code: "PERSONALIZATION_ERROR",
        message:
          error instanceof Error
            ? error.message
            : "Failed to personalise recipe. Please try again.",
      },
    };
  }
}
