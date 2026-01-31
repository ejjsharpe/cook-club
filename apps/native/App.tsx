import "@/styles/unistyles";
import { DefaultTheme } from "@react-navigation/native";
import { Asset } from "expo-asset";
import { useFonts } from "expo-font";
import { Image } from "expo-image";
import * as Linking from "expo-linking";
import { ShareIntentProvider } from "expo-share-intent";
import * as SplashScreen from "expo-splash-screen";
import * as SystemUI from "expo-system-ui";
import React, { useEffect, useState, StrictMode } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StyleSheet, UnistylesRuntime } from "react-native-unistyles";

import startImage1 from "@/assets/images/start-food-1.jpg";
import startImage10 from "@/assets/images/start-food-10.jpg";
import startImage11 from "@/assets/images/start-food-11.jpg";
import startImage12 from "@/assets/images/start-food-12.jpg";
import startImage2 from "@/assets/images/start-food-2.jpg";
import startImage3 from "@/assets/images/start-food-3.jpg";
import startImage4 from "@/assets/images/start-food-4.jpg";
import startImage5 from "@/assets/images/start-food-5.jpg";
import startImage6 from "@/assets/images/start-food-6.jpg";
import startImage7 from "@/assets/images/start-food-7.jpg";
import startImage8 from "@/assets/images/start-food-8.jpg";
import startImage9 from "@/assets/images/start-food-9.jpg";
import { ShareIntentStorageHandler } from "@/components/ShareIntentStorageHandler";
import { ReactQueryProvider } from "@/lib/reactQuery";
import { SessionProvider } from "@/lib/sessionContext";
import { SignedInProvider } from "@/lib/signedInContext";
import { TRPCProvider } from "@/lib/trpc";
import { Navigation } from "@/navigation/RootStack";

SplashScreen.preventAutoHideAsync();
SystemUI.setBackgroundColorAsync(UnistylesRuntime.getTheme().colors.background);

const prefix = Linking.createURL("/");
const linking = {
  prefixes: [prefix],
};

function cacheImages(images: any[]) {
  return Promise.all([
    images.map((image) => {
      if (typeof image === "string") {
        Image.prefetch(image);
      } else {
        return Asset.fromModule(image).downloadAsync();
      }
    }),
  ]);
}

export default function App() {
  const [isFontsLoaded, isFontsError] = useFonts({
    "Satoshi-Regular": require("@/assets/fonts/Satoshi/Satoshi-Regular.otf"),
    "Satoshi-Bold": require("@/assets/fonts/Satoshi/Satoshi-Bold.otf"),
    "Satoshi-Black": require("@/assets/fonts/Satoshi/Satoshi-Black.otf"),
    "Satoshi-Italic": require("@/assets/fonts/Satoshi/Satoshi-Italic.otf"),
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
  }, [isFontsReady, isNavigationReady, isImagesReady]);

  const onNavigationReady = () => setIsNavigationReady(true);

  if (!isFontsReady) {
    return null;
  }

  const theme = UnistylesRuntime.getTheme();
  const themeName = UnistylesRuntime.themeName;

  const navigationTheme = {
    dark: themeName === "dark",
    fonts: DefaultTheme.fonts,
    colors: {
      primary: theme.colors.primary,
      background: theme.colors.background,
      card: theme.colors.background,
      text: theme.colors.text,
      border: theme.colors.border,
      notification: theme.colors.primary,
    },
  };

  return (
    <StrictMode>
      <SafeAreaProvider>
        <KeyboardProvider>
          <ShareIntentProvider>
            <ReactQueryProvider>
              <SessionProvider>
                <TRPCProvider>
                  <SignedInProvider>
                    <ShareIntentStorageHandler />
                    <GestureHandlerRootView style={styles.rootView}>
                      <Navigation
                        onReady={onNavigationReady}
                        linking={linking}
                        theme={navigationTheme}
                      />
                    </GestureHandlerRootView>
                  </SignedInProvider>
                </TRPCProvider>
              </SessionProvider>
            </ReactQueryProvider>
          </ShareIntentProvider>
        </KeyboardProvider>
      </SafeAreaProvider>
    </StrictMode>
  );
}

const styles = StyleSheet.create((theme) => ({
  rootView: { flex: 1, backgroundColor: theme.colors.background },
}));
