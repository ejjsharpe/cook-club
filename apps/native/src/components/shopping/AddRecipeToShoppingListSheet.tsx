import { forwardRef, useCallback, useImperativeHandle, useRef } from "react";

import { useAddRecipeToShoppingList } from "../../api/shopping";
import {
  RecipeBrowserSheet,
  type RecipeBrowserSheetRef,
} from "../RecipeBrowserSheet";

export interface AddRecipeToShoppingListSheetRef {
  present: () => void;
  dismiss: () => void;
}

export const AddRecipeToShoppingListSheet = forwardRef<
  AddRecipeToShoppingListSheetRef,
  object
>((_props, ref) => {
  const sheetRef = useRef<RecipeBrowserSheetRef>(null);
  const addToShoppingListMutation = useAddRecipeToShoppingList();

  useImperativeHandle(ref, () => ({
    present: () => sheetRef.current?.present(),
    dismiss: () => sheetRef.current?.dismiss(),
  }));

  const handleSelectRecipe = useCallback(
    async (recipeId: number) => {
      await addToShoppingListMutation.mutateAsync({ recipeId });
    },
    [addToShoppingListMutation],
  );

  return (
    <RecipeBrowserSheet
      ref={sheetRef}
      title="Add to Groceries"
      onSelectRecipe={handleSelectRecipe}
    />
  );
});
