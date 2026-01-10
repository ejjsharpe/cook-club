import { useCallback } from "react";
import {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
} from "react-native-reanimated";

interface UseAnimatedHeaderScrollOptions {
  /** Height of the collapsible title section */
  titleSectionHeight: number;
  /** Total header height (for list spacer) */
  headerHeight: number;
  /** Number of tabs */
  tabCount: number;
}

export const TAB_SWITCH_DELAY = 250;

export function useAnimatedHeaderScroll({
  titleSectionHeight,
  headerHeight,
  tabCount,
}: UseAnimatedHeaderScrollOptions) {
  const headerTranslateY = useSharedValue(0);
  const activeTabIndex = useSharedValue(0);
  const scrollPositions = useSharedValue<number[]>(Array(tabCount).fill(0));
  const tabSwitchedAt = useSharedValue(0);

  const handleTabSwitch = useCallback(
    (newTabIndex: number) => {
      activeTabIndex.value = newTabIndex;
      tabSwitchedAt.value = Date.now();

      const newTabScrollY = scrollPositions.value[newTabIndex] ?? 0;
      const targetY = -Math.min(Math.max(newTabScrollY, 0), titleSectionHeight);

      headerTranslateY.value = withSpring(targetY, {
        damping: 30,
        stiffness: 200,
        mass: 1,
      });
    },
    [
      activeTabIndex,
      headerTranslateY,
      scrollPositions,
      tabSwitchedAt,
      titleSectionHeight,
    ],
  );

  const headerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: headerTranslateY.value }],
  }));

  const titleAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      headerTranslateY.value,
      [0, -titleSectionHeight],
      [1, 0],
      "clamp",
    ),
  }));

  return {
    headerTranslateY,
    activeTabIndex,
    scrollPositions,
    tabSwitchedAt,
    titleSectionHeight,
    headerAnimatedStyle,
    titleAnimatedStyle,
    handleTabSwitch,
    headerHeight,
  };
}
