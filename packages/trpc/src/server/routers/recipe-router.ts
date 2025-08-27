import {
  recipeIngredients,
  recipeInstructions,
  recipeImages,
  recipes,
  userRecipes,
} from "@repo/db/schemas";
import { scrapeRecipe } from "@repo/recipe-scraper";
import { TRPCError } from "@trpc/server";
import { type } from "arktype";
import { eq, lt, desc, and, like } from "drizzle-orm";

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
  "servings?": "number",
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
          .insert(recipeIngredients)
          .values(
            input.ingredients.map((ingredient) => ({
              ...ingredient,
              recipeId: recipe.id,
            }))
          )
          .returning({
            index: recipeIngredients.index,
            ingredient: recipeIngredients.ingredient,
          });

        // Insert instructions
        const insertedInstructions = await ctx.db
          .insert(recipeInstructions)
          .values(
            input.instructions.map((instruction) => ({
              ...instruction,
              recipeId: recipe.id,
            }))
          )
          .returning({
            index: recipeInstructions.index,
            instruction: recipeInstructions.instruction,
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

        await ctx.db.insert(userRecipes).values({
          userId: ctx.user.id,
          recipeId: recipe.id,
          createdAt: new Date(),
        });

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

  getUserRecipes: authedProcedure
    .input(
      type({
        limit: "number = 20",
        cursor: "number?",
        search: "string?",
      })
    )
    .query(async ({ ctx, input }) => {
      const { limit, cursor, search } = input;

      try {
        const userRecipesList = await ctx.db
          .select({
            recipe: recipes,
            userRecipe: userRecipes,
          })
          .from(userRecipes)
          .innerJoin(recipes, eq(userRecipes.recipeId, recipes.id))
          .where(
            and(
              eq(userRecipes.userId, ctx.user.id),
              cursor ? lt(userRecipes.createdAt, new Date(cursor)) : undefined,
              search
                ? like(recipes.name, `%${search.toLowerCase()}%`)
                : undefined
            )
          )
          .orderBy(desc(userRecipes.createdAt))
          .limit(limit + 1);

        const items = userRecipesList.map((item) => ({
          ...item.recipe,
          addedAt: item.userRecipe.createdAt,
        }));

        let nextCursor: number | undefined = undefined;
        if (items.length > limit) {
          const nextItem = items.pop();
          nextCursor = nextItem?.addedAt.getTime();
        }

        return {
          items,
          nextCursor,
        };
      } catch (err) {
        console.log({ err });
        throw err;
      }
    }),
});
