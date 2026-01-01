import type { Outputs } from "@repo/trpc/client";
import { useTRPC } from "@repo/trpc/client";
import {
  useQuery,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

// API Response Types
export type Recipe = Outputs["recipe"]["getRecipeDetail"];
export type RecipeListItem =
  Outputs["recipe"]["getUserRecipes"]["items"][number];
export type ParsedRecipe = Outputs["recipe"]["parseRecipeFromUrl"];
export type Tag = RecipeListItem["tags"][number];

// Parse recipe from URL using AI
export const useParseRecipeFromUrl = ({ url }: { url: string }) => {
  const trpc = useTRPC();

  return useQuery({
    ...trpc.recipe.parseRecipeFromUrl.queryOptions({ url }),
    enabled: false, // Manual fetch
    retry: false,
  });
};

// Parse recipe from text using AI
export const useParseRecipeFromText = ({ text }: { text: string }) => {
  const trpc = useTRPC();

  return useQuery({
    ...trpc.recipe.parseRecipeFromText.queryOptions({ text }),
    enabled: false, // Manual fetch
    retry: false,
  });
};

// Parse recipe from image using AI
export const useParseRecipeFromImage = () => {
  const trpc = useTRPC();

  return useMutation(
    trpc.recipe.parseRecipeFromImage.mutationOptions({ retry: false }),
  );
};

interface UseGetUserRecipesParams {
  search?: string;
  limit?: number;
  tagIds?: number[];
  maxTotalTime?: number;
}

export const useGetUserRecipes = ({
  search,
  limit = 20,
  tagIds,
  maxTotalTime,
}: UseGetUserRecipesParams) => {
  const trpc = useTRPC();

  const infiniteQueryOptions = trpc.recipe.getUserRecipes.infiniteQueryOptions(
    { search, limit, tagIds, maxTotalTime },
    { getNextPageParam: (lastPage) => lastPage?.nextCursor },
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

// Get recipes uploaded by a specific user
interface UseGetUserRecipesByIdParams {
  userId: string;
  search?: string;
  limit?: number;
}

export const useGetUserRecipesById = ({
  userId,
  search,
  limit = 20,
}: UseGetUserRecipesByIdParams) => {
  const trpc = useTRPC();

  const infiniteQueryOptions =
    trpc.recipe.getUserRecipesById.infiniteQueryOptions(
      { userId, search, limit },
      { getNextPageParam: (lastPage) => lastPage?.nextCursor },
    );

  return useInfiniteQuery(infiniteQueryOptions);
};

// Import a recipe from another user
export const useImportRecipe = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation({
    ...trpc.recipe.importRecipe.mutationOptions(),
    onSuccess: () => {
      // Invalidate user's recipe list to show the imported recipe
      queryClient.invalidateQueries({
        queryKey: trpc.recipe.getUserRecipes.queryKey(),
      });
    },
  });
};
