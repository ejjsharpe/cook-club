import { collections, recipeCollections } from "@repo/db/schemas";
import { TRPCError } from "@trpc/server";
import { type } from "arktype";
import { eq, desc } from "drizzle-orm";

import {
  toggleRecipeInCollection as toggleRecipeInCollectionService,
  searchPublicCollections as searchPublicCollectionsService,
  getUserCollectionsWithMetadata as getUserCollectionsWithMetadataService,
  getCollectionDetail as getCollectionDetailService,
  deleteCollection as deleteCollectionService,
} from "../services/collection";
import { router, authedProcedure } from "../trpc";

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

      // If includeMetadata is requested AND no recipeId, return with metadata
      if (includeMetadata && recipeId === undefined) {
        return await getUserCollectionsWithMetadataService(ctx.db, {
          userId: ctx.user.id,
          ...(search && { search }),
        });
      }

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
        // Prevent users from creating collections named "Saved Recipes" (reserved for default)
        if (name.trim().toLowerCase() === "saved recipes") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              'The name "Saved Recipes" is reserved for your default collection',
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
        if (err instanceof TRPCError) throw err;
        console.error("Error toggling recipe in collection:", err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to toggle recipe in collection",
        });
      }
    }),

  searchPublicCollections: authedProcedure
    .input(
      type({
        query: "string",
        "limit?": "number",
        "cursor?": "number",
      }),
    )
    .query(async ({ ctx, input }) => {
      const { query, limit = 20, cursor } = input;

      if (query.length < 2) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Search query must be at least 2 characters",
        });
      }

      try {
        return await searchPublicCollectionsService(ctx.db, {
          query,
          limit,
          ...(cursor !== undefined && { cursor }),
        });
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        console.error("Error searching collections:", err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to search collections",
        });
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
        if (err instanceof TRPCError) throw err;
        console.error("Error fetching collection detail:", err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch collection detail",
        });
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
        if (err instanceof TRPCError) throw err;
        console.error("Error deleting collection:", err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete collection",
        });
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
        if (err instanceof TRPCError) throw err;
        console.error("Error fetching user collections:", err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch user collections",
        });
      }
    }),
});
