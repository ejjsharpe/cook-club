import { classifyIngredientAisle } from "@repo/shared";
import { useTRPC } from "@repo/trpc/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Alert } from "react-native";

// Get user's shopping list
export const useGetShoppingList = () => {
  const trpc = useTRPC();
  return useQuery(trpc.shopping.getShoppingList.queryOptions());
};

// Add recipe to shopping list with optimistic updates
export const useAddRecipeToShoppingList = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  type RecipeDetailOutput = any; // Type will be inferred from tRPC

  const mutationOptions = trpc.shopping.addRecipeToShoppingList.mutationOptions(
    {
      onMutate: async (variables) => {
        const { recipeId } = variables;

        // Get query filters
        const recipeDetailFilter = trpc.recipe.getRecipeDetail.pathFilter();
        const shoppingListFilter = trpc.shopping.getShoppingList.pathFilter();

        // Cancel outgoing refetches
        await queryClient.cancelQueries(recipeDetailFilter);
        await queryClient.cancelQueries(shoppingListFilter);

        // Snapshot previous values
        const recipeDetailQueryKey = trpc.recipe.getRecipeDetail.queryKey({
          recipeId,
        });
        const previousRecipeDetail =
          queryClient.getQueryData<RecipeDetailOutput>(recipeDetailQueryKey);

        // Optimistically update recipe detail to show it's in shopping list
        if (previousRecipeDetail) {
          queryClient.setQueryData(recipeDetailQueryKey, {
            ...previousRecipeDetail,
            isInShoppingList: true,
          });
        }

        return { previousRecipeDetail, recipeDetailQueryKey };
      },
      onSuccess: () => {
        // Invalidate shopping list query to refresh
        const shoppingListFilter = trpc.shopping.getShoppingList.pathFilter();
        queryClient.invalidateQueries(shoppingListFilter);
      },
      onError: (error, variables, context) => {
        // Rollback on error
        if (context?.previousRecipeDetail && context?.recipeDetailQueryKey) {
          queryClient.setQueryData(
            context.recipeDetailQueryKey,
            context.previousRecipeDetail,
          );
        }

        const message =
          error.message || "Failed to add recipe to shopping list";
        Alert.alert("Error", message);
      },
      onSettled: () => {
        // Invalidate to ensure sync with server
        const recipeDetailFilter = trpc.recipe.getRecipeDetail.pathFilter();
        queryClient.invalidateQueries(recipeDetailFilter);
      },
    },
  );

  return useMutation(mutationOptions);
};

// Toggle item checked status with optimistic updates
export const useToggleItemChecked = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const mutationOptions = trpc.shopping.toggleItemChecked.mutationOptions({
    onMutate: async (variables) => {
      const { itemId } = variables;

      // Cancel outgoing refetches
      const shoppingListFilter = trpc.shopping.getShoppingList.pathFilter();
      await queryClient.cancelQueries(shoppingListFilter);

      // Snapshot previous value
      const shoppingListQueryKey = trpc.shopping.getShoppingList.queryKey();
      const previous = queryClient.getQueryData(shoppingListQueryKey);

      // Optimistically update
      queryClient.setQueryData(shoppingListQueryKey, (old: any) => {
        if (!old) return old;
        return {
          ...old,
          items: old.items.map((item: any) =>
            item.id === itemId ? { ...item, isChecked: !item.isChecked } : item,
          ),
        };
      });

      return { previous, shoppingListQueryKey };
    },
    onError: (_err, _variables, context) => {
      // Rollback on error
      if (context?.previous && context?.shoppingListQueryKey) {
        queryClient.setQueryData(
          context.shoppingListQueryKey,
          context.previous,
        );
      }
    },
    onSettled: () => {
      // Invalidate to ensure sync with server
      const shoppingListFilter = trpc.shopping.getShoppingList.pathFilter();
      queryClient.invalidateQueries(shoppingListFilter);
    },
  });

  return useMutation(mutationOptions);
};

// Remove individual item
export const useRemoveItem = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const mutationOptions = trpc.shopping.removeItem.mutationOptions({
    onSuccess: () => {
      const shoppingListFilter = trpc.shopping.getShoppingList.pathFilter();
      queryClient.invalidateQueries(shoppingListFilter);
    },
    onError: () => {
      Alert.alert("Error", "Failed to remove item");
    },
  });

  return useMutation(mutationOptions);
};

