import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";

import { FloatingTabBar } from "@/components/FloatingTabBar";
import { AddRecipeScreen } from "@/screens/AddRecipeScreen";
import { HomeScreen } from "@/screens/HomeScreen";
import { MyRecipesScreen } from "@/screens/MyRecipesScreen";
import { ShoppingListScreen } from "@/screens/ShoppingListScreen";

const Tab = createBottomTabNavigator();

export const TabNavigator = () => {
  return (
    <Tab.Navigator
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Add recipe" component={AddRecipeScreen} />
      <Tab.Screen name="My Recipes" component={MyRecipesScreen} />
      <Tab.Screen name="Shopping List" component={ShoppingListScreen} />
    </Tab.Navigator>
  );
};
