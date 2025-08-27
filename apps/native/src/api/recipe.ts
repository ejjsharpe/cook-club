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
