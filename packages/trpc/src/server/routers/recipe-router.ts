import {
  recipeIngredients,
  recipeInstructions,
  recipeImages,
  recipes,
  recipeCollections,
  collections,
  user,
  tags,
  recipeTags,
  follows,
  shoppingLists,
  shoppingListRecipes,
  activityEvents,
} from "@repo/db/schemas";
import { TRPCError } from "@trpc/server";
import { type } from "arktype";
import {
  eq,
  lt,
  desc,
  and,
  like,
  ilike,
  count,
  countDistinct,
  inArray,
  min,
  sql,
} from "drizzle-orm";

import {
  parseIngredient,
  parseIngredients,
} from "../../utils/ingredientParser";
import { normalizeUnit } from "../../utils/unitNormalizer";
import { propagateActivityToFollowers } from "../services/activity/activity-propagation.service";
import {
  queryPopularRecipesThisWeek,
  validateTags,
  createRecipe,
  getRecipeDetail,
  importRecipe,
} from "../services/recipe";
import { router, authedProcedure } from "../trpc";

const ImageRecord = type({
  url: "string.url",
});

// Support both unparsed and parsed ingredient formats for flexibility
const IngredientRecordUnparsed = type({
  index: "number",
  ingredient: "string", // Unparsed text like "2 cups flour"
});

const IngredientRecordParsed = type({
  index: "number",
  quantity: "string | null",
  unit: "string | null",
  name: "string",
});

// Accept either format - UI can send unparsed, API will parse
const IngredientRecord = type.or(
  IngredientRecordParsed,
  IngredientRecordUnparsed,
);

const InstructionRecord = type({
  index: "number",
  instruction: "string",
  "imageUrl?": "string | null",
});

const SourceTypeValidator = type(
  "'url' | 'image' | 'text' | 'ai' | 'manual' | 'user'",
);

export const RecipePostValidator = type({
  name: "string",
  ingredients: IngredientRecord.array().atLeastLength(1),
  instructions: InstructionRecord.array().atLeastLength(1),
  images: ImageRecord.array().atLeastLength(1),

  "sourceUrl?": "string",
  "sourceType?": SourceTypeValidator,
  "categories?": "string[]",
  "cuisines?": "string[]",

  "description?": "string",
  "prepTime?": "number", // minutes
  "cookTime?": "number", // minutes
  "totalTime?": "number", // minutes
  servings: "number > 0",
});

const UrlValidator = type({ url: "string.url" });

const MimeTypeValidator = type("'image/jpeg' | 'image/png' | 'image/webp'");

// Chat types for AI recipe generation
const ChatMessageValidator = type({
  role: "'user' | 'assistant'",
  content: "string",
});

const ConversationStateValidator = type({
  ingredients: "string[] | null",
  cuisinePreference: "string | null",
  willingToShop: "boolean | null",
  maxCookingTime: "string | null",
});

const ChatInputValidator = type({
  messages: ChatMessageValidator.array(),
  conversationState: ConversationStateValidator,
});

