import { Text } from "react-native";
import Animated, { FadeInUp, FadeOutUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet } from "react-native-unistyles";

import { useIsOnline } from "@/lib/onlineManager";

export const OfflineIndicator = () => {
  const isOnline = useIsOnline();
  const insets = useSafeAreaInsets();

  if (isOnline) return null;

  return (
    <Animated.View
      entering={FadeInUp}
      exiting={FadeOutUp}
      style={[styles.container, { top: insets.top }]}
    >
      <Text style={styles.text}>You're offline</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create((theme) => ({
  container: {
    position: "absolute",
    left: 0,
    right: 0,
    backgroundColor: theme.colors.primary,
    paddingVertical: 8,
    alignItems: "center",
    zIndex: 1000,
    minHeight: 44,
  },
  text: {
    color: theme.colors.background,
    fontSize: 14,
    fontFamily: theme.fonts.medium,
  },
}));
