import { useCallback } from "react";
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";

export const useMealPlanHeader = () => {
  const titleOpacity = useSharedValue(1);
  const headerButtonsOpacity = useSharedValue(1);

  const titleAnimatedStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
  }));

  const headerButtonsAnimatedStyle = useAnimatedStyle(() => ({
    opacity: headerButtonsOpacity.value,
  }));

  // Regular scroll handler for header fade animations
  // FlashList handles infinite scroll via onStartReached/onEndReached
  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = event.nativeEvent.contentOffset.y;

      // Fade out when scrolling past the header
      const titleShouldHide = y > 5;
      titleOpacity.value = withTiming(titleShouldHide ? 0 : 1, {
        duration: 150,
      });

      const buttonsShouldHide = y > 10;
      headerButtonsOpacity.value = withTiming(buttonsShouldHide ? 0 : 1, {
        duration: 150,
      });
    },
    [titleOpacity, headerButtonsOpacity],
  );

  return {
    titleOpacity,
    headerButtonsOpacity,
    titleAnimatedStyle,
    headerButtonsAnimatedStyle,
    handleScroll,
  };
};