// Clear all checked items
export const useClearCheckedItems = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const mutationOptions = trpc.shopping.clearCheckedItems.mutationOptions({
    onSuccess: () => {
      const shoppingListFilter = trpc.shopping.getShoppingList.pathFilter();
      queryClient.invalidateQueries(shoppingListFilter);
    },
    onError: () => {
      Alert.alert("Error", "Failed to clear checked items");
    },
  });

  return useMutation(mutationOptions);
};

// Remove recipe from shopping list with optimistic updates
export const useRemoveRecipeFromList = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  type RecipeDetailOutput = any; // Type will be inferred from tRPC

  const mutationOptions = trpc.shopping.removeRecipeFromList.mutationOptions({
    onMutate: async (variables) => {
      const { recipeId } = variables;

      // Get query filters
      const recipeDetailFilter = trpc.recipe.getRecipeDetail.pathFilter();
      const shoppingListFilter = trpc.shopping.getShoppingList.pathFilter();

      // Cancel outgoing refetches
      await queryClient.cancelQueries(recipeDetailFilter);
      await queryClient.cancelQueries(shoppingListFilter);

      // Snapshot previous values
      const recipeDetailQueryKey = trpc.recipe.getRecipeDetail.queryKey({
        recipeId,
      });
      const previousRecipeDetail =
        queryClient.getQueryData<RecipeDetailOutput>(recipeDetailQueryKey);

      // Optimistically update recipe detail to show it's not in shopping list
      if (previousRecipeDetail) {
        queryClient.setQueryData(recipeDetailQueryKey, {
          ...previousRecipeDetail,
          isInShoppingList: false,
        });
      }

      return { previousRecipeDetail, recipeDetailQueryKey };
    },
    onSuccess: () => {
      const shoppingListFilter = trpc.shopping.getShoppingList.pathFilter();
      queryClient.invalidateQueries(shoppingListFilter);
    },
    onError: (_error, _variables, context) => {
      // Rollback on error
      if (context?.previousRecipeDetail && context?.recipeDetailQueryKey) {
        queryClient.setQueryData(
          context.recipeDetailQueryKey,
          context.previousRecipeDetail,
        );
      }

      Alert.alert("Error", "Failed to remove recipe from list");
    },
    onSettled: () => {
      // Invalidate to ensure sync with server
      const recipeDetailFilter = trpc.recipe.getRecipeDetail.pathFilter();
      queryClient.invalidateQueries(recipeDetailFilter);
    },
  });

  return useMutation(mutationOptions);
};

// Add manual item with optimistic updates
export const useAddManualItem = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const mutationOptions = trpc.shopping.addManualItem.mutationOptions({
    onMutate: async (variables) => {
      const { ingredientText } = variables;

      // Cancel outgoing refetches
      const shoppingListFilter = trpc.shopping.getShoppingList.pathFilter();
      await queryClient.cancelQueries(shoppingListFilter);

      // Snapshot previous value
      const shoppingListQueryKey = trpc.shopping.getShoppingList.queryKey();
      const previous = queryClient.getQueryData(shoppingListQueryKey);

      // Parse the ingredient text (simple extraction for optimistic update)
      const trimmed = ingredientText.trim();
      const aisle = classifyIngredientAisle(trimmed);

      // Optimistically add the item
      queryClient.setQueryData(shoppingListQueryKey, (old: any) => {
        if (!old) return old;

        // Create an optimistic item with a temporary negative ID
        const optimisticItem = {
          id: -Date.now(), // Temporary negative ID
          ingredientName: trimmed.toLowerCase(),
          displayText: trimmed,
          quantity: 0,
          unit: null,
          isChecked: false,
          aisle,
          sourceItems: [],
        };

        return {
          ...old,
          items: [optimisticItem, ...old.items],
        };
      });

      return { previous, shoppingListQueryKey };
    },
    onError: (_err, _variables, context) => {
      // Rollback on error
      if (context?.previous && context?.shoppingListQueryKey) {
        queryClient.setQueryData(
          context.shoppingListQueryKey,
          context.previous,
        );
      }
      Alert.alert("Error", "Failed to add item");
    },
    onSettled: () => {
      // Invalidate to ensure sync with server
      const shoppingListFilter = trpc.shopping.getShoppingList.pathFilter();
      queryClient.invalidateQueries(shoppingListFilter);
    },
  });

  return useMutation(mutationOptions);
};
