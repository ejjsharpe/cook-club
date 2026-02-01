import type { Outputs } from "@repo/trpc/client";
import { useTRPC } from "@repo/trpc/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Alert } from "react-native";

import { updateRecipeCollections } from "./utils/cache-helpers";

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

// Batch update recipe collections (replace all memberships at once)
export const useUpdateRecipeCollections = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const mutationOptions =
    trpc.collection.updateRecipeCollections.mutationOptions({
      onSuccess: (_data, variables) => {
        const { recipeId, collectionIds } = variables;

        // Update recipe detail cache with new collectionIds
        updateRecipeCollections(queryClient, trpc, recipeId, collectionIds);

        // Invalidate collections list to refresh hasRecipe flags
        const collectionsFilter =
          trpc.collection.getUserCollections.pathFilter();
        queryClient.invalidateQueries(collectionsFilter);

        // Invalidate user recipes
        const userRecipesFilter = trpc.recipe.getUserRecipes.pathFilter();
        queryClient.invalidateQueries(userRecipesFilter);
      },
      onError: () => {
        Alert.alert("Error", "Failed to update collections. Please try again.");
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
