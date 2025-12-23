import {
  createStaticNavigation,
  StaticParamList,
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Outputs } from "@repo/trpc/client";
import { lazy } from "react";

import { TabNavigator } from "./TabNavigator";

import { useIsSignedIn, useIsSignedOut } from "@/lib/signedInContext";
import { CollectionDetailScreen } from "@/screens/CollectionDetailScreen";
import { EditProfileScreen } from "@/screens/EditProfileScreen";
import EditRecipeScreen from "@/screens/EditRecipeScreen";
import { FollowsScreen } from "@/screens/FollowsScreen";
import GenerateRecipeScreen from "@/screens/GenerateRecipeScreen";
import { RecipeDetailScreen } from "@/screens/RecipeDetailScreen";
import { UserProfileScreen } from "@/screens/UserProfileScreen";

// Type for AI-parsed recipe result
type ParsedRecipeResult = Outputs["recipe"]["parseRecipeFromUrl"];

const StartScreen = lazy(() => import("@/screens/StartScreen"));
const SignUpScreen = lazy(() => import("@/screens/SignUpScreen"));
const SignInScreen = lazy(() => import("@/screens/SignInScreen"));

type RootStackParamList = StaticParamList<typeof RootStack>;

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {
      EditRecipe: { parsedRecipe?: ParsedRecipeResult };
      GenerateRecipe: Record<string, never>;
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
    SignedIn: {
      if: useIsSignedIn,
      screenOptions: {
        headerShown: false,
      },
      screens: {
        Tabs: TabNavigator,
        EditRecipe: { screen: EditRecipeScreen },
        GenerateRecipe: { screen: GenerateRecipeScreen },
        EditProfile: { screen: EditProfileScreen },
        UserProfile: { screen: UserProfileScreen },
        FollowsList: { screen: FollowsScreen },
        RecipeDetail: { screen: RecipeDetailScreen },
        CollectionDetail: { screen: CollectionDetailScreen },
      },
    },
    SignedOut: {
      if: useIsSignedOut,
      screenOptions: {
        headerShown: false,
      },
      screens: {
        Start: { screen: StartScreen },
        "Sign In": {
          screen: SignInScreen,
          options: {
            presentation: "formSheet",
            sheetAllowedDetents: "fitToContents",
            sheetGrabberVisible: true,
            sheetCornerRadius: 24,
          },
        },
        "Sign Up": {
          screen: SignUpScreen,
          options: {
            presentation: "formSheet",
            sheetAllowedDetents: "fitToContents",
            sheetGrabberVisible: true,
            sheetCornerRadius: 24,
          },
        },
      },
    },
  },
});

export const Navigation = createStaticNavigation(RootStack);
