import { createNativeBottomTabNavigator } from '@bottom-tabs/react-navigation';
import { AppleIcon } from 'react-native-bottom-tabs';

import { MyRecipesScreen } from '@/screens/MyRecipesScreen';
import { SearchScreen } from '@/screens/SearchScreen';

const Tab = createNativeBottomTabNavigator();

export const TabNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: 'black',
      }}>
      <Tab.Screen
        name="Search"
        component={MyRecipesScreen}
        options={{
          tabBarIcon: (): AppleIcon => ({
            sfSymbol: 'magnifyingglass',
          }),
        }}
      />
      <Tab.Screen
        name="Add recipe"
        component={SearchScreen}
        options={{
          tabBarIcon: (): AppleIcon => ({
            sfSymbol: 'plus.app',
          }),
        }}
      />
      <Tab.Screen
        name="My Recipes"
        component={SearchScreen}
        options={{
          tabBarIcon: (): AppleIcon => ({
            sfSymbol: 'book.pages',
          }),
        }}
      />
    </Tab.Navigator>
  );
};
