import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import { AddRecipeScreen } from '@/screens/AddRecipeScreen';
import { MyRecipesScreen } from '@/screens/MyRecipesScreen';
import { DiscoverScreen } from '@/screens/DiscoverScreen';

const Tab = createBottomTabNavigator();

export const TabNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: 'black',
        headerShown: false,
      }}>
      <Tab.Screen
        name="Discover"
        component={DiscoverScreen}
        options={{
          tabBarIcon(props) {
            return <Ionicons name="search" color={props.color} size={props.size} />;
          },
        }}
      />
      <Tab.Screen
        name="Add recipe"
        component={AddRecipeScreen}
        options={{
          tabBarIcon(props) {
            return <Ionicons name="add" color={props.color} size={props.size} />;
          },
        }}
      />
      <Tab.Screen
        name="My Recipes"
        component={MyRecipesScreen}
        options={{
          tabBarIcon(props) {
            return <Ionicons name="book" color={props.color} size={props.size} />;
          },
        }}
      />
    </Tab.Navigator>
  );
};
