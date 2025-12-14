import { useTRPC } from '@repo/trpc/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';

// Get user's shopping list
export const useGetShoppingList = () => {
  const trpc = useTRPC();
  return useQuery(trpc.shopping.getShoppingList.queryOptions());
};

// Add recipe to shopping list
export const useAddRecipeToShoppingList = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const mutationOptions = trpc.shopping.addRecipeToShoppingList.mutationOptions({
    onSuccess: () => {
      // Invalidate shopping list query to refresh
      const shoppingListFilter = trpc.shopping.getShoppingList.pathFilter();
      queryClient.invalidateQueries(shoppingListFilter);

      Alert.alert('Success', 'Recipe added to shopping list');
    },
    onError: (error) => {
      const message = error.message || 'Failed to add recipe to shopping list';
      Alert.alert('Error', message);
    },
  });

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
            item.id === itemId ? { ...item, isChecked: !item.isChecked } : item
          ),
        };
      });

      return { previous, shoppingListQueryKey };
    },
    onError: (_err, _variables, context) => {
      // Rollback on error
      if (context?.previous && context?.shoppingListQueryKey) {
        queryClient.setQueryData(context.shoppingListQueryKey, context.previous);
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
      Alert.alert('Error', 'Failed to remove item');
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
      Alert.alert('Error', 'Failed to clear checked items');
    },
  });

  return useMutation(mutationOptions);
};

// Remove recipe from shopping list
export const useRemoveRecipeFromList = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const mutationOptions = trpc.shopping.removeRecipeFromList.mutationOptions({
    onSuccess: () => {
      const shoppingListFilter = trpc.shopping.getShoppingList.pathFilter();
      queryClient.invalidateQueries(shoppingListFilter);
    },
    onError: () => {
      Alert.alert('Error', 'Failed to remove recipe from list');
    },
  });

  return useMutation(mutationOptions);
};

// Add manual item
export const useAddManualItem = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const mutationOptions = trpc.shopping.addManualItem.mutationOptions({
    onSuccess: () => {
      const shoppingListFilter = trpc.shopping.getShoppingList.pathFilter();
      queryClient.invalidateQueries(shoppingListFilter);
    },
    onError: () => {
      Alert.alert('Error', 'Failed to add item');
    },
  });

  return useMutation(mutationOptions);
};
