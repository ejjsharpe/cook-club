import { useTRPC } from '@repo/trpc/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { inferOutput } from '@trpc/tanstack-react-query';
import { Alert } from 'react-native';

import { updateRecipeCollections, toggleCollectionInArray } from './utils/cache-helpers';

// Get user's collections with optional recipe membership info
interface UseGetUserCollectionsParams {
  recipeId?: number;
}

export const useGetUserCollections = ({ recipeId }: UseGetUserCollectionsParams = {}) => {
  const trpc = useTRPC();

  return useQuery(trpc.collection.getUserCollections.queryOptions({ recipeId }));
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
      Alert.alert('Error', 'Failed to create collection. Please try again.');
    },
  });

  return useMutation(mutationOptions);
};

// Toggle recipe in a collection with optimistic updates
// Now supports optional collectionId - if not provided, uses default collection
export const useToggleRecipeInCollection = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  type RecipeDetailOutput = inferOutput<typeof trpc.recipe.getRecipeDetail>;

  const mutationOptions = trpc.collection.toggleRecipeInCollection.mutationOptions({
    onMutate: async (variables) => {
      const { recipeId, collectionId } = variables;

      // Get type-safe query filters
      const recommendedRecipesFilter = trpc.recipe.getRecommendedRecipes.pathFilter();
      const recipeDetailFilter = trpc.recipe.getRecipeDetail.pathFilter();
      const collectionsFilter = trpc.collection.getUserCollections.pathFilter();

      // Cancel any outgoing refetches to prevent race conditions
      await queryClient.cancelQueries(recommendedRecipesFilter);
      await queryClient.cancelQueries(recipeDetailFilter);
      await queryClient.cancelQueries(collectionsFilter);

      // Snapshot the previous values for rollback
      const recipeDetailQueryKey = trpc.recipe.getRecipeDetail.queryKey({ recipeId });
      const previousRecipeDetail =
        queryClient.getQueryData<RecipeDetailOutput>(recipeDetailQueryKey);

      // Try to get collectionIds from either detail cache or recommended feed cache
      let previousCollectionIds = previousRecipeDetail?.collectionIds;

      if (!previousCollectionIds) {
        // If not in detail cache, check the recommended recipes infinite query
        const recommendedData = queryClient.getQueriesData<any>(recommendedRecipesFilter);
        for (const [_key, data] of recommendedData) {
          if (data?.pages) {
            for (const page of data.pages) {
              const recipe = page.items?.find((item: any) => item.id === recipeId);
              if (recipe) {
                previousCollectionIds = recipe.collectionIds;
                break;
              }
            }
          }
          if (previousCollectionIds) break;
        }
      }

      previousCollectionIds = previousCollectionIds || [];

      // Calculate new collectionIds optimistically
      let newCollectionIds: number[];
      if (collectionId) {
        // Specific collection provided - toggle it
        newCollectionIds = toggleCollectionInArray(previousCollectionIds, collectionId);
      } else {
        // Default collection - toggle between saved (unknown ID) and unsaved
        // If currently saved, unsave by clearing the array
        // If currently unsaved, we'll use a placeholder [-1] that will be replaced by server response
        newCollectionIds = previousCollectionIds.length > 0 ? [] : [-1];
      }

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
          // If collectionId is provided, toggle that specific collection
          if (collectionId !== undefined && collection.id === collectionId) {
            return {
              ...collection,
              hasRecipe: !collection.hasRecipe,
            };
          }
          // If collectionId is not provided, toggle the default collection
          if (collectionId === undefined && collection.isDefault) {
            return {
              ...collection,
              hasRecipe: !collection.hasRecipe,
            };
          }
          return collection;
        });
      });

      return { previousRecipeDetail, recipeDetailQueryKey, previousCollectionsData };
    },
    onError: (_err, variables, context) => {
      const { recipeId } = variables;

      // Rollback to previous state
      if (context?.previousRecipeDetail && context?.recipeDetailQueryKey) {
        queryClient.setQueryData(context.recipeDetailQueryKey, context.previousRecipeDetail);

        // Rollback the collectionIds in other caches too
        updateRecipeCollections(
          queryClient,
          trpc,
          recipeId,
          context.previousRecipeDetail.collectionIds || []
        );
      }

      // Rollback collections list data
      if (context?.previousCollectionsData && context.previousCollectionsData.length > 0) {
        const collectionsFilter = trpc.collection.getUserCollections.pathFilter();
        let dataIndex = 0;
        queryClient.setQueriesData<any>(collectionsFilter, () => {
          return context.previousCollectionsData[dataIndex++];
        });
      }

      Alert.alert('Error', 'Failed to update collection. Please try again.');
    },
    onSettled: () => {
      // Invalidate queries to refetch and ensure cache is in sync with server
      const recommendedRecipesFilter = trpc.recipe.getRecommendedRecipes.pathFilter();
      const recipeDetailFilter = trpc.recipe.getRecipeDetail.pathFilter();
      const collectionsFilter = trpc.collection.getUserCollections.pathFilter();
      const userRecipesFilter = trpc.recipe.getUserRecipes.pathFilter();

      queryClient.invalidateQueries(recommendedRecipesFilter);
      queryClient.invalidateQueries(recipeDetailFilter);
      queryClient.invalidateQueries(collectionsFilter);
      queryClient.invalidateQueries(userRecipesFilter);
    },
  });

  return useMutation(mutationOptions);
};
