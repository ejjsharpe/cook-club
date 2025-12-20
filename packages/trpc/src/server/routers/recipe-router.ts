import {
  recipeIngredients,
  recipeInstructions,
  recipeImages,
  recipes,
  recipeCollections,
  collections,
  userLikes,
  user,
  tags,
  recipeTags,
  follows,
  shoppingLists,
  shoppingListRecipes,
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

export const RecipePostValidator = type({
  name: "string",
  ingredients: IngredientRecord.array().atLeastLength(1),
  instructions: InstructionRecord.array().atLeastLength(1),
  images: ImageRecord.array().atLeastLength(1),

  "sourceUrl?": "string",
  "categories?": "string[]",
  "cuisines?": "string[]",

  "description?": "string",
  "prepTime?": "string",
  "cookTime?": "string",
  "totalTime?": "string",
  servings: "number > 0",
});

const UrlValidator = type({ url: "string.url" });

const MimeTypeValidator = type("'image/jpeg' | 'image/png' | 'image/webp'");

export const recipeRouter = router({
  // Parse recipe from URL using AI
  parseRecipeFromUrl: authedProcedure
    .input(UrlValidator)
    .query(async ({ ctx, input }) => {
      try {
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
  postRecipe: authedProcedure
    .input(RecipePostValidator)
    .mutation(async ({ input, ctx }) => {
      if (input instanceof type.errors) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: input.summary,
        });
      }

      // Parallelize validation queries
      const [existingCategoryTags, existingCuisineTags] = await Promise.all([
        input.categories && input.categories.length > 0
          ? ctx.db
              .select({ name: tags.name })
              .from(tags)
              .where(
                and(
                  eq(tags.type, "category"),
                  inArray(tags.name, input.categories),
                ),
              )
          : Promise.resolve([]),
        input.cuisines && input.cuisines.length > 0
          ? ctx.db
              .select({ name: tags.name })
              .from(tags)
              .where(
                and(
                  eq(tags.type, "cuisine"),
                  inArray(tags.name, input.cuisines),
                ),
              )
          : Promise.resolve([]),
      ]);

      // Validate categories
      if (input.categories && input.categories.length > 0) {
        const existingCategoryNames = existingCategoryTags.map(
          (tag) => tag.name,
        );
        const invalidCategories = input.categories.filter(
          (cat) => !existingCategoryNames.includes(cat),
        );

        if (invalidCategories.length > 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Invalid categories: ${invalidCategories.join(", ")}.`,
          });
        }
      }

      // Validate cuisines
      if (input.cuisines && input.cuisines.length > 0) {
        const existingCuisineNames = existingCuisineTags.map((tag) => tag.name);
        const invalidCuisines = input.cuisines.filter(
          (cuisine) => !existingCuisineNames.includes(cuisine),
        );

        if (invalidCuisines.length > 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Invalid cuisines: ${invalidCuisines.join(", ")}.`,
          });
        }
      }

      try {
        // Use transaction to ensure all inserts succeed or all fail
        const result = await ctx.db.transaction(async (tx) => {
          // Insert recipe
          const recipe = await tx
            .insert(recipes)
            .values({
              ...input,
              createdAt: new Date(),
              updatedAt: new Date(),
              uploadedBy: ctx.user.id,
            })
            .returning()
            .then((rows) => rows[0]);

          if (!recipe) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to create recipe",
            });
          }

          // Parse ingredients if needed (support both formats)
          const parsedIngredients = input.ingredients.map((ing) => {
            // Check if ingredient is in unparsed format (has 'ingredient' field)
            if ("ingredient" in ing) {
              // Parse the ingredient text
              const parsed = parseIngredient(ing.ingredient);
              return {
                index: ing.index,
                quantity: parsed.quantity?.toString() || null,
                unit: normalizeUnit(parsed.unit),
                name: parsed.name,
              };
            }
            // Already parsed - just normalize the unit
            return {
              index: ing.index,
              quantity: ing.quantity || null,
              unit: normalizeUnit(ing.unit || null),
              name: ing.name,
            };
          });

          // Insert ingredients
          const insertedIngredients = await tx
            .insert(recipeIngredients)
            .values(
              parsedIngredients.map((ingredient) => ({
                ...ingredient,
                recipeId: recipe.id,
              })),
            )
            .returning({
              index: recipeIngredients.index,
              quantity: recipeIngredients.quantity,
              unit: recipeIngredients.unit,
              name: recipeIngredients.name,
            });

          // Insert instructions
          const insertedInstructions = await tx
            .insert(recipeInstructions)
            .values(
              input.instructions.map((instruction) => ({
                index: instruction.index,
                instruction: instruction.instruction,
                imageUrl: instruction.imageUrl || null,
                recipeId: recipe.id,
              })),
            )
            .returning({
              index: recipeInstructions.index,
              instruction: recipeInstructions.instruction,
              imageUrl: recipeInstructions.imageUrl,
            });

          // Insert images (required)
          const images = await tx
            .insert(recipeImages)
            .values(
              input.images.map((image: any) => ({
                recipeId: recipe.id,
                url: image.url,
              })),
            )
            .returning({
              url: recipeImages.url,
            });

          return {
            ...recipe,
            ingredients: insertedIngredients,
            instructions: insertedInstructions,
            images,
          };
        });

        return result;
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
      }),
    )
    .query(async ({ ctx, input }) => {
      const { limit, cursor, search } = input;

      try {
        const userRecipesList = await ctx.db
          .select({
            recipe: recipes,
            recipeCollection: recipeCollections,
            firstImage: min(recipeImages.url),
            uploader: {
              id: user.id,
              name: user.name,
              email: user.email,
              image: user.image,
            },
          })
          .from(recipeCollections)
          .innerJoin(
            collections,
            eq(recipeCollections.collectionId, collections.id),
          )
          .innerJoin(recipes, eq(recipeCollections.recipeId, recipes.id))
          .innerJoin(user, eq(recipes.uploadedBy, user.id))
          .leftJoin(recipeImages, eq(recipes.id, recipeImages.recipeId))
          .where(
            and(
              eq(collections.userId, ctx.user.id),
              cursor
                ? lt(recipeCollections.createdAt, new Date(cursor))
                : undefined,
              search ? ilike(recipes.name, `%${search}%`) : undefined,
            ),
          )
          .groupBy(
            recipeCollections.id,
            recipes.id,
            user.id,
            user.name,
            user.email,
            user.image,
          )
          .orderBy(desc(recipeCollections.createdAt))
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
          addedAt: item.recipeCollection.createdAt,
          coverImage: item.firstImage,
          uploadedBy: item.uploader,
          tags: tagsByRecipe[item.recipe.id] || [],
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
      const { recipeId } = input;

      try {
        // Single query with all aggregations and checks using Drizzle helpers
        const recipeData = await ctx.db
          .select({
            recipe: recipes,
            uploader: {
              id: user.id,
              name: user.name,
              email: user.email,
              image: user.image,
            },
            // Scalar subquery: count of likes for this recipe
            // Note: Must use CAST to INTEGER for Neon database to return number type
            likeCount: sql<number>`(
              SELECT CAST(COUNT(*) AS INTEGER)
              FROM ${userLikes}
              WHERE ${userLikes.recipeId} = ${recipes.id}
            )`,
            // Scalar subquery: count of saves for this recipe
            saveCount: sql<number>`(
              SELECT CAST(COUNT(DISTINCT ${recipeCollections.id}) AS INTEGER)
              FROM ${recipeCollections}
              WHERE ${recipeCollections.recipeId} = ${recipes.id}
            )`,
            // Scalar subquery: total recipes by this uploader
            uploaderRecipeCount: sql<number>`(
              SELECT CAST(COUNT(*) AS INTEGER)
              FROM ${recipes} r
              WHERE r.uploaded_by = ${recipes.uploadedBy}
            )`,
            // EXISTS: check if current user has liked this recipe
            isLiked: sql<boolean>`EXISTS(
              SELECT 1 FROM ${userLikes}
              WHERE ${userLikes.recipeId} = ${recipes.id}
              AND ${userLikes.userId} = ${ctx.user.id}
            )`,
            // EXISTS: check if recipe is in current user's shopping list
            isInShoppingList: sql<boolean>`EXISTS(
              SELECT 1 FROM ${shoppingListRecipes}
              INNER JOIN ${shoppingLists} ON ${shoppingListRecipes.shoppingListId} = ${shoppingLists.id}
              WHERE ${shoppingListRecipes.recipeId} = ${recipes.id}
              AND ${shoppingLists.userId} = ${ctx.user.id}
            )`,
          })
          .from(recipes)
          .innerJoin(user, eq(recipes.uploadedBy, user.id))
          .where(eq(recipes.id, recipeId))
          .then((rows) => rows[0]);

        if (!recipeData) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Recipe not found",
          });
        }

        // Get collection IDs for this recipe and current user
        const userRecipeCollections = await ctx.db
          .select({ collectionId: recipeCollections.collectionId })
          .from(recipeCollections)
          .innerJoin(
            collections,
            eq(recipeCollections.collectionId, collections.id),
          )
          .where(
            and(
              eq(recipeCollections.recipeId, recipeId),
              eq(collections.userId, ctx.user.id),
            ),
          );

        const collectionIds = userRecipeCollections.map(
          (rc) => rc.collectionId,
        );

        // Parallelize remaining queries
        const [images, ingredients, instructions] = await Promise.all([
          ctx.db
            .select({ id: recipeImages.id, url: recipeImages.url })
            .from(recipeImages)
            .where(eq(recipeImages.recipeId, recipeId)),

          ctx.db
            .select({
              index: recipeIngredients.index,
              quantity: recipeIngredients.quantity,
              unit: recipeIngredients.unit,
              name: recipeIngredients.name,
            })
            .from(recipeIngredients)
            .where(eq(recipeIngredients.recipeId, recipeId))
            .orderBy(recipeIngredients.index),

          ctx.db
            .select({
              index: recipeInstructions.index,
              instruction: recipeInstructions.instruction,
              imageUrl: recipeInstructions.imageUrl,
            })
            .from(recipeInstructions)
            .where(eq(recipeInstructions.recipeId, recipeId))
            .orderBy(recipeInstructions.index),
        ]);

        return {
          ...recipeData.recipe,
          uploadedBy: recipeData.uploader,
          images,
          ingredients,
          instructions,
          userRecipesCount: recipeData.uploaderRecipeCount,
          collectionIds,
          isLiked: recipeData.isLiked,
          isInShoppingList: recipeData.isInShoppingList,
          likeCount: recipeData.likeCount,
          saveCount: recipeData.saveCount,
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

  likeRecipe: authedProcedure
    .input(
      type({
        recipeId: "number",
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { recipeId } = input;

      try {
        // Check if recipe exists
        const recipe = await ctx.db
          .select({ id: recipes.id })
          .from(recipes)
          .where(eq(recipes.id, recipeId))
          .then((rows) => rows[0]);

        if (!recipe) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Recipe not found",
          });
        }

        // Check if already liked
        const existingLike = await ctx.db
          .select()
          .from(userLikes)
          .where(
            and(
              eq(userLikes.userId, ctx.user.id),
              eq(userLikes.recipeId, recipeId),
            ),
          )
          .then((rows) => rows[0]);

        if (existingLike) {
          // Unlike - remove the like
          await ctx.db
            .delete(userLikes)
            .where(
              and(
                eq(userLikes.userId, ctx.user.id),
                eq(userLikes.recipeId, recipeId),
              ),
            );
          return { success: true, liked: false };
        }

        // Like the recipe
        await ctx.db.insert(userLikes).values({
          userId: ctx.user.id,
          recipeId,
          createdAt: new Date(),
        });

        return { success: true, liked: true };
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        console.error("Error liking recipe:", err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to like recipe",
        });
      }
    }),

  getRecommendedRecipes: authedProcedure
    .input(
      type({
        limit: "number = 20",
        "cursor?": {
          id: "number",
          score: "number",
        },
      }),
    )
    .query(async ({ ctx, input }) => {
      const { limit, cursor } = input;

      try {
        const relevanceScoreExpr = sql<number>`
          ${countDistinct(userLikes.id)} +
          ${countDistinct(recipeCollections.id)} +
          CASE WHEN ${follows.id} IS NOT NULL THEN 10 ELSE 0 END
        `;

        const recommendedRecipesList = await ctx.db
          .select({
            recipe: recipes,
            uploader: {
              id: user.id,
              name: user.name,
              email: user.email,
              image: user.image,
            },
            firstImage: min(recipeImages.url),
            saveCount: countDistinct(recipeCollections.id),
            likeCount: countDistinct(userLikes.id),
            relevanceScore: relevanceScoreExpr,
            isFollowing: sql<boolean>`${follows.id} IS NOT NULL`,
            isLiked: sql<boolean>`EXISTS(
              SELECT 1 FROM ${userLikes}
              WHERE ${userLikes.recipeId} = ${recipes.id}
              AND ${userLikes.userId} = ${ctx.user.id}
            )`,
            recipeTags: sql<number[]>`COALESCE(
              array_agg(DISTINCT ${recipeTags.tagId}) FILTER (WHERE ${recipeTags.tagId} IS NOT NULL),
              ARRAY[]::integer[]
            )`,
          })
          .from(recipes)
          .innerJoin(user, eq(recipes.uploadedBy, user.id))
          .leftJoin(recipeImages, eq(recipes.id, recipeImages.recipeId))
          .leftJoin(
            recipeCollections,
            eq(recipes.id, recipeCollections.recipeId),
          )
          .leftJoin(userLikes, eq(recipes.id, userLikes.recipeId))
          .leftJoin(recipeTags, eq(recipes.id, recipeTags.recipeId))
          .leftJoin(
            follows,
            and(
              eq(follows.followingId, recipes.uploadedBy),
              eq(follows.followerId, ctx.user.id),
            ),
          )
          .groupBy(
            recipes.id,
            user.id,
            user.name,
            user.email,
            user.image,
            follows.id,
          )
          .having(
            // Composite cursor: items with lower score, OR same score but lower ID
            cursor
              ? sql`(${relevanceScoreExpr} < ${cursor.score} OR (${relevanceScoreExpr} = ${cursor.score} AND ${recipes.id} < ${cursor.id}))`
              : undefined,
          )
          .orderBy(
            // Order by relevance score, then by recipe ID for stable cursor pagination
            desc(relevanceScoreExpr),
            desc(recipes.id),
          )
          .limit(limit + 1);

        // Get tags and collection IDs for each recipe
        const recipeIds = recommendedRecipesList.map((item) => item.recipe.id);

        const [tagsData, collectionsData] = await Promise.all([
          recipeIds.length > 0
            ? ctx.db
                .select({
                  recipeId: recipeTags.recipeId,
                  tag: tags,
                })
                .from(recipeTags)
                .innerJoin(tags, eq(recipeTags.tagId, tags.id))
                .where(inArray(recipeTags.recipeId, recipeIds))
            : [],
          recipeIds.length > 0
            ? ctx.db
                .select({
                  recipeId: recipeCollections.recipeId,
                  collectionId: recipeCollections.collectionId,
                })
                .from(recipeCollections)
                .innerJoin(
                  collections,
                  eq(recipeCollections.collectionId, collections.id),
                )
                .where(
                  and(
                    inArray(recipeCollections.recipeId, recipeIds),
                    eq(collections.userId, ctx.user.id),
                  ),
                )
            : [],
        ]);

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

        // Group collection IDs by recipe
        const collectionsByRecipe = collectionsData.reduce(
          (acc, item) => {
            if (!acc[item.recipeId]) {
              acc[item.recipeId] = [];
            }
            acc[item.recipeId]!.push(item.collectionId);
            return acc;
          },
          {} as Record<number, number[]>,
        );

        // Determine if there are more results
        const hasMore = recommendedRecipesList.length > limit;
        const resultsToReturn = hasMore
          ? recommendedRecipesList.slice(0, limit)
          : recommendedRecipesList;

        const items = resultsToReturn.map((item) => ({
          ...item.recipe,
          uploadedBy: item.uploader,
          coverImage: item.firstImage,
          saveCount: item.saveCount,
          likeCount: item.likeCount,
          collectionIds: collectionsByRecipe[item.recipe.id] || [],
          isLiked: item.isLiked,
          isFollowing: item.isFollowing,
          tags: tagsByRecipe[item.recipe.id] || [],
          relevanceScore: Number(item.relevanceScore),
        }));

        // Composite cursor includes both score and ID for stable pagination
        const lastItem = resultsToReturn[resultsToReturn.length - 1];
        const nextCursor =
          hasMore && lastItem
            ? { id: lastItem.recipe.id, score: Number(lastItem.relevanceScore) }
            : undefined;

        return {
          items,
          nextCursor,
        };
      } catch (err) {
        console.error("Error fetching recommended recipes:", err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch recommended recipes",
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

  searchAllRecipes: authedProcedure
    .input(
      type({
        limit: "number = 20",
        "cursor?": {
          id: "number",
          score: "number",
        },
        "search?": "string",
        "tagIds?": "number[]",
        "maxTotalTime?": "string",
      }),
    )
    .query(async ({ ctx, input }) => {
      const { limit, cursor, search, tagIds, maxTotalTime } = input;

      try {
        // Deterministic relevance score (no RANDOM jitter for stable pagination)
        const relevanceScoreExpr = sql<number>`
          ${countDistinct(userLikes.id)} +
          ${countDistinct(recipeCollections.id)} +
          CASE WHEN ${follows.id} IS NOT NULL THEN 10 ELSE 0 END
        `;

        const searchResults = await ctx.db
          .select({
            recipe: recipes,
            uploader: {
              id: user.id,
              name: user.name,
              email: user.email,
              image: user.image,
            },
            firstImage: min(recipeImages.url),
            saveCount: countDistinct(recipeCollections.id),
            likeCount: countDistinct(userLikes.id),
            relevanceScore: relevanceScoreExpr,
            isFollowing: sql<boolean>`${follows.id} IS NOT NULL`,
            isLiked: sql<boolean>`EXISTS(
              SELECT 1 FROM ${userLikes}
              WHERE ${userLikes.recipeId} = ${recipes.id}
              AND ${userLikes.userId} = ${ctx.user.id}
            )`,
            recipeTags: sql<number[]>`COALESCE(
              array_agg(DISTINCT ${recipeTags.tagId}) FILTER (WHERE ${recipeTags.tagId} IS NOT NULL),
              ARRAY[]::integer[]
            )`,
          })
          .from(recipes)
          .innerJoin(user, eq(recipes.uploadedBy, user.id))
          .leftJoin(recipeImages, eq(recipes.id, recipeImages.recipeId))
          .leftJoin(
            recipeCollections,
            eq(recipes.id, recipeCollections.recipeId),
          )
          .leftJoin(userLikes, eq(recipes.id, userLikes.recipeId))
          .leftJoin(recipeTags, eq(recipes.id, recipeTags.recipeId))
          .leftJoin(
            follows,
            and(
              eq(follows.followingId, recipes.uploadedBy),
              eq(follows.followerId, ctx.user.id),
            ),
          )
          .where(
            and(
              // Search filter - case-insensitive on name
              search ? ilike(recipes.name, `%${search}%`) : undefined,
              // Total time filter
              maxTotalTime
                ? like(recipes.totalTime, `%${maxTotalTime}%`)
                : undefined,
            ),
          )
          .groupBy(
            recipes.id,
            user.id,
            user.name,
            user.email,
            user.image,
            follows.id,
          )
          .having(
            and(
              // Tag filter - use HAVING for post-aggregation filtering
              tagIds && tagIds.length > 0
                ? sql`COUNT(DISTINCT CASE WHEN ${inArray(recipeTags.tagId, tagIds)} THEN ${recipeTags.tagId} END) > 0`
                : undefined,
              // Composite cursor: items with lower score, OR same score but lower ID
              cursor
                ? sql`(${relevanceScoreExpr} < ${cursor.score} OR (${relevanceScoreExpr} = ${cursor.score} AND ${recipes.id} < ${cursor.id}))`
                : undefined,
            ),
          )
          .orderBy(
            // Order by relevance score, then by recipe ID for stable cursor pagination
            desc(relevanceScoreExpr),
            desc(recipes.id),
          )
          .limit(limit + 1);

        // Get tags and collection IDs for each recipe
        const recipeIds = searchResults.map((item) => item.recipe.id);

        const [tagsData, collectionsData] = await Promise.all([
          recipeIds.length > 0
            ? ctx.db
                .select({
                  recipeId: recipeTags.recipeId,
                  tag: tags,
                })
                .from(recipeTags)
                .innerJoin(tags, eq(recipeTags.tagId, tags.id))
                .where(inArray(recipeTags.recipeId, recipeIds))
            : [],
          recipeIds.length > 0
            ? ctx.db
                .select({
                  recipeId: recipeCollections.recipeId,
                  collectionId: recipeCollections.collectionId,
                })
                .from(recipeCollections)
                .innerJoin(
                  collections,
                  eq(recipeCollections.collectionId, collections.id),
                )
                .where(
                  and(
                    inArray(recipeCollections.recipeId, recipeIds),
                    eq(collections.userId, ctx.user.id),
                  ),
                )
            : [],
        ]);

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

        // Group collection IDs by recipe
        const collectionsByRecipe = collectionsData.reduce(
          (acc, item) => {
            if (!acc[item.recipeId]) {
              acc[item.recipeId] = [];
            }
            acc[item.recipeId]!.push(item.collectionId);
            return acc;
          },
          {} as Record<number, number[]>,
        );

        // Determine if there are more results
        const hasMore = searchResults.length > limit;
        const resultsToReturn = hasMore
          ? searchResults.slice(0, limit)
          : searchResults;

        const items = resultsToReturn.map((item) => ({
          ...item.recipe,
          uploadedBy: item.uploader,
          coverImage: item.firstImage,
          saveCount: item.saveCount,
          likeCount: item.likeCount,
          collectionIds: collectionsByRecipe[item.recipe.id] || [],
          isLiked: item.isLiked,
          isFollowing: item.isFollowing,
          tags: tagsByRecipe[item.recipe.id] || [],
          relevanceScore: Number(item.relevanceScore),
        }));

        // Composite cursor includes both score and ID for stable pagination
        const lastItem = resultsToReturn[resultsToReturn.length - 1];
        const nextCursor =
          hasMore && lastItem
            ? { id: lastItem.recipe.id, score: Number(lastItem.relevanceScore) }
            : undefined;

        return {
          items,
          nextCursor,
        };
      } catch (err) {
        console.error("Error searching recipes:", err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to search recipes",
        });
      }
    }),
});
