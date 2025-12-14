import { useTRPC } from '@repo/trpc/client';
import {
  useQuery,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import { Alert } from 'react-native';
import type { inferOutput } from '@trpc/tanstack-react-query';

export const useScrapeRecipe = ({ url }: { url: string }) => {
  const trpc = useTRPC();

  return useQuery({ ...trpc.recipe.scrapeRecipe.queryOptions({ url }), enabled: false });
};

interface UseGetUserRecipesParams {
  search?: string;
  limit?: number;
}

export const useGetUserRecipes = ({ search, limit = 20 }: UseGetUserRecipesParams) => {
  const trpc = useTRPC();

  const infiniteQueryOptions = trpc.recipe.getUserRecipes.infiniteQueryOptions(
    { search, limit },
    { getNextPageParam: (lastPage) => lastPage?.nextCursor }
  );

  return useInfiniteQuery(infiniteQueryOptions);
};

// Get recipe detail
interface UseRecipeDetailParams {
  recipeId: number;
}

export const useRecipeDetail = ({ recipeId }: UseRecipeDetailParams) => {
  const trpc = useTRPC();

  return useQuery(trpc.recipe.getRecipeDetail.queryOptions({ recipeId }));
};

// Like recipe mutation with optimistic updates
export const useLikeRecipe = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  type RecommendedRecipesOutput = inferOutput<typeof trpc.recipe.getRecommendedRecipes>;
  type SearchAllRecipesOutput = inferOutput<typeof trpc.recipe.searchAllRecipes>;
  type RecipeDetailOutput = inferOutput<typeof trpc.recipe.getRecipeDetail>;

  const mutationOptions = trpc.recipe.likeRecipe.mutationOptions({
    onMutate: async (variables) => {
      const { recipeId } = variables;

      // Use type-safe query filters and keys from tRPC
      const recommendedRecipesFilter = trpc.recipe.getRecommendedRecipes.pathFilter();
      const searchAllRecipesFilter = trpc.recipe.searchAllRecipes.pathFilter();
      const recipeDetailFilter = trpc.recipe.getRecipeDetail.pathFilter();

      // Cancel any outgoing refetches
      await queryClient.cancelQueries(recommendedRecipesFilter);
      await queryClient.cancelQueries(searchAllRecipesFilter);
      await queryClient.cancelQueries(recipeDetailFilter);

      // Snapshot the previous values
      const previousRecommended = queryClient.getQueriesData(recommendedRecipesFilter);
      const previousSearchAll = queryClient.getQueriesData(searchAllRecipesFilter);
      const previousDetail = queryClient.getQueriesData(recipeDetailFilter);

      // Optimistically update all recommended recipes infinite queries
      queryClient.setQueriesData<InfiniteData<RecommendedRecipesOutput>>(
        recommendedRecipesFilter,
        (old) => {
          if (!old?.pages) {
            return old;
          }

          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              items: page.items.map((item) =>
                item.id === recipeId
                  ? {
                      ...item,
                      isLiked: !item.isLiked,
                      likeCount: item.isLiked ? item.likeCount - 1 : item.likeCount + 1,
                    }
                  : item
              ),
            })),
          };
        }
      );

      // Optimistically update all search results infinite queries
      queryClient.setQueriesData<InfiniteData<SearchAllRecipesOutput>>(
        searchAllRecipesFilter,
        (old) => {
          if (!old?.pages) {
            return old;
          }

          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              items: page.items.map((item) =>
                item.id === recipeId
                  ? {
                      ...item,
                      isLiked: !item.isLiked,
                      likeCount: item.isLiked ? item.likeCount - 1 : item.likeCount + 1,
                    }
                  : item
              ),
            })),
          };
        }
      );

      // Optimistically update recipe detail queries
      queryClient.setQueriesData<RecipeDetailOutput>(recipeDetailFilter, (old) => {
        if (!old || old.id !== recipeId) return old;
        return {
          ...old,
          isLiked: !old.isLiked,
          likeCount: old.isLiked ? old.likeCount - 1 : old.likeCount + 1,
        };
      });

      return { previousRecommended, previousSearchAll, previousDetail };
    },
    onError: (_err, _variables, context) => {
      // Rollback optimistic updates on error
      if (context?.previousRecommended) {
        context.previousRecommended.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      if (context?.previousSearchAll) {
        context.previousSearchAll.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      if (context?.previousDetail) {
        context.previousDetail.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }

      Alert.alert('Error', 'Failed to like recipe. Please try again.');
    },
    onSettled: () => {
      // Invalidate queries to refetch and ensure cache is in sync with server
      const recommendedRecipesFilter = trpc.recipe.getRecommendedRecipes.pathFilter();
      const searchAllRecipesFilter = trpc.recipe.searchAllRecipes.pathFilter();
      const recipeDetailFilter = trpc.recipe.getRecipeDetail.pathFilter();

      queryClient.invalidateQueries(recommendedRecipesFilter);
      queryClient.invalidateQueries(searchAllRecipesFilter);
      queryClient.invalidateQueries(recipeDetailFilter);
    },
  });

  return useMutation(mutationOptions);
};

// Get recommended recipes
interface UseRecommendedRecipesParams {
  limit?: number;
}

export const useRecommendedRecipes = ({ limit = 20 }: UseRecommendedRecipesParams = {}) => {
  const trpc = useTRPC();

  const infiniteQueryOptions = trpc.recipe.getRecommendedRecipes.infiniteQueryOptions(
    { limit },
    {
      getNextPageParam: (lastPage) => lastPage?.nextCursor,
      staleTime: 0,
    }
  );

  return useInfiniteQuery(infiniteQueryOptions);
};

// Search all recipes with filters and cursor-based pagination
interface UseSearchAllRecipesParams {
  tagIds?: number[];
  maxTotalTime?: string;
  search?: string;
  limit?: number;
}

export const useSearchAllRecipes = ({
  tagIds,
  maxTotalTime,
  search,
  limit = 20,
}: UseSearchAllRecipesParams = {}) => {
  const trpc = useTRPC();

  const infiniteQueryOptions = trpc.recipe.searchAllRecipes.infiniteQueryOptions(
    { tagIds, maxTotalTime, search, limit },
    { getNextPageParam: (lastPage) => lastPage?.nextCursor }
  );

  return useInfiniteQuery({
    ...infiniteQueryOptions,
    staleTime: 0,
  });
};

// Get user preferences for filter suggestions
export const useUserPreferences = () => {
  const trpc = useTRPC();

  return useQuery({
    ...trpc.recipe.getUserPreferences.queryOptions(),
    staleTime: 1000 * 60 * 30, // 30 minutes - preferences change slowly
  });
};

// Get all tags, optionally filtered by type (cuisine or category)
interface UseAllTagsParams {
  type?: string;
}

export const useAllTags = ({ type }: UseAllTagsParams = {}) => {
  const trpc = useTRPC();

  return useQuery({
    ...trpc.recipe.getAllTags.queryOptions({ type }),
    staleTime: 1000 * 60 * 60, // 1 hour - tags change very rarely
  });
};
