import { SheetDefinition, SheetRegister } from "react-native-actions-sheet";

import type { ShareStatus } from "@/api/mealPlan";
import { AdjustRecipeSheet } from "@/components/AdjustRecipeSheet";
import { BasicImportSheet } from "@/components/BasicImportSheet";
import { CollectionSelectorSheet } from "@/components/CollectionSelectorSheet";
import { CommentsSheet } from "@/components/CommentsSheet";
import { CookingReviewSheet } from "@/components/CookingReviewSheet";
import { FilterSheet } from "@/components/FilterBottomSheet";
import { ShoppingListSelectorSheet } from "@/components/ShoppingListSelectorSheet";
import { SignInSheet } from "@/components/SignInSheet";
import { SignUpSheet } from "@/components/SignUpSheet";
import { SmartImportSheet } from "@/components/SmartImportSheet";
import { MealPlanPickerSheet } from "@/components/mealPlan/MealPlanPickerSheet";
import { MealPlanShareSheet } from "@/components/mealPlan/MealPlanShareSheet";
import { RecipePickerSheet } from "@/components/mealPlan/RecipePickerSheet";
import { SharedUsersSheet } from "@/components/mealPlan/SharedUsersSheet";

// Type declarations for sheets
declare module "react-native-actions-sheet" {
  interface Sheets {
    "sign-in-sheet": SheetDefinition;
    "sign-up-sheet": SheetDefinition;
    "comments-sheet": SheetDefinition<{
      payload: { activityEventId: number };
    }>;
    "filter-sheet": SheetDefinition<{
      payload: {
        selectedTagIds: number[];
        onTagsChange: (tagIds: number[]) => void;
        maxTotalTime?: string;
        onTimeChange: (time: string | undefined) => void;
        allTags?: { id: number; name: string; type: string; count?: number }[];
      };
    }>;
    "adjust-recipe-sheet": SheetDefinition<{
      payload: {
        servings: number;
        onServingsChange: (servings: number) => void;
      };
    }>;
    "shopping-list-selector-sheet": SheetDefinition<{
      payload: {
        recipeId: number;
        recipeName: string;
        ingredients: {
          id: number;
          quantity: string | null;
          unit: string | null;
          name: string;
          preparation?: string | null;
        }[];
        servings?: number;
      };
    }>;
    "collection-selector-sheet": SheetDefinition<{
      payload: { recipeId: number };
    }>;
    "cooking-review-sheet": SheetDefinition<{
      payload: {
        recipeName: string;
        onSubmit: (data: {
          rating: number;
          reviewText?: string;
          imageUrls?: string[];
        }) => Promise<void>;
      };
    }>;
    "smart-import-sheet": SheetDefinition<{
      payload: {
        onRecipeParsed: (
          result: NonNullable<
            ReactNavigation.RootParamList["EditRecipe"]["parsedRecipe"]
          >,
        ) => void;
      };
    }>;
    "basic-import-sheet": SheetDefinition<{
      payload: {
        onRecipeParsed: (
          result: NonNullable<
            ReactNavigation.RootParamList["EditRecipe"]["parsedRecipe"]
          >,
        ) => void;
      };
    }>;
    "recipe-picker-sheet": SheetDefinition<{
      payload: {
        mealPlanId: number;
        date: string;
        mealType: "breakfast" | "lunch" | "dinner";
      };
    }>;
    "meal-plan-picker-sheet": SheetDefinition<{
      payload: {
        activePlanId: number;
        onSelectPlan: (planId: number) => void;
      };
    }>;
    "meal-plan-share-sheet": SheetDefinition<{
      payload: {
        mealPlanId: number;
        planName: string;
      };
    }>;
    "shared-users-sheet": SheetDefinition<{
      payload: {
        mealPlanId: number;
        planName: string;
        sharedUsers: ShareStatus[];
        isOwner: boolean;
      };
    }>;
  }
}

export const Sheets = () => {
  return (
    <SheetRegister
      sheets={{
        "sign-in-sheet": SignInSheet,
        "sign-up-sheet": SignUpSheet,
        "comments-sheet": CommentsSheet,
        "filter-sheet": FilterSheet,
        "adjust-recipe-sheet": AdjustRecipeSheet,
        "shopping-list-selector-sheet": ShoppingListSelectorSheet,
        "collection-selector-sheet": CollectionSelectorSheet,
        "cooking-review-sheet": CookingReviewSheet,
        "smart-import-sheet": SmartImportSheet,
        "basic-import-sheet": BasicImportSheet,
        "recipe-picker-sheet": RecipePickerSheet,
        "meal-plan-picker-sheet": MealPlanPickerSheet,
        "meal-plan-share-sheet": MealPlanShareSheet,
        "shared-users-sheet": SharedUsersSheet,
      }}
    />
  );
};
