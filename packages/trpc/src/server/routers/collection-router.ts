import { collections, recipeCollections, recipes } from "@repo/db/schemas";
import { TRPCError } from "@trpc/server";
import { type } from "arktype";
import { eq, and, desc } from "drizzle-orm";

import { router, authedProcedure } from "../trpc";

export const collectionRouter = router({
  getUserCollections: authedProcedure
    .input(
      type({
        "recipeId?": "number",
      })
    )
    .query(async ({ ctx, input }) => {
      const { recipeId } = input;

      try {
        // Get all user's collections (default collection first)
        const userCollections = await ctx.db
          .select({
            id: collections.id,
            name: collections.name,
            isDefault: collections.isDefault,
            createdAt: collections.createdAt,
          })
          .from(collections)
          .where(eq(collections.userId, ctx.user.id))
          .orderBy(desc(collections.isDefault), collections.createdAt);

        // If recipeId provided, also check which collections contain this recipe
        if (recipeId !== undefined) {
          const recipeInCollections = await ctx.db
            .select({ collectionId: recipeCollections.collectionId })
            .from(recipeCollections)
            .where(eq(recipeCollections.recipeId, recipeId));

          const collectionIdsWithRecipe = new Set(
            recipeInCollections.map((rc) => rc.collectionId)
          );

          return userCollections.map((collection) => ({
            ...collection,
            hasRecipe: collectionIdsWithRecipe.has(collection.id),
          }));
        }

        return userCollections.map((collection) => ({
          ...collection,
          hasRecipe: false,
        }));
      } catch (err) {
        console.error("Error fetching user collections:", err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch collections",
        });
      }
    }),

  createCollection: authedProcedure
    .input(
      type({
        name: "string",
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { name } = input;

      try {
        // Prevent users from creating collections named "Saved Recipes" (reserved for default)
        if (name.trim().toLowerCase() === "saved recipes") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: 'The name "Saved Recipes" is reserved for your default collection',
          });
        }

        // Check if user has any collections
        const existingCollections = await ctx.db
          .select({ id: collections.id })
          .from(collections)
          .where(eq(collections.userId, ctx.user.id));

        const isFirstCollection = existingCollections.length === 0;

        // Create the collection
        const [newCollection] = await ctx.db
          .insert(collections)
          .values({
            userId: ctx.user.id,
            name,
            isDefault: isFirstCollection,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        return newCollection;
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        console.error("Error creating collection:", err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create collection",
        });
      }
    }),

  toggleRecipeInCollection: authedProcedure
    .input(
      type({
        recipeId: "number",
        "collectionId?": "number",
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { recipeId } = input;
      let { collectionId } = input;

      try {
        // Verify recipe exists
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

        // If no collectionId provided, use default collection (or create one)
        if (!collectionId) {
          const existingDefaultCollection = await ctx.db
            .select({ id: collections.id })
            .from(collections)
            .where(
              and(eq(collections.userId, ctx.user.id), eq(collections.isDefault, true))
            )
            .then((rows) => rows[0]);

          if (existingDefaultCollection) {
            collectionId = existingDefaultCollection.id;
          } else {
            // Create default "Saved Recipes" collection
            const [newDefaultCollection] = await ctx.db
              .insert(collections)
              .values({
                userId: ctx.user.id,
                name: "Saved Recipes",
                isDefault: true,
                createdAt: new Date(),
                updatedAt: new Date(),
              })
              .returning();
            collectionId = newDefaultCollection!.id;
          }
        }

        // Verify collection exists and belongs to user
        const collection = await ctx.db
          .select({ id: collections.id, name: collections.name })
          .from(collections)
          .where(
            and(
              eq(collections.id, collectionId),
              eq(collections.userId, ctx.user.id)
            )
          )
          .then((rows) => rows[0]);

        if (!collection) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Collection not found",
          });
        }

        // Check if recipe is already in collection
        const existing = await ctx.db
          .select()
          .from(recipeCollections)
          .where(
            and(
              eq(recipeCollections.recipeId, recipeId),
              eq(recipeCollections.collectionId, collectionId)
            )
          )
          .then((rows) => rows[0]);

        if (existing) {
          // Remove from collection
          await ctx.db
            .delete(recipeCollections)
            .where(
              and(
                eq(recipeCollections.recipeId, recipeId),
                eq(recipeCollections.collectionId, collectionId)
              )
            );
        } else {
          // Add to collection
          await ctx.db.insert(recipeCollections).values({
            recipeId,
            collectionId,
            createdAt: new Date(),
          });
        }

        // Get all collections this recipe is in
        const allRecipeCollections = await ctx.db
          .select({ collectionId: recipeCollections.collectionId })
          .from(recipeCollections)
          .where(eq(recipeCollections.recipeId, recipeId));

        const collectionIds = allRecipeCollections.map((rc) => rc.collectionId);

        // Get all user's collections with hasRecipe flag
        const userCollections = await ctx.db
          .select({
            id: collections.id,
            name: collections.name,
            isDefault: collections.isDefault,
          })
          .from(collections)
          .where(eq(collections.userId, ctx.user.id))
          .orderBy(desc(collections.isDefault), collections.createdAt);

        const collectionsWithStatus = userCollections.map((col) => ({
          ...col,
          hasRecipe: collectionIds.includes(col.id),
        }));

        return {
          success: true,
          inCollection: collectionIds.includes(collectionId),
          collectionIds,
          collections: collectionsWithStatus,
        };
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        console.error("Error toggling recipe in collection:", err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to toggle recipe in collection",
        });
      }
    }),
});
