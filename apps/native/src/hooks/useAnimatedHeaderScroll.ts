import { useCallback, useRef } from "react";
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
  /** Current active tab index */
  activeTabIndex: number;
  /** Optional callback for external scroll handling (e.g., tab bar visibility) */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onScroll?: (event: any) => void;
}

const TAB_SWITCH_DELAY = 250;

export function useAnimatedHeaderScroll({
  titleSectionHeight,
  headerHeight,
  tabCount,
  activeTabIndex,
  onScroll,
}: UseAnimatedHeaderScrollOptions) {
  const headerTranslateY = useSharedValue(0);
  const scrollPositions = useRef<number[]>(Array(tabCount).fill(0));
  const tabSwitchedAt = useRef(0);

  // Creates a scroll callback for a specific tab - use this inside useAnimatedScrollHandler
  const createScrollCallback = useCallback(
    (tabIndex: number) => {
      return (
        offsetY: number,
        contentHeight?: number,
        layoutHeight?: number,
      ) => {
        // Always track scroll position even when not active
        scrollPositions.current[tabIndex] = offsetY;

        if (activeTabIndex !== tabIndex) {
          return;
        }

        if (Date.now() - tabSwitchedAt.current < TAB_SWITCH_DELAY) {
          return;
        }

        headerTranslateY.value = -Math.min(
          Math.max(offsetY, 0),
          titleSectionHeight,
        );

        if (
          onScroll &&
          contentHeight !== undefined &&
          layoutHeight !== undefined
        ) {
          onScroll({
            nativeEvent: {
              contentOffset: { y: offsetY },
              contentSize: { height: contentHeight },
              layoutMeasurement: { height: layoutHeight },
            },
          });
        }
      };
    },
    [activeTabIndex, headerTranslateY, titleSectionHeight, onScroll],
  );

  const handleTabSwitch = useCallback(
    (newTabIndex: number) => {
      tabSwitchedAt.current = Date.now();

      const newTabScrollY = scrollPositions.current[newTabIndex] ?? 0;
      const targetY = -Math.min(Math.max(newTabScrollY, 0), titleSectionHeight);

      headerTranslateY.value = withSpring(targetY, {
        damping: 30,
        stiffness: 200,
        mass: 1,
      });
    },
    [headerTranslateY, titleSectionHeight],
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
    headerAnimatedStyle,
    titleAnimatedStyle,
    createScrollCallback,
    handleTabSwitch,
    headerHeight,
  };
}
