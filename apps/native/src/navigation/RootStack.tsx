import {
  createStaticNavigation,
  type ParamListBase,
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
import { AccountScreen } from "@/screens/AccountScreen";
import { CollectionDetailScreen } from "@/screens/CollectionDetailScreen";
import { CookModeScreen } from "@/screens/CookModeScreen";
import { EditProfileScreen } from "@/screens/EditProfileScreen";
import EditRecipeScreen from "@/screens/EditRecipeScreen";
import { EmailVerificationScreen } from "@/screens/EmailVerificationScreen";
import { FollowsScreen } from "@/screens/FollowsScreen";
import FridgeSnapScreen from "@/screens/FridgeSnapScreen";
import GenerateRecipeScreen from "@/screens/GenerateRecipeScreen";
import { NotificationsScreen } from "@/screens/NotificationsScreen";
import { RecipeDetailScreen } from "@/screens/RecipeDetailScreen";
import { SettingsScreen } from "@/screens/SettingsScreen";
import { UserProfileScreen } from "@/screens/UserProfileScreen";

const StartScreen = lazy(() => import("@/screens/StartScreen"));
const OnboardingScreen = lazy(() => import("@/screens/OnboardingScreen"));

export interface AppParamList extends ParamListBase {
  Tabs: undefined;
  Home: undefined;
  Recipes: undefined;
  "Add recipe": undefined;
  "Meal Plan": undefined;
  "Shopping List": undefined;
  Start: undefined;
  Onboarding: undefined;
  EditProfile: undefined;
  Settings: undefined;
  Notifications: undefined;
  EditRecipe: { parsedRecipe?: ParsedRecipe };
  GenerateRecipe: undefined;
  FridgeSnap: undefined;
  UserProfile: { userId: string };
  FollowsList: {
    userId: string;
    activeTab: "following" | "followers";
    userName: string;
  };
  RecipeDetail: { recipeId: number } | { parsedRecipe: ParsedRecipe };
  CollectionDetail: { collectionId: number };
  Account: undefined;
  EmailVerification: { email: string };
  CookMode: {
    recipeName: string;
    instructionSections: {
      id: number;
      name: string | null;
      instructions: {
        id: number;
        instruction: string;
        imageUrl?: string | null;
      }[];
    }[];
  };
}

declare global {
  namespace ReactNavigation {
    interface RootParamList extends AppParamList {}
  }
}

const RootNavigator = createNativeStackNavigator<AppParamList>();
type RootNavigatorType = typeof RootNavigator;

declare module "@react-navigation/core" {
  interface RootNavigator extends RootNavigatorType {}
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
        Notifications: { screen: NotificationsScreen },
        UserProfile: { screen: UserProfileScreen },
        FollowsList: { screen: FollowsScreen },
        RecipeDetail: {
          screen: RecipeDetailScreen,
          options: {
            headerShown: true,
            headerTransparent: true,
            headerTitle: "",
            headerBackButtonDisplayMode: "minimal",
          },
        },
        CollectionDetail: { screen: CollectionDetailScreen },
        Account: { screen: AccountScreen },
        CookMode: {
          screen: CookModeScreen,
          options: {
            presentation: "fullScreenModal",
            animation: "slide_from_bottom",
          },
        },
      },
    },

    SignedOut: {
      if: useIsSignedOut,
      screenOptions: {
        headerShown: false,
      },
      screens: {
        Start: { screen: StartScreen },
        EmailVerification: { screen: EmailVerificationScreen },
      },
    },
  },
});

export const Navigation = createStaticNavigation(RootStack);
