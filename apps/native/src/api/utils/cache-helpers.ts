import type { QueryClient } from "@tanstack/react-query";

/**
 * Updates the collectionIds for a specific recipe across all query caches
 * This ensures consistent state between recipe details and collections
 */
export function updateRecipeCollections(
  queryClient: QueryClient,
  trpc: ReturnType<typeof import("@repo/trpc/client").useTRPC>,
  recipeId: number,
  collectionIds: number[],
) {
  // Get type-safe filter
  const recipeDetailFilter = trpc.recipe.getRecipeDetail.pathFilter();

  // Update recipe detail query
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
  collectionId: number,
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
