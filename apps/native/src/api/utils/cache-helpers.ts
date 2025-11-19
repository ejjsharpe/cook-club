import type { InfiniteData, QueryClient } from '@tanstack/react-query';

/**
 * Updates the collectionIds for a specific recipe across all query caches
 * This ensures consistent state between recipe details, recommended feed, and collections
 */
export function updateRecipeCollections(
  queryClient: QueryClient,
  trpc: ReturnType<typeof import('@repo/trpc/client').useTRPC>,
  recipeId: number,
  collectionIds: number[]
) {
  // Get type-safe filters
  const recommendedRecipesFilter = trpc.recipe.getRecommendedRecipes.pathFilter();
  const recipeDetailFilter = trpc.recipe.getRecipeDetail.pathFilter();

  // 1. Update recommended recipes infinite query
  queryClient.setQueriesData<InfiniteData<any>>(recommendedRecipesFilter, (old: any) => {
    if (!old?.pages) return old;

    // Check if any item actually needs updating
    let hasChanges = false;
    const newPages = old.pages.map((page: any) => {
      const newItems = page.items.map((item: any) => {
        if (item.id === recipeId) {
          hasChanges = true;
          return {
            ...item,
            collectionIds: [...collectionIds], // Create new array reference
          };
        }
        return item;
      });
      return {
        ...page,
        items: newItems,
      };
    });

    // Only return a new object if there were actual changes
    if (!hasChanges) return old;

    return {
      ...old,
      pages: newPages,
    };
  });

  // 2. Update recipe detail query
  queryClient.setQueriesData<any>(recipeDetailFilter, (old: any) => {
    if (!old || old.id !== recipeId) return old;
    return {
      ...old,
      collectionIds: [...collectionIds], // Create new array reference
    };
  });
}

/**
 * Optimistically toggles a recipe in a collection
 * Returns the new collectionIds array after the toggle
 */
export function toggleCollectionInArray(
  currentCollectionIds: number[],
  collectionId: number
): number[] {
  const isInCollection = currentCollectionIds.includes(collectionId);

  if (isInCollection) {
    // Remove from collection
    return currentCollectionIds.filter((id) => id !== collectionId);
  } else {
    // Add to collection
    return [...currentCollectionIds, collectionId];
  }
}
