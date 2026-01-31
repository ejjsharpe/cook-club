import { createNativeBottomTabNavigator } from "@react-navigation/bottom-tabs/unstable";
import { UnistylesRuntime } from "react-native-unistyles";

import { ShareIntentHandler } from "@/components/ShareIntentHandler";
import { AddRecipeScreen } from "@/screens/AddRecipeScreen";
import { HomeScreen } from "@/screens/HomeScreen";
import { MealPlanScreen } from "@/screens/MealPlanScreen";
import { MyRecipesScreen } from "@/screens/MyRecipesScreen";
import { ShoppingListScreen } from "@/screens/ShoppingListScreen";

const Tab = createNativeBottomTabNavigator();

export const TabNavigator = () => {
  const theme = UnistylesRuntime.getTheme();
  return (
    <>
      <ShareIntentHandler />
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: theme.colors.primary,
          // lazy: false,
        }}
      >
        <Tab.Screen
          name="Home"
          component={HomeScreen}
          options={{
            tabBarIcon: { type: "sfSymbol", name: "house.fill" },
          }}
        />
        <Tab.Screen
          name="My Recipes"
          component={MyRecipesScreen}
          options={{
            tabBarIcon: { type: "sfSymbol", name: "book.fill" },
          }}
        />
        <Tab.Screen
          name="Add recipe"
          component={AddRecipeScreen}
          options={{
            tabBarIcon: { type: "sfSymbol", name: "plus.circle.fill" },
          }}
        />
        <Tab.Screen
          name="Meal Plan"
          component={MealPlanScreen}
          options={{
            tabBarLabelVisibilityMode: "selected",

            tabBarIcon: { type: "sfSymbol", name: "calendar" },
          }}
        />
        <Tab.Screen
          name="Shopping List"
          component={ShoppingListScreen}
          options={{
            tabBarLabelVisibilityMode: "selected",

            tabBarIcon: { type: "sfSymbol", name: "cart.fill" },
          }}
        />
      </Tab.Navigator>
    </>
  );
};
