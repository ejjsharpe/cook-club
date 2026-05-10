import type { Outputs } from "@repo/trpc/client";
import { useTRPC } from "@repo/trpc/client";
import { useQueryClient } from "@tanstack/react-query";
import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { Alert } from "react-native";

import {
  RecipeBrowserSheet,
  type RecipeBrowserSheetRef,
} from "../RecipeBrowserSheet";
import {
  ShoppingListSelectorSheet,
  type ShoppingListSelectorSheetRef,
} from "../ShoppingListSelectorSheet";

type RecipeDetail = Outputs["recipe"]["getRecipeDetail"];

export interface AddRecipeToShoppingListSheetRef {
  present: () => void;
  dismiss: () => void;
}

interface AddRecipeToShoppingListSheetProps {
  shoppingListId?: number;
}

export const AddRecipeToShoppingListSheet = forwardRef<
  AddRecipeToShoppingListSheetRef,
  AddRecipeToShoppingListSheetProps
>(({ shoppingListId }, ref) => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const browserSheetRef = useRef<RecipeBrowserSheetRef>(null);
  const ingredientSheetRef = useRef<ShoppingListSelectorSheetRef>(null);
  const shouldPresentIngredientSheetRef = useRef(false);
  const [selectedRecipe, setSelectedRecipe] = useState<RecipeDetail | null>(
    null,
  );

  const ingredientSections = useMemo(
    () =>
      selectedRecipe
        ? selectedRecipe.ingredientSections.map((section) => ({
            id: section.id,
            name: section.name,
            ingredients: section.ingredients.map((ingredient) => ({
              id: ingredient.id,
              quantity: ingredient.quantity,
              unit: ingredient.unit,
              name: ingredient.name,
              preparation: ingredient.preparation,
            })),
          }))
        : [],
    [selectedRecipe],
  );

  const ingredients = useMemo(
    () => ingredientSections.flatMap((section) => section.ingredients),
    [ingredientSections],
  );

  useImperativeHandle(ref, () => ({
    present: () => browserSheetRef.current?.present(),
    dismiss: () => {
      browserSheetRef.current?.dismiss();
      ingredientSheetRef.current?.dismiss();
    },
  }));

  const handleSelectRecipe = useCallback(
    async (recipeId: number) => {
      if (!shoppingListId) {
        Alert.alert("Error", "Choose a shopping list before adding a recipe");
        throw new Error("Missing shopping list ID");
      }

      try {
        const recipe = await queryClient.fetchQuery(
          trpc.recipe.getRecipeDetail.queryOptions({ recipeId }),
        );

        setSelectedRecipe(recipe);
        shouldPresentIngredientSheetRef.current = true;
      } catch (error) {
        Alert.alert("Error", "Failed to load recipe ingredients");
        throw error;
      }
    },
    [queryClient, shoppingListId, trpc],
  );

  const handleBrowserDismiss = useCallback(() => {
    if (!shouldPresentIngredientSheetRef.current) return;

    shouldPresentIngredientSheetRef.current = false;
    requestAnimationFrame(() => {
      ingredientSheetRef.current?.present();
    });
  }, []);

  return (
    <>
      <RecipeBrowserSheet
        ref={browserSheetRef}
        title="Add to Groceries"
        onSelectRecipe={handleSelectRecipe}
        onDismiss={handleBrowserDismiss}
      />
      <ShoppingListSelectorSheet
        ref={ingredientSheetRef}
        recipeId={selectedRecipe?.id}
        recipeName={selectedRecipe?.name}
        ingredients={ingredients}
        ingredientSections={ingredientSections}
        servings={selectedRecipe?.servings ?? undefined}
        targetShoppingListId={shoppingListId}
      />
    </>
  );
});
