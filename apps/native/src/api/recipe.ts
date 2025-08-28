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
    },
  });
};