export const recipeRouter = router({
  // Parse recipe from URL using AI
  parseRecipeFromUrl: authedProcedure
    .input(UrlValidator)
    .query(async ({ ctx, input }) => {
      try {
        console.log(input.url);
        const result = await ctx.env.RECIPE_PARSER.parse({
          type: "url",
          data: input.url,
        });

        if (!result.success) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: result.error.message,
          });
        }

        return result;
      } catch (e) {
        console.log(e, "ERROR");
      }

      throw new Error();
    }),

  // Parse recipe from text using AI
  parseRecipeFromText: authedProcedure
    .input(type({ text: "string" }))
    .query(async ({ ctx, input }) => {
      const result = await ctx.env.RECIPE_PARSER.parse({
        type: "text",
        data: input.text,
      });

      if (!result.success) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: result.error.message,
        });
      }

      return result;
    }),

  // Parse recipe from image using AI (mutation due to large payload)
  parseRecipeFromImage: authedProcedure
    .input(
      type({
        imageBase64: "string",
        mimeType: MimeTypeValidator,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.env.RECIPE_PARSER.parse({
        type: "image",
        data: input.imageBase64,
        mimeType: input.mimeType,
      });

      if (!result.success) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: result.error.message,
        });
      }

      return result;
    }),

  // Generate recipe via AI chat conversation
  generateRecipeChat: authedProcedure
    .input(ChatInputValidator)
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.env.RECIPE_PARSER.chat({
        messages: input.messages,
        conversationState: input.conversationState,
      });

      console.log({ result });

      if (result.type === "error") {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: result.error.message,
        });
      }

      return result;
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

      // Validate tags
      await validateTags(ctx.db, input.categories, input.cuisines);

      try {
        // Create the recipe
        const recipe = await createRecipe(ctx.db, ctx.user.id, input);

        // Create activity event for the import
        const activityEventResult = await ctx.db
          .insert(activityEvents)
          .values({
            userId: ctx.user.id,
            type: "recipe_import",
            recipeId: recipe.id,
            createdAt: new Date(),
          })
          .returning();

        const activityEvent = activityEventResult[0];

        // Propagate to followers (fire and forget - don't block the response)
        if (activityEvent) {
          propagateActivityToFollowers(
            ctx.db,
            ctx.env,
            activityEvent.id,
            ctx.user.id,
          ).catch((err) => {
            console.error("Error propagating activity to followers:", err);
          });
        }

        return recipe;
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
        tagIds: "number[]?",
        maxTotalTime: "number?", // in minutes
      }),
    )
    .query(async ({ ctx, input }) => {
      const { limit, cursor, search, tagIds, maxTotalTime } = input;

      try {
        // If filtering by tags, first get the recipe IDs that have any of the selected tags
        let recipeIdsWithTags: number[] | undefined;
        if (tagIds && tagIds.length > 0) {
          const recipesWithTags = await ctx.db
            .selectDistinct({ recipeId: recipeTags.recipeId })
            .from(recipeTags)
            .where(inArray(recipeTags.tagId, tagIds));
          recipeIdsWithTags = recipesWithTags.map((r) => r.recipeId);

          // If no recipes match the tags, return empty result
          if (recipeIdsWithTags.length === 0) {
            return { items: [], nextCursor: undefined };
          }
        }

        // Query recipes owned by the current user (ownerId = currentUser)
        const userRecipesList = await ctx.db
          .select({
            recipe: recipes,
            firstImage: min(recipeImages.url),
            uploader: {
              id: user.id,
              name: user.name,
              email: user.email,
              image: user.image,
            },
          })
          .from(recipes)
          .innerJoin(user, eq(recipes.ownerId, user.id))
          .leftJoin(recipeImages, eq(recipes.id, recipeImages.recipeId))
          .where(
            and(
              eq(recipes.ownerId, ctx.user.id),
              cursor ? lt(recipes.createdAt, new Date(cursor)) : undefined,
              search ? ilike(recipes.name, `%${search}%`) : undefined,
              recipeIdsWithTags
                ? inArray(recipes.id, recipeIdsWithTags)
                : undefined,
            ),
          )
          .groupBy(recipes.id, user.id, user.name, user.email, user.image)
          .orderBy(desc(recipes.createdAt))
          .limit(limit + 1);

        // Get recipe IDs to fetch tags
        const recipeIds = userRecipesList.map((item) => item.recipe.id);

        const tagsData =
          recipeIds.length > 0
            ? await ctx.db
                .select({
                  recipeId: recipeTags.recipeId,
                  tag: tags,
                })
                .from(recipeTags)
                .innerJoin(tags, eq(recipeTags.tagId, tags.id))
                .where(inArray(recipeTags.recipeId, recipeIds))
            : [];

        // Group tags by recipe
        const tagsByRecipe = tagsData.reduce(
          (acc, item) => {
            if (!acc[item.recipeId]) {
              acc[item.recipeId] = [];
            }
            if (item.tag) {
              acc[item.recipeId]!.push(item.tag);
            }
            return acc;
          },
          {} as Record<number, (typeof tags.$inferSelect)[]>,
        );

        let items = userRecipesList.map((item) => ({
          ...item.recipe,
          coverImage: item.firstImage,
          owner: item.uploader,
          tags: tagsByRecipe[item.recipe.id] || [],
        }));

        // Filter by maxTotalTime if specified
        if (maxTotalTime !== undefined) {
          items = items.filter((item) => {
            if (!item.totalTime) return false;
            return item.totalTime <= maxTotalTime;
          });
        }

        let nextCursor: number | undefined = undefined;
        if (items.length > limit) {
          const nextItem = items.pop();
          nextCursor = nextItem?.createdAt.getTime();
        }

        return {
          items,
          nextCursor,
        };
      } catch (err) {
        throw err;
      }
    }),

  // Get recipes uploaded by a specific user
  getUserRecipesById: authedProcedure
    .input(
      type({
        userId: "string",
        limit: "number = 20",
        cursor: "number?",
        search: "string?",
      }),
    )
    .query(async ({ ctx, input }) => {
      const { userId, limit, cursor, search } = input;

      try {
        const userRecipesList = await ctx.db
          .select({
            recipe: recipes,
            firstImage: min(recipeImages.url),
            uploader: {
              id: user.id,
              name: user.name,
              email: user.email,
              image: user.image,
            },
          })
          .from(recipes)
          .innerJoin(user, eq(recipes.ownerId, user.id))
          .leftJoin(recipeImages, eq(recipes.id, recipeImages.recipeId))
          .where(
            and(
              eq(recipes.ownerId, userId),
              cursor ? lt(recipes.createdAt, new Date(cursor)) : undefined,
              search ? ilike(recipes.name, `%${search}%`) : undefined,
            ),
          )
          .groupBy(recipes.id, user.id, user.name, user.email, user.image)
          .orderBy(desc(recipes.createdAt))
          .limit(limit + 1);

        // Get recipe IDs to fetch tags
        const recipeIds = userRecipesList.map((item) => item.recipe.id);

        const tagsData =
          recipeIds.length > 0
            ? await ctx.db
                .select({
                  recipeId: recipeTags.recipeId,
                  tag: tags,
                })
                .from(recipeTags)
                .innerJoin(tags, eq(recipeTags.tagId, tags.id))
                .where(inArray(recipeTags.recipeId, recipeIds))
            : [];

        // Group tags by recipe
        const tagsByRecipe = tagsData.reduce(
          (acc, item) => {
            if (!acc[item.recipeId]) {
              acc[item.recipeId] = [];
            }
            if (item.tag) {
              acc[item.recipeId]!.push(item.tag);
            }
            return acc;
          },
          {} as Record<number, (typeof tags.$inferSelect)[]>,
        );

        const items = userRecipesList.map((item) => ({
          ...item.recipe,
          coverImage: item.firstImage,
          owner: item.uploader,
          tags: tagsByRecipe[item.recipe.id] || [],
        }));

        let nextCursor: number | undefined = undefined;
        if (items.length > limit) {
          const nextItem = items.pop();
          nextCursor = nextItem?.createdAt.getTime();
        }

        return {
          items,
          nextCursor,
        };
      } catch (err) {
        throw err;
      }
    }),

  getRecipeDetail: authedProcedure
    .input(
      type({
        recipeId: "number",
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        return await getRecipeDetail(ctx.db, input.recipeId, ctx.user.id);
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        console.error("Error fetching recipe detail:", err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch recipe detail",
        });
      }
    }),

  importRecipe: authedProcedure
    .input(
      type({
        recipeId: "number",
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Import the recipe (creates a copy for the current user)
        const newRecipe = await importRecipe(
          ctx.db,
          ctx.user.id,
          input.recipeId,
        );

        // Create activity event for the import
        const [activityEvent] = await ctx.db
          .insert(activityEvents)
          .values({
            userId: ctx.user.id,
            type: "recipe_import",
            recipeId: newRecipe.id,
            createdAt: new Date(),
          })
          .returning();

        // Propagate to followers (don't await to avoid blocking)
        if (activityEvent) {
          propagateActivityToFollowers(
            ctx.db,
            ctx.env,
            activityEvent.id,
            ctx.user.id,
          ).catch((err) =>
            console.error("Failed to propagate activity to followers:", err),
          );
        }

        return newRecipe;
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        console.error("Error importing recipe:", err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to import recipe",
        });
      }
    }),

  getUserPreferences: authedProcedure.query(async ({ ctx }) => {
    try {
      // Analyze user's saved recipes to find most frequent tags
      const userTagPreferences = await ctx.db
        .select({
          tag: tags,
          count: count(recipeTags.id),
        })
        .from(recipeCollections)
        .innerJoin(
          collections,
          eq(recipeCollections.collectionId, collections.id),
        )
        .innerJoin(
          recipeTags,
          eq(recipeCollections.recipeId, recipeTags.recipeId),
        )
        .innerJoin(tags, eq(recipeTags.tagId, tags.id))
        .where(eq(collections.userId, ctx.user.id))
        .groupBy(tags.id)
        .orderBy(desc(count(recipeTags.id)))
        .limit(15);

      return userTagPreferences.map((item) => ({
        ...item.tag,
        count: item.count,
      }));
    } catch (err) {
      console.error("Error fetching user preferences:", err);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch user preferences",
      });
    }
  }),

  getAllTags: authedProcedure
    .input(
      type({
        "type?": "string",
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        const allTags = await ctx.db
          .select({
            id: tags.id,
            name: tags.name,
            type: tags.type,
          })
          .from(tags)
          .where(input.type ? eq(tags.type, input.type) : undefined)
          .orderBy(tags.name);

        return allTags;
      } catch (err) {
        console.error("Error fetching all tags:", err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch tags",
        });
      }
    }),

  /**
   * Parse ingredient text into structured format for preview
   * Used by the UI to show users how their ingredients will be parsed before saving
   */
  parseIngredients: authedProcedure
    .input(
      type({
        ingredients: "string[]",
      }),
    )
    .query(({ input }) => {
      return parseIngredients(input.ingredients);
    }),

  getPopularThisWeek: authedProcedure
    .input(
      type({
        limit: "number = 10",
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        return await queryPopularRecipesThisWeek(
          ctx.db,
          ctx.user.id,
          input.limit,
        );
      } catch (err) {
        console.error("Error fetching popular recipes:", err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch popular recipes",
        });
      }
    }),
});
