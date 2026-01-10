import {
  createContext,
  useContext,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import { useSharedValue, type SharedValue } from "react-native-reanimated";

interface TabBarContextType {
  isVisible: SharedValue<number>;
  setVisible: (visible: boolean) => void;
}

const TabBarContext = createContext<TabBarContextType | null>(null);

export const TabBarProvider = ({ children }: { children: ReactNode }) => {
  const isVisible = useSharedValue(1);

  const setVisible = useCallback(
    (visible: boolean) => {
      isVisible.value = visible ? 1 : 0;
    },
    [isVisible],
  );

  return (
    <TabBarContext.Provider value={{ isVisible, setVisible }}>
      {children}
    </TabBarContext.Provider>
  );
};

export const useTabBar = () => {
  const context = useContext(TabBarContext);
  if (!context) {
    throw new Error("useTabBar must be used within a TabBarProvider");
  }
  return context;
};

export const useTabBarScroll = () => {
  const { isVisible, setVisible } = useTabBar();
  const lastScrollY = useRef(0);
  const lastDirection = useRef(0); // 1 = down, -1 = up

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } =
        event.nativeEvent;
      const scrollY = contentOffset.y;
      const threshold = 10;

      // If content is too short to scroll, always show tab bar
      const isScrollable = contentSize.height > layoutMeasurement.height;
      if (!isScrollable) {
        if (isVisible.value !== 1) {
          setVisible(true);
        }
        return;
      }

      // Ignore top overscroll (negative values during bounce)
      if (scrollY < 0) {
        return;
      }

      // Near the top, always show tab bar (check FIRST before isNearBottom)
      const topThreshold = 100;
      if (scrollY < topThreshold) {
        if (isVisible.value !== 1) {
          setVisible(true);
        }
        lastScrollY.current = scrollY;
        lastDirection.current = 0;
        return;
      }

      const diff = scrollY - lastScrollY.current;

      // Detect if we're in the bottom bounce zone (or overscrolling past bottom)
      const maxScrollY = contentSize.height - layoutMeasurement.height;
      const isNearBottom = scrollY >= maxScrollY - 100;
      const isOverscrolling = scrollY > maxScrollY;

      // Ignore upward scroll events during bottom bounce/overscroll
      if ((isNearBottom || isOverscrolling) && diff < 0) {
        lastScrollY.current = scrollY;
        return;
      }

      if (Math.abs(diff) > threshold) {
        const direction = diff > 0 ? 1 : -1;

        if (direction !== lastDirection.current) {
          lastDirection.current = direction;
          // Hide when scrolling down, show when scrolling up
          setVisible(direction !== 1);
        }

        lastScrollY.current = scrollY;
      }
    },
    [isVisible, setVisible],
  );

  return { onScroll };
};
