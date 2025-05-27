import { useTRPC } from '@repo/trpc/client';
import { useQuery } from '@tanstack/react-query';

export const useScrapeRecipe = ({ url }: { url: string }) => {
  const trpc = useTRPC();

  return useQuery({ ...trpc.recipe.scrapeRecipe.queryOptions({ url }), enabled: false });
};
