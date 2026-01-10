import {
  createStaticNavigation,
  StaticParamList,
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { lazy } from "react";

import { TabNavigator } from "./TabNavigator";

import type { ParsedRecipe } from "@/api/recipe";
import {
  useIsSignedIn,
  useIsSignedOut,
  useNeedsOnboarding,
} from "@/lib/signedInContext";
import { AddRecipeToShoppingListScreen } from "@/screens/AddRecipeToShoppingListScreen";
import { CollectionDetailScreen } from "@/screens/CollectionDetailScreen";
import { EditProfileScreen } from "@/screens/EditProfileScreen";
import EditRecipeScreen from "@/screens/EditRecipeScreen";
import { FollowsScreen } from "@/screens/FollowsScreen";
import FridgeSnapScreen from "@/screens/FridgeSnapScreen";
import GenerateRecipeScreen from "@/screens/GenerateRecipeScreen";
import { RecipeDetailScreen } from "@/screens/RecipeDetailScreen";
import { SettingsScreen } from "@/screens/SettingsScreen";
import { UserProfileScreen } from "@/screens/UserProfileScreen";
import { CuisinePreferencesScreen } from "@/screens/settings/CuisinePreferencesScreen";
import { DietaryPreferencesScreen } from "@/screens/settings/DietaryPreferencesScreen";
import { IngredientPreferencesScreen } from "@/screens/settings/IngredientPreferencesScreen";

const StartScreen = lazy(() => import("@/screens/StartScreen"));
const OnboardingScreen = lazy(() => import("@/screens/OnboardingScreen"));

type RootStackParamList = StaticParamList<typeof RootStack>;

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {
      EditRecipe: { parsedRecipe?: ParsedRecipe };
      GenerateRecipe: Record<string, never>;
      FridgeSnap: Record<string, never>;
      UserProfile: { userId: string };
      FollowsList: {
        userId: string;
        activeTab: "following" | "followers";
        userName: string;
      };
      RecipeDetail: { recipeId: number };
      CollectionDetail: { collectionId: number };
      [key: string]: undefined;
    }
  }
}

const RootStack = createNativeStackNavigator({
  screens: {
    // Common screens
  },
  groups: {
    Onboarding: {
      if: useNeedsOnboarding,
      screenOptions: {
        headerShown: false,
        gestureEnabled: false, // Prevent swiping back
      },
      screens: {
        Onboarding: { screen: OnboardingScreen },
      },
    },
    SignedIn: {
      if: useIsSignedIn,
      screenOptions: {
        headerShown: false,
      },
      screens: {
        Tabs: TabNavigator,
        EditRecipe: { screen: EditRecipeScreen },
        GenerateRecipe: { screen: GenerateRecipeScreen },
        FridgeSnap: { screen: FridgeSnapScreen },
        EditProfile: { screen: EditProfileScreen },
        Settings: { screen: SettingsScreen },
        CuisinePreferences: { screen: CuisinePreferencesScreen },
        IngredientPreferences: { screen: IngredientPreferencesScreen },
        DietaryPreferences: { screen: DietaryPreferencesScreen },
        UserProfile: { screen: UserProfileScreen },
        FollowsList: { screen: FollowsScreen },
        RecipeDetail: { screen: RecipeDetailScreen },
        CollectionDetail: { screen: CollectionDetailScreen },
        AddRecipeToShoppingList: { screen: AddRecipeToShoppingListScreen },
      },
    },

    SignedOut: {
      if: useIsSignedOut,
      screenOptions: {
        headerShown: false,
      },
      screens: {
        Start: { screen: StartScreen },
      },
    },
  },
});

export const Navigation = createStaticNavigation(RootStack);
