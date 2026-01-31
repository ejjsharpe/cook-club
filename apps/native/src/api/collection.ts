import type { Outputs } from "@repo/trpc/client";
import { useTRPC } from "@repo/trpc/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { inferOutput } from "@trpc/tanstack-react-query";
import { Alert } from "react-native";

import {
  updateRecipeCollections,
  toggleCollectionInArray,
} from "./utils/cache-helpers";

// API Response Types
// Use getUserCollectionsById which always returns metadata
export type Collection =
  Outputs["collection"]["getUserCollectionsById"][number];
export type CollectionDetail = Outputs["collection"]["getCollectionDetail"];

// Get user's collections with optional recipe membership info
interface UseGetUserCollectionsParams {
  recipeId?: number;
}

export const useGetUserCollections = ({
  recipeId,
}: UseGetUserCollectionsParams = {}) => {
  const trpc = useTRPC();

  return useQuery(
    trpc.collection.getUserCollections.queryOptions({ recipeId }),
  );
};

// Create a new collection
export const useCreateCollection = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const mutationOptions = trpc.collection.createCollection.mutationOptions({
    onSuccess: () => {
      // Invalidate collections list to show the new collection
      const collectionsFilter = trpc.collection.getUserCollections.pathFilter();
      queryClient.invalidateQueries(collectionsFilter);
    },
    onError: () => {
      Alert.alert("Error", "Failed to create collection. Please try again.");
    },
  });

  return useMutation(mutationOptions);
};

// Toggle recipe in a collection with optimistic updates
export const useToggleRecipeInCollection = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  type RecipeDetailOutput = inferOutput<typeof trpc.recipe.getRecipeDetail>;

  const mutationOptions =
    trpc.collection.toggleRecipeInCollection.mutationOptions({
      onMutate: async (variables) => {
        const { recipeId, collectionId } = variables;

        // Get type-safe query filters
        const recipeDetailFilter = trpc.recipe.getRecipeDetail.pathFilter();
        const collectionsFilter =
          trpc.collection.getUserCollections.pathFilter();

        // Cancel any outgoing refetches to prevent race conditions
        await queryClient.cancelQueries(recipeDetailFilter);
        await queryClient.cancelQueries(collectionsFilter);

        // Snapshot the previous values for rollback
        const recipeDetailQueryKey = trpc.recipe.getRecipeDetail.queryKey({
          recipeId,
        });
        const previousRecipeDetail =
          queryClient.getQueryData<RecipeDetailOutput>(recipeDetailQueryKey);

        // Get collectionIds from detail cache
        const previousCollectionIds = previousRecipeDetail?.collectionIds || [];

        // Calculate new collectionIds optimistically - toggle the specified collection
        const newCollectionIds = toggleCollectionInArray(
          previousCollectionIds,
          collectionId,
        );

        // Update all caches with new collectionIds
        updateRecipeCollections(queryClient, trpc, recipeId, newCollectionIds);

        // Optimistically update the collections list query (for the CollectionSelectorSheet)
        const previousCollectionsData: any[] = [];
        queryClient.setQueriesData<any>(collectionsFilter, (old: any) => {
          if (!old) return old;

          // Store previous data for rollback
          previousCollectionsData.push(old);

          // Update hasRecipe for the toggled collection
          return old.map((collection: any) => {
            if (collection.id === collectionId) {
              return {
                ...collection,
                hasRecipe: !collection.hasRecipe,
              };
            }
            return collection;
          });
        });

        return {
          previousRecipeDetail,
          recipeDetailQueryKey,
          previousCollectionsData,
        };
      },
      onError: (_err, variables, context) => {
        const { recipeId } = variables;

        // Rollback to previous state
        if (context?.previousRecipeDetail && context?.recipeDetailQueryKey) {
          queryClient.setQueryData(
            context.recipeDetailQueryKey,
            context.previousRecipeDetail,
          );

          // Rollback the collectionIds in other caches too
          updateRecipeCollections(
            queryClient,
            trpc,
            recipeId,
            context.previousRecipeDetail.collectionIds || [],
          );
        }

        // Rollback collections list data
        if (
          context?.previousCollectionsData &&
          context.previousCollectionsData.length > 0
        ) {
          const collectionsFilter =
            trpc.collection.getUserCollections.pathFilter();
          let dataIndex = 0;
          queryClient.setQueriesData<any>(collectionsFilter, () => {
            return context.previousCollectionsData[dataIndex++];
          });
        }

        Alert.alert("Error", "Failed to update collection. Please try again.");
      },
      onSettled: () => {
        // Invalidate queries to refetch and ensure cache is in sync with server
        const recipeDetailFilter = trpc.recipe.getRecipeDetail.pathFilter();
        const collectionsFilter =
          trpc.collection.getUserCollections.pathFilter();
        const userRecipesFilter = trpc.recipe.getUserRecipes.pathFilter();

        queryClient.invalidateQueries(recipeDetailFilter);
        queryClient.invalidateQueries(collectionsFilter);
        queryClient.invalidateQueries(userRecipesFilter);
      },
    });

  return useMutation(mutationOptions);
};

// Get user's collections with metadata (recipe count, owner info)
interface UseGetUserCollectionsWithMetadataParams {
  search?: string;
}

export const useGetUserCollectionsWithMetadata = ({
  search = "",
}: UseGetUserCollectionsWithMetadataParams = {}) => {
  const trpc = useTRPC();

  return useQuery(
    trpc.collection.getUserCollections.queryOptions({
      includeMetadata: true,
      search: search.trim() || undefined,
    }),
  );
};

// Get collection detail with recipes
interface UseGetCollectionDetailParams {
  collectionId: number;
  enabled?: boolean;
}

export const useGetCollectionDetail = ({
  collectionId,
  enabled = true,
}: UseGetCollectionDetailParams) => {
  const trpc = useTRPC();

  return useQuery({
    ...trpc.collection.getCollectionDetail.queryOptions({ collectionId }),
    enabled,
  });
};

// Delete a collection
export const useDeleteCollection = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const mutationOptions = trpc.collection.deleteCollection.mutationOptions({
    onSuccess: () => {
      // Invalidate collections list to remove the deleted collection
      const collectionsFilter = trpc.collection.getUserCollections.pathFilter();
      queryClient.invalidateQueries(collectionsFilter);

      // Also invalidate user recipes in case they were affected
      const userRecipesFilter = trpc.recipe.getUserRecipes.pathFilter();
      queryClient.invalidateQueries(userRecipesFilter);
    },
    onError: () => {
      Alert.alert("Error", "Failed to delete collection. Please try again.");
    },
  });

  return useMutation(mutationOptions);
};

// Get collections for a specific user (with metadata)
interface UseGetUserCollectionsByIdParams {
  userId: string;
  search?: string;
}

export const useGetUserCollectionsById = ({
  userId,
  search = "",
}: UseGetUserCollectionsByIdParams) => {
  const trpc = useTRPC();

  return useQuery(
    trpc.collection.getUserCollectionsById.queryOptions({
      userId,
      search: search.trim() || undefined,
    }),
  );
};
