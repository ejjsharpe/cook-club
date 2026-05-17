import type { Inputs, Outputs } from "@repo/trpc/client";
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
export type PersonalizationGoal =
  Inputs["recipe"]["personalizeRecipe"]["goals"][number];
export type Tag = RecipeListItem["tags"][number];

// Parse recipe from URL using AI (Smart Import)
export const useParseRecipeFromUrl = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation({
    ...trpc.recipe.parseRecipeFromUrl.mutationOptions({ retry: false }),
    onSettled: () => {
      queryClient.invalidateQueries(trpc.subscription.getStatus.pathFilter());
    },
  });
};

// Parse recipe from URL using structured data only (Basic Import - no AI)
export const useParseRecipeFromUrlBasic = () => {
  const trpc = useTRPC();

  return useMutation(
    trpc.recipe.parseRecipeFromUrlBasic.mutationOptions({ retry: false }),
  );
};

// Parse recipe from text using AI
export const useParseRecipeFromText = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation({
    ...trpc.recipe.parseRecipeFromText.mutationOptions({ retry: false }),
    onSettled: () => {
      queryClient.invalidateQueries(trpc.subscription.getStatus.pathFilter());
    },
  });
};

// Parse recipe from image using AI
export const useParseRecipeFromImage = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation({
    ...trpc.recipe.parseRecipeFromImage.mutationOptions({ retry: false }),
    onSettled: () => {
      queryClient.invalidateQueries(trpc.subscription.getStatus.pathFilter());
    },
  });
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

  return useInfiniteQuery({
    ...infiniteQueryOptions,
  });
};

// Get recipe detail
interface UseRecipeDetailParams {
  recipeId: number | null;
  enabled?: boolean;
}

export const useRecipeDetail = ({
  recipeId,
  enabled = true,
}: UseRecipeDetailParams) => {
  const trpc = useTRPC();

  return useQuery({
    ...trpc.recipe.getRecipeDetail.queryOptions({ recipeId: recipeId ?? -1 }),
    enabled: enabled && recipeId !== null,
  });
};

// Get user preferences for filter suggestions
export const useUserPreferences = () => {
  const trpc = useTRPC();

  return useQuery({
    ...trpc.recipe.getUserPreferences.queryOptions(),
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
  });
};

// Get distinct tags that exist on the current user's recipes
export const useUserRecipeTags = () => {
  const trpc = useTRPC();

  return useQuery({
    ...trpc.recipe.getUserRecipeTags.queryOptions(),
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

  return useInfiniteQuery({
    ...infiniteQueryOptions,
  });
};

// Import a recipe from another user
export const useImportRecipe = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation({
    ...trpc.recipe.importRecipe.mutationOptions(),
    onSuccess: () => {
      // Invalidate user's recipe list to show the imported recipe
      queryClient.invalidateQueries(trpc.recipe.getUserRecipes.pathFilter());
      // Invalidate recipe detail queries (user may view their new copy)
      queryClient.invalidateQueries(trpc.recipe.getRecipeDetail.pathFilter());
      // Invalidate collection queries (recipe is auto-added to "Want to cook")
      queryClient.invalidateQueries(
        trpc.collection.getUserCollections.pathFilter(),
      );
    },
  });
};

// Delete a recipe
export const useDeleteRecipe = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation({
    ...trpc.recipe.deleteRecipe.mutationOptions(),
    onSuccess: () => {
      // Invalidate user's recipe list to remove the deleted recipe
      queryClient.invalidateQueries(trpc.recipe.getUserRecipes.pathFilter());
      // Invalidate recipe detail queries
      queryClient.invalidateQueries(trpc.recipe.getRecipeDetail.pathFilter());
      // Invalidate collection queries (recipe counts may have changed)
      queryClient.invalidateQueries(
        trpc.collection.getUserCollections.pathFilter(),
      );
    },
  });
};

// Save a new recipe (used for smart/basic import and manual creation)
export const useSaveRecipe = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation({
    ...trpc.recipe.postRecipe.mutationOptions(),
    onSuccess: () => {
      // Invalidate user's recipe list to show the new recipe
      queryClient.invalidateQueries(trpc.recipe.getUserRecipes.pathFilter());
      // Invalidate recipe detail queries
      queryClient.invalidateQueries(trpc.recipe.getRecipeDetail.pathFilter());
      // Invalidate collection queries (recipe is auto-added to default collection)
      queryClient.invalidateQueries(
        trpc.collection.getUserCollections.pathFilter(),
      );
      // Invalidate collection detail queries (recipe counts change)
      queryClient.invalidateQueries(
        trpc.collection.getCollectionDetail.pathFilter(),
      );
    },
  });
};

// Update an existing recipe owned by the current user
export const useUpdateRecipe = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation({
    ...trpc.recipe.updateRecipe.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries(trpc.recipe.getUserRecipes.pathFilter());
      queryClient.invalidateQueries(trpc.recipe.getRecipeDetail.pathFilter());
      queryClient.invalidateQueries(
        trpc.collection.getUserCollections.pathFilter(),
      );
      queryClient.invalidateQueries(
        trpc.collection.getCollectionDetail.pathFilter(),
      );
    },
  });
};

// Personalise a recipe with AI and return an editable parsed recipe preview
export const usePersonalizeRecipe = () => {
  const trpc = useTRPC();

  return useMutation(
    trpc.recipe.personalizeRecipe.mutationOptions({
      retry: false,
    }),
  );
};

export const useGenerateRecipeImage = () => {
  const trpc = useTRPC();

  return useMutation(
    trpc.recipe.generateRecipeImage.mutationOptions({
      retry: false,
    }),
  );
};

export const useGetRecipeNutrition = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation({
    ...trpc.recipe.getNutrition.mutationOptions({
      retry: false,
    }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries(
        trpc.recipe.getRecipeDetail.queryFilter({
          recipeId: variables.recipeId,
        }),
      );
    },
  });
};
