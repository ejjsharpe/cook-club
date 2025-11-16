import { useTRPC } from '@repo/trpc/client';
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';

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

interface UsePopularRecipesParams {
  limit?: number;
  daysBack?: number;
}

export const usePopularRecipes = ({ limit = 10, daysBack = 7 }: UsePopularRecipesParams = {}) => {
  const trpc = useTRPC();

  return useQuery({
    ...trpc.recipe.getPopularRecipes.queryOptions({ limit, daysBack }),
    staleTime: 1000 * 60 * 15, // 15 minutes - popular recipes don't change often
  });
};

// Get recipe detail
interface UseRecipeDetailParams {
  recipeId: number;
}

export const useRecipeDetail = ({ recipeId }: UseRecipeDetailParams) => {
  const trpc = useTRPC();

  return useQuery(trpc.recipe.getRecipeDetail.queryOptions({ recipeId }));
};

// Save recipe mutation
export const useSaveRecipe = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation({
    ...trpc.recipe.saveRecipe.mutationOptions(),
    onSuccess: (_, variables) => {
      // Invalidate recipe detail to update isSaved status
      queryClient.invalidateQueries({
        queryKey: ['recipe', 'getRecipeDetail', { recipeId: variables.recipeId }],
      });
      // Invalidate user recipes list
      queryClient.invalidateQueries({ queryKey: ['recipe', 'getUserRecipes'] });
      // Invalidate recommended recipes to update isSaved status
      queryClient.invalidateQueries({ queryKey: ['recipe', 'getRecommendedRecipes'] });
    },
  });
};

// Like recipe mutation
export const useLikeRecipe = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation({
    ...trpc.recipe.likeRecipe.mutationOptions(),
    onSuccess: (_, variables) => {
      // Invalidate recipe detail to update isLiked status
      queryClient.invalidateQueries({
        queryKey: ['recipe', 'getRecipeDetail', { recipeId: variables.recipeId }],
      });
      // Invalidate recommended recipes to update isLiked status
      queryClient.invalidateQueries({ queryKey: ['recipe', 'getRecommendedRecipes'] });
    },
  });
};

// Get recommended recipes with filters
interface UseRecommendedRecipesParams {
  tagIds?: number[];
  maxTotalTime?: string;
  search?: string;
  limit?: number;
}

export const useRecommendedRecipes = ({
  tagIds,
  maxTotalTime,
  search,
  limit = 20,
}: UseRecommendedRecipesParams = {}) => {
  const trpc = useTRPC();

  const infiniteQueryOptions = trpc.recipe.getRecommendedRecipes.infiniteQueryOptions(
    { tagIds, maxTotalTime, search, limit },
    { getNextPageParam: (lastPage) => lastPage?.nextCursor }
  );

  return useInfiniteQuery({
    ...infiniteQueryOptions,
    staleTime: 1000 * 60 * 5, // 5 minutes
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
