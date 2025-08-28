import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { OpenBookIcon } from '@/components/svg/OpenBookIcon';
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
      <Tab.Screen name="Discover" component={DiscoverScreen} />
      <Tab.Screen name="Add recipe" component={AddRecipeScreen} />
      <Tab.Screen
        name="My Recipes"
        component={MyRecipesScreen}
        options={{
          tabBarIcon(props) {
            return <OpenBookIcon color={props.color} size={props.size} />;
          },
        }}
      />
    </Tab.Navigator>
  );
};
