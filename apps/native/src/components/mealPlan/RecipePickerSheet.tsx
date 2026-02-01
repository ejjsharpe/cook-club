import { forwardRef, useCallback, useImperativeHandle, useRef } from "react";

import { useAddRecipeToMealPlan } from "../../api/mealPlan";
import {
  RecipeBrowserSheet,
  type RecipeBrowserSheetRef,
} from "../RecipeBrowserSheet";

const MEAL_TYPE_LABELS: Record<string, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
};

export interface RecipePickerSheetProps {
  mealPlanId?: number;
  date?: string;
  mealType?: "breakfast" | "lunch" | "dinner";
}

export interface RecipePickerSheetRef {
  present: () => void;
  dismiss: () => void;
}

export const RecipePickerSheet = forwardRef<
  RecipePickerSheetRef,
  RecipePickerSheetProps
>(({ mealPlanId, date, mealType }, ref) => {
  const sheetRef = useRef<RecipeBrowserSheetRef>(null);
  const addRecipeMutation = useAddRecipeToMealPlan();

  useImperativeHandle(ref, () => ({
    present: () => sheetRef.current?.present(),
    dismiss: () => sheetRef.current?.dismiss(),
  }));

  const handleSelectRecipe = useCallback(
    async (recipeId: number) => {
      if (!mealPlanId || !date || !mealType) return;

      await addRecipeMutation.mutateAsync({
        mealPlanId,
        recipeId,
        date,
        mealType,
      });
    },
    [mealPlanId, date, mealType, addRecipeMutation],
  );

  const mealTypeLabel = mealType ? MEAL_TYPE_LABELS[mealType] : "";

  return (
    <RecipeBrowserSheet
      ref={sheetRef}
      title={`Add to ${mealTypeLabel}`}
      onSelectRecipe={handleSelectRecipe}
    />
  );
});
