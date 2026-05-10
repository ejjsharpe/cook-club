import type {
  GenerateRecipeImageInput,
  GenerateRecipeImageResponse,
} from "@repo/contracts/recipe-parser";

import type { Env } from "../types";

const IMAGE_MODEL = "@cf/stabilityai/stable-diffusion-xl-base-1.0" as const;

function createRecipeImagePrompt(input: GenerateRecipeImageInput): string {
  const ingredients = input.ingredients?.filter(Boolean).slice(0, 12) ?? [];
  const instructions = input.instructions?.filter(Boolean).slice(0, 4) ?? [];

  return [
    "Professional appetizing food photography of the finished dish.",
    `Dish: ${input.name.trim()}.`,
    input.description?.trim()
      ? `Description: ${input.description.trim()}.`
      : null,
    ingredients.length > 0 ? `Visible ingredients: ${ingredients.join(", ")}.` : null,
    instructions.length > 0
      ? `Cooking context: ${instructions.join(" ")}`
      : null,
    "Natural light, realistic plating, no text, no watermark, no people, no hands, no packaging.",
  ]
    .filter(Boolean)
    .join(" ");
}

export async function generateRecipeImage(
  env: Env,
  input: GenerateRecipeImageInput,
): Promise<GenerateRecipeImageResponse> {
  try {
    if (!input.name.trim()) {
      return {
        success: false,
        error: {
          code: "MISSING_RECIPE_NAME",
          message: "Add a recipe title before creating an image.",
        },
      };
    }

    const response: unknown = await (env.AI as any).run(IMAGE_MODEL, {
      prompt: createRecipeImagePrompt(input),
      negative_prompt:
        "text, watermark, logo, people, hands, packaging, utensils blocking food, blurry, low quality, distorted food",
      width: 1024,
      height: 1024,
      num_steps: 20,
      guidance: 7.5,
      seed: Math.floor(Math.random() * 1_000_000),
    });

    const imageData =
      response instanceof ReadableStream
        ? await new Response(response).arrayBuffer()
        : response instanceof ArrayBuffer
          ? response
          : null;

    if (!imageData) {
      throw new Error("Image model returned an unsupported response.");
    }

    const uploadResult = await env.IMAGE_WORKER.uploadImage(
      imageData,
      "image/jpeg",
    );

    if (!uploadResult.success || !uploadResult.key || !uploadResult.publicUrl) {
      throw new Error(uploadResult.error || "Failed to store generated image.");
    }

    return {
      success: true,
      imageUploadId: uploadResult.key,
      publicUrl: uploadResult.publicUrl,
    };
  } catch (error) {
    console.error("Recipe image generation error:", error);
    return {
      success: false,
      error: {
        code: "IMAGE_GENERATION_ERROR",
        message:
          error instanceof Error
            ? error.message
            : "Failed to create recipe image. Please try again.",
      },
    };
  }
}
