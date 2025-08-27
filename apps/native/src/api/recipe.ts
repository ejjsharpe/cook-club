import { useTRPC } from '@repo/trpc/client';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';

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
