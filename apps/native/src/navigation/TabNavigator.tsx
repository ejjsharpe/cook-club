import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";

import { FloatingTabBar } from "@/components/FloatingTabBar";
import { ShareIntentHandler } from "@/components/ShareIntentHandler";
import { TabBarProvider } from "@/lib/tabBarContext";
import { AddRecipeScreen } from "@/screens/AddRecipeScreen";
import { HomeScreen } from "@/screens/HomeScreen";
import { MealPlanScreen } from "@/screens/MealPlanScreen";
import { MyRecipesScreen } from "@/screens/MyRecipesScreen";
import { ShoppingListScreen } from "@/screens/ShoppingListScreen";

const Tab = createBottomTabNavigator();

export const TabNavigator = () => {
  return (
    <TabBarProvider>
      <ShareIntentHandler />
      <Tab.Navigator
        tabBar={(props) => <FloatingTabBar {...props} />}
        screenOptions={{
          headerShown: false,
        }}
      >
        <Tab.Screen name="Home" component={HomeScreen} />
        <Tab.Screen name="My Recipes" component={MyRecipesScreen} />
        <Tab.Screen name="Add recipe" component={AddRecipeScreen} />
        <Tab.Screen name="Meal Plan" component={MealPlanScreen} />
        <Tab.Screen name="Shopping List" component={ShoppingListScreen} />
      </Tab.Navigator>
    </TabBarProvider>
  );
};
