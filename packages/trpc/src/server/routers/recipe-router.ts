import {
  ingredients,
  instructions,
  recipeImages,
  recipes,
} from "@repo/db/schemas";
import { scrapeRecipe } from "@repo/recipe-scraper";
import { TRPCError } from "@trpc/server";
import { type } from "arktype";

import { router, authedProcedure } from "../trpc";

const ImageRecord = type({
  url: "string.url",
});

const IngredientRecord = type({
  index: "number",
  ingredient: "string",
});

const InstructionRecord = type({
  index: "number",
  instruction: "string",
});

export const RecipePostValidator = type({
  name: "string",
  ingredients: IngredientRecord.array(),
  instructions: InstructionRecord.array(),

  "sourceUrl?": "string",
  "datePublished?": "number",
  "author?": "string",
  "scrapedAt?": "number",

  "description?": "string",
  "prepTime?": "string",
  "cookTime?": "string",
  "totalTime?": "string",
  "yield?": "string",
  "category?": "string",
  "cuisine?": "string",
  "keywords?": "string",
  "nutrition?": "string",
  "images?": ImageRecord.array(),
});

const UrlValidator = type({ url: "string.url" });

export const recipeRouter = router({
  scrapeRecipe: authedProcedure.input(UrlValidator).query(async ({ input }) => {
    const recipe = await scrapeRecipe(input.url);
    if (!recipe) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "No recipe found at the provided URL.",
      });
    }

    return recipe;
  }),
  postRecipe: authedProcedure
    .input(RecipePostValidator)
    .mutation(async ({ input, ctx }) => {
      if (input instanceof type.errors) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: input.summary,
        });
      }

      try {
        // TODO: Transactions currently not supported in drizzle with D1. Fix later
        // Insert recipe
        const recipe = await ctx.db
          .insert(recipes)
          .values({
            ...input,
            datePublished: input.datePublished
              ? new Date(input.datePublished)
              : null,
            scrapedAt: input.scrapedAt ? new Date(input.scrapedAt) : null,
            createdAt: new Date(),
            updatedAt: new Date(),
            uploadedBy: ctx.user.id,
          })
          .returning()
          .get();

        // Insert ingredients
        const insertedIngredients = await ctx.db
          .insert(ingredients)
          .values(
            input.ingredients.map((ingredient) => ({
              ...ingredient,
              recipeId: recipe.id,
            }))
          )
          .returning({
            index: ingredients.index,
            ingredient: ingredients.ingredient,
          });

        // Insert instructions
        const insertedInstructions = await ctx.db
          .insert(instructions)
          .values(
            input.instructions.map((instruction) => ({
              ...instruction,
              recipeId: recipe.id,
            }))
          )
          .returning({
            index: instructions.index,
            instruction: instructions.instruction,
          });

        // Insert images
        let images: { url: string }[] = [];
        if (input.images && input.images.length > 0) {
          images = await ctx.db
            .insert(recipeImages)
            .values(
              input.images.map((image) => ({
                recipeId: recipe.id,
                url: image.url,
              }))
            )
            .returning({
              url: recipeImages.url,
            });
        }

        return {
          ...recipe,
          ingredients: insertedIngredients,
          instructions: insertedInstructions,
          images,
        };
      } catch (err) {
        console.error("Error saving recipe:", err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to save recipe",
        });
      }
    }),
});
