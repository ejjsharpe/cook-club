import { useToggleRecipeInCollection } from "../api/collection";

interface Recipe {
  id: number;
  collectionIds?: number[];
}

/**
 * Unified hook for handling recipe save logic
 * Centralizes the decision between quick save and showing collection selector
 */
export const useRecipeSave = (recipe: Recipe) => {
  const toggleMutation = useToggleRecipeInCollection();

  const collectionIds = recipe.collectionIds ?? [];
  const isSaved = collectionIds.length > 0;

  const handleSavePress = () => {
    // Single collection (or no collections) - quick save/unsave to default
    // When collectionId is undefined, backend will use default collection
    toggleMutation.mutate({ recipeId: recipe.id, collectionId: undefined });
  };

  return {
    handleSavePress,
    isSaved,
    isSaving: toggleMutation.isPending,
  };
};
