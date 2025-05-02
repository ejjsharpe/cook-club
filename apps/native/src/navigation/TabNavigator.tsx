import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { MyRecipesScreen } from '@/screens/MyRecipesScreen';
import { SearchScreen } from '@/screens/SearchScreen';

const Tab = createBottomTabNavigator();

export const TabNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: 'black',
      }}>
      <Tab.Screen name="Search" component={MyRecipesScreen} />
      <Tab.Screen name="Add recipe" component={SearchScreen} />
      <Tab.Screen name="My Recipes" component={SearchScreen} />
    </Tab.Navigator>
  );
};
