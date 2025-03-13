import { createStaticNavigation, StaticParamList } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { lazy } from 'react';

import { TabNavigator } from './TabNavigator';

import { useIsSignedIn, useIsSignedOut } from '@/lib/signedInContext';

const StartScreen = lazy(() => import('@/screens/StartScreen'));
const SignUpScreen = lazy(() => import('@/screens/SignUpScreen'));
const SignInScreen = lazy(() => import('@/screens/SignInScreen'));

type RootStackParamList = StaticParamList<typeof RootStack>;

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}

const RootStack = createNativeStackNavigator({
  screens: {
    // Common screens
  },
  groups: {
    SignedIn: {
      if: useIsSignedIn,
      screens: {
        Tabs: TabNavigator,
      },
    },
    SignedOut: {
      if: useIsSignedOut,
      screenOptions: {
        headerShown: false,
      },
      screens: {
        Start: { screen: StartScreen },

        'Sign In': {
          screen: SignInScreen,
          options: {
            presentation: 'formSheet',
            sheetAllowedDetents: 'fitToContents',
            sheetGrabberVisible: true,
            sheetCornerRadius: 24,
          },
        },
        'Sign Up': {
          screen: SignUpScreen,
          options: {
            presentation: 'formSheet',
            sheetAllowedDetents: 'fitToContents',
            sheetGrabberVisible: true,
            sheetCornerRadius: 24,
          },
        },
      },
    },
  },
});

export const Navigation = createStaticNavigation(RootStack);
