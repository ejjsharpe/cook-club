import { SheetDefinition, SheetRegister } from "react-native-actions-sheet";

import { CollectionSelectorSheet } from "@/components/CollectionSelectorSheet";
import { CommentsSheet } from "@/components/CommentsSheet";
import { CookingReviewSheet } from "@/components/CookingReviewSheet";
import { FilterSheet } from "@/components/FilterBottomSheet";
import { SmartImportSheet } from "@/components/SmartImportSheet";
import { SignInSheet } from "@/components/SignInSheet";
import { SignUpSheet } from "@/components/SignUpSheet";

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
        "collection-selector-sheet": CollectionSelectorSheet,
        "cooking-review-sheet": CookingReviewSheet,
        "smart-import-sheet": SmartImportSheet,
      }}
    />
  );
};
