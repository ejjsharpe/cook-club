import {
  recipeIngredients,
  recipeInstructions,
  recipeImages,
  recipes,
  userRecipes,
  user,
} from "@repo/db/schemas";
import { scrapeRecipe } from "@repo/recipe-scraper";
import { TRPCError } from "@trpc/server";
import { type } from "arktype";
import { eq, lt, desc, and, like, count, gte } from "drizzle-orm";

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
    try {
      const recipe = await scrapeRecipe(input.url);
      if (!recipe) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No recipe found at the provided URL.",
        });
      }
      return recipe;
    } catch (err) {
      console.error("Error scraping recipe:", err);

      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message:
          "Failed to scrape recipe. The website might be blocking requests or experiencing issues.",
      });
    }
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
            firstImage: recipeImages.url,
          })
          .from(userRecipes)
          .innerJoin(recipes, eq(userRecipes.recipeId, recipes.id))
          .leftJoin(recipeImages, eq(recipes.id, recipeImages.recipeId))
          .where(
            and(
              eq(userRecipes.userId, ctx.user.id),
              cursor ? lt(userRecipes.createdAt, new Date(cursor)) : undefined,
              search
                ? like(recipes.name, `%${search.toLowerCase()}%`)
                : undefined
            )
          )
          .groupBy(userRecipes.id, recipes.id) // Group to get only one image per recipe
          .orderBy(desc(userRecipes.createdAt))
          .limit(limit + 1);

        const items = userRecipesList.map((item) => ({
          ...item.recipe,
          addedAt: item.userRecipe.createdAt,
          coverImage: item.firstImage,
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

  getPopularRecipes: authedProcedure
    .input(
      type({
        limit: "number = 10",
        "daysBack?": "number",
      })
    )
    .query(async ({ ctx, input }) => {
      const { limit, daysBack } = input;

      try {
        // Calculate date threshold (e.g., last 7 days for trending saves)
        const dateThreshold = new Date();
        dateThreshold.setDate(dateThreshold.getDate() - (daysBack || 7));

        const popularRecipes = await ctx.db
          .select({
            recipe: recipes,
            saveCount: count(userRecipes.id),
            firstImage: recipeImages.url,
          })
          .from(recipes)
          .leftJoin(userRecipes, eq(recipes.id, userRecipes.recipeId))
          .leftJoin(recipeImages, eq(recipes.id, recipeImages.recipeId))
          .where(gte(userRecipes.createdAt, dateThreshold))
          .groupBy(recipes.id)
          .orderBy(desc(count(userRecipes.id)))
          .limit(limit);

        return popularRecipes.map((item) => ({
          ...item.recipe,
          saveCount: item.saveCount,
          coverImage: item.firstImage,
        }));
      } catch (err) {
        console.error("Error fetching popular recipes:", err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch popular recipes",
        });
      }
    }),

  getRecipeDetail: authedProcedure
    .input(
      type({
        recipeId: "number",
      })
    )
    .query(async ({ ctx, input }) => {
      const { recipeId } = input;

      try {
        // Get recipe with uploader info
        const recipeData = await ctx.db
          .select({
            recipe: recipes,
            uploader: {
              id: user.id,
              name: user.name,
              email: user.email,
              image: user.image,
            },
          })
          .from(recipes)
          .innerJoin(user, eq(recipes.uploadedBy, user.id))
          .where(eq(recipes.id, recipeId))
          .get();

        if (!recipeData) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Recipe not found",
          });
        }

        // Get recipe images
        const images = await ctx.db
          .select({
            id: recipeImages.id,
            url: recipeImages.url,
          })
          .from(recipeImages)
          .where(eq(recipeImages.recipeId, recipeId));

        // Get recipe ingredients
        const ingredients = await ctx.db
          .select({
            index: recipeIngredients.index,
            ingredient: recipeIngredients.ingredient,
          })
          .from(recipeIngredients)
          .where(eq(recipeIngredients.recipeId, recipeId))
          .orderBy(recipeIngredients.index);

        // Get recipe instructions
        const instructions = await ctx.db
          .select({
            index: recipeInstructions.index,
            instruction: recipeInstructions.instruction,
          })
          .from(recipeInstructions)
          .where(eq(recipeInstructions.recipeId, recipeId))
          .orderBy(recipeInstructions.index);

        // Get uploader's total recipe count
        const uploaderRecipeCount = await ctx.db
          .select({
            count: count(recipes.id),
          })
          .from(recipes)
          .where(eq(recipes.uploadedBy, recipeData.uploader.id))
          .get();

        // Check if current user has saved this recipe
        const isSaved = await ctx.db
          .select()
          .from(userRecipes)
          .where(
            and(
              eq(userRecipes.userId, ctx.user.id),
              eq(userRecipes.recipeId, recipeId)
            )
          )
          .get();

        return {
          ...recipeData.recipe,
          uploadedBy: recipeData.uploader,
          images,
          ingredients,
          instructions,
          userRecipesCount: uploaderRecipeCount?.count || 0,
          isSaved: !!isSaved,
        };
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        console.error("Error fetching recipe detail:", err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch recipe detail",
        });
      }
    }),

  saveRecipe: authedProcedure
    .input(
      type({
        recipeId: "number",
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { recipeId } = input;

      try {
        // Check if recipe exists
        const recipe = await ctx.db
          .select({ id: recipes.id })
          .from(recipes)
          .where(eq(recipes.id, recipeId))
          .get();

        if (!recipe) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Recipe not found",
          });
        }

        // Check if already saved
        const existingSave = await ctx.db
          .select()
          .from(userRecipes)
          .where(
            and(
              eq(userRecipes.userId, ctx.user.id),
              eq(userRecipes.recipeId, recipeId)
            )
          )
          .get();

        if (existingSave) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Recipe already saved",
          });
        }

        // Save the recipe
        await ctx.db.insert(userRecipes).values({
          userId: ctx.user.id,
          recipeId,
          createdAt: new Date(),
        });

        return { success: true };
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        console.error("Error saving recipe:", err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to save recipe",
        });
      }
    }),
});
