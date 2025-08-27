import '@/styles/unistyles';
import { AlbertSans_400Regular, AlbertSans_700Bold } from '@expo-google-fonts/albert-sans';
import {
  LibreBaskerville_400Regular,
  LibreBaskerville_700Bold,
  LibreBaskerville_400Regular_Italic,
} from '@expo-google-fonts/libre-baskerville';
import { DefaultTheme } from '@react-navigation/native';
import { Asset } from 'expo-asset';
import { useFonts } from 'expo-font';
import { Image } from 'expo-image';
import * as Linking from 'expo-linking';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import startImage1 from '@/assets/images/start-food-1.jpg';
import startImage10 from '@/assets/images/start-food-10.jpg';
import startImage11 from '@/assets/images/start-food-11.jpg';
import startImage12 from '@/assets/images/start-food-12.jpg';
import startImage2 from '@/assets/images/start-food-2.jpg';
import startImage3 from '@/assets/images/start-food-3.jpg';
import startImage4 from '@/assets/images/start-food-4.jpg';
import startImage5 from '@/assets/images/start-food-5.jpg';
import startImage6 from '@/assets/images/start-food-6.jpg';
import startImage7 from '@/assets/images/start-food-7.jpg';
import startImage8 from '@/assets/images/start-food-8.jpg';
import startImage9 from '@/assets/images/start-food-9.jpg';
import { ReactQueryProvider } from '@/lib/reactQuery';
import { SignedInProvider } from '@/lib/signedInContext';
import { TRPCProvider } from '@/lib/trpc';
import { Navigation } from '@/navigation/RootStack';
import { SessionProvider } from '@/lib/sessionContext';
import { Text, TextComponent, View } from 'react-native';

SplashScreen.preventAutoHideAsync();

const prefix = Linking.createURL('/');
const linking = {
  prefixes: [prefix],
};

function cacheImages(images: any[]) {
  return Promise.all([
    images.map((image) => {
      if (typeof image === 'string') {
        Image.prefetch(image);
      } else {
        return Asset.fromModule(image).downloadAsync();
      }
    }),
  ]);
}

export default function App() {
  const [isFontsLoaded, isFontsError] = useFonts({
    AlbertSans_400Regular,
    AlbertSans_700Bold,
    LibreBaskerville_400Regular,
    LibreBaskerville_700Bold,
    LibreBaskerville_400Regular_Italic,
  });
  const isFontsReady = isFontsLoaded || isFontsError;
  const [isImagesReady, setIsImagesReady] = useState(false);
  const [isNavigationReady, setIsNavigationReady] = useState(false);

  useEffect(() => {
    const loadImages = async () => {
      await cacheImages([
        startImage1,
        startImage2,
        startImage3,
        startImage4,
        startImage5,
        startImage6,
        startImage7,
        startImage8,
        startImage9,
        startImage10,
        startImage11,
        startImage12,
      ]);
      setIsImagesReady(true);
    };
    loadImages();
  }, []);

  useEffect(() => {
    if (isFontsReady && isNavigationReady && isImagesReady) {
      SplashScreen.hideAsync();
    }
  }, [isFontsReady, isNavigationReady]);

  const onNavigationReady = () => setIsNavigationReady(true);

  if (!isFontsReady) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <ReactQueryProvider>
        <SessionProvider>
          <TRPCProvider>
            <SignedInProvider>
              <GestureHandlerRootView>
                <Navigation
                  onReady={onNavigationReady}
                  linking={linking}
                  theme={{
                    ...DefaultTheme,
                    colors: { ...DefaultTheme.colors, background: '#FFF' },
                  }}
                />
              </GestureHandlerRootView>
            </SignedInProvider>
          </TRPCProvider>
        </SessionProvider>
      </ReactQueryProvider>
    </SafeAreaProvider>
  );
}
