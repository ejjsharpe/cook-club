import { collections, recipeCollections } from "@repo/db/schemas";
import {
  toggleRecipeInCollection as toggleRecipeInCollectionService,
  getUserCollectionsWithMetadata as getUserCollectionsWithMetadataService,
  getCollectionDetail as getCollectionDetailService,
  deleteCollection as deleteCollectionService,
  getOrCreateDefaultCollections,
} from "@repo/db/services";
import { TRPCError } from "@trpc/server";
import { type } from "arktype";
import { eq, sql } from "drizzle-orm";

import { router, authedProcedure } from "../trpc";
import { mapServiceError } from "../utils";

export const collectionRouter = router({
  getUserCollections: authedProcedure
    .input(
      type({
        "recipeId?": "number",
        "includeMetadata?": "boolean",
        "search?": "string",
      }),
    )
    .query(async ({ ctx, input }) => {
      const { recipeId, includeMetadata, search } = input;

      // Ensure default collections exist (lazy creation on first access)
      await getOrCreateDefaultCollections(ctx.db, ctx.user.id);

      // If includeMetadata is requested AND no recipeId, return with metadata
      if (includeMetadata && recipeId === undefined) {
        return await getUserCollectionsWithMetadataService(ctx.db, {
          userId: ctx.user.id,
          ...(search && { search }),
        });
      }

      try {
        // Get all user's collections (default collections first: want_to_cook, then cooked, then custom)
        const userCollections = await ctx.db
          .select({
            id: collections.id,
            name: collections.name,
            defaultType: collections.defaultType,
            createdAt: collections.createdAt,
          })
          .from(collections)
          .where(eq(collections.userId, ctx.user.id))
          .orderBy(
            sql`CASE
              WHEN ${collections.defaultType} = 'want_to_cook' THEN 0
              WHEN ${collections.defaultType} = 'cooked' THEN 1
              ELSE 2
            END`,
            collections.createdAt,
          );

        // If recipeId provided, also check which collections contain this recipe
        if (recipeId !== undefined) {
          const recipeInCollections = await ctx.db
            .select({ collectionId: recipeCollections.collectionId })
            .from(recipeCollections)
            .where(eq(recipeCollections.recipeId, recipeId));

          const collectionIdsWithRecipe = new Set(
            recipeInCollections.map((rc) => rc.collectionId),
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
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { name } = input;

      try {
        // Prevent users from creating collections with reserved default names
        const reservedNames = ["want to cook", "cooked"];
        if (reservedNames.includes(name.trim().toLowerCase())) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `The name "${name}" is reserved for default collections`,
          });
        }

        // Create the collection (all user-created collections are non-default)
        const [newCollection] = await ctx.db
          .insert(collections)
          .values({
            userId: ctx.user.id,
            name,
            defaultType: null,
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
        collectionId: "number",
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await toggleRecipeInCollectionService(ctx.db, {
          userId: ctx.user.id,
          recipeId: input.recipeId,
          collectionId: input.collectionId,
        });
      } catch (err) {
        console.error("Error toggling recipe in collection:", err);
        throw mapServiceError(err);
      }
    }),

  getCollectionDetail: authedProcedure
    .input(
      type({
        collectionId: "number",
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        return await getCollectionDetailService(ctx.db, {
          userId: ctx.user.id,
          collectionId: input.collectionId,
        });
      } catch (err) {
        console.error("Error fetching collection detail:", err);
        throw mapServiceError(err);
      }
    }),

  deleteCollection: authedProcedure
    .input(
      type({
        collectionId: "number",
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await deleteCollectionService(ctx.db, {
          userId: ctx.user.id,
          collectionId: input.collectionId,
        });
      } catch (err) {
        console.error("Error deleting collection:", err);
        throw mapServiceError(err);
      }
    }),

  // Get collections for a specific user (with metadata)
  getUserCollectionsById: authedProcedure
    .input(
      type({
        userId: "string",
        "search?": "string",
      }),
    )
    .query(async ({ ctx, input }) => {
      const { userId, search } = input;

      try {
        return await getUserCollectionsWithMetadataService(ctx.db, {
          userId,
          ...(search && { search }),
        });
      } catch (err) {
        console.error("Error fetching user collections:", err);
        throw mapServiceError(err);
      }
    }),
});
