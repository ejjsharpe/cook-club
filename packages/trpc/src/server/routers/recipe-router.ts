import {
  recipeIngredients,
  recipeInstructions,
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
  position: "number",
  ingredient: "string",
});

const InstructionRecord = type({
  position: "number",
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
  "recipeYield?": "string",
  "recipeCategory?": "string",
  "recipeCuisine?": "string",
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

    console.log({ recipe });

    return recipe;
  }),
  postRecipe: authedProcedure
    .input(RecipePostValidator)
    .query(async ({ input, ctx }) => {
      if (input instanceof type.errors) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: input.summary,
        });
      }

      const insertedRecipe = ctx.db.transaction(async (tx) => {
        const recipe = await tx
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

        const ingredients = await tx
          .insert(recipeIngredients)
          .values(
            input.ingredients.map((ingredient) => ({
              ...ingredient,
              recipeId: recipe.id,
            }))
          )
          .returning({
            position: recipeIngredients.position,
            ingredient: recipeIngredients.ingredient,
          });

        const instructions = await tx
          .insert(recipeInstructions)
          .values(
            input.instructions.map((instruction) => ({
              ...instruction,
              recipeId: recipe.id,
            }))
          )
          .returning({
            position: recipeInstructions.position,
            instruction: recipeInstructions.instruction,
          });

        return {
          ...recipe,
          ingredients,
          instructions,
        };
      });
      return insertedRecipe;
    }),
});
