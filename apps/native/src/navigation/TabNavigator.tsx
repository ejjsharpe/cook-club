import { createNativeBottomTabNavigator } from '@bottom-tabs/react-navigation';
import { AppleIcon } from 'react-native-bottom-tabs';

import { OneTabScreen } from '@/screens/OneTabScreen';
import { TwoTabScreen } from '@/screens/TwoTabScreen';

const Tab = createNativeBottomTabNavigator();

export const TabNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: 'black',
      }}>
      <Tab.Screen
        name="One"
        component={OneTabScreen}
        options={{
          title: 'Tab One',
          tabBarIcon: (): AppleIcon => ({
            sfSymbol: 'house',
          }),
        }}
      />
      <Tab.Screen
        name="Two"
        component={TwoTabScreen}
        options={{
          title: 'Tab Two',
          tabBarIcon: (): AppleIcon => ({
            sfSymbol: 'gear',
          }),
        }}
      />
    </Tab.Navigator>
  );
};
