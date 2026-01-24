import { useCallback, useState } from "react";
import {
  useSharedValue,
  withTiming,
  Easing,
  type SharedValue,
} from "react-native-reanimated";

export type TabType = "recipes" | "collections";

const animationConfig = {
  duration: 250,
  easing: Easing.bezier(0.4, 0, 0.2, 1),
};

interface UseTabNavigationOptions {
  /** Initial tab to display */
  initialTab?: TabType;
  /** Callback when tab changes (for external animations like filter button) */
  onTabChange?: (tab: TabType, animationProgress: SharedValue<number>) => void;
}

export const useTabNavigation = ({
  initialTab = "recipes",
  onTabChange,
}: UseTabNavigationOptions = {}) => {
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const initialIndex = initialTab === "recipes" ? 0 : 1;
  const scrollProgress = useSharedValue(initialIndex);
  const activeTabIndex = useSharedValue(initialIndex);
  // Animation progress for tab-dependent animations (1 = recipes visible, 0 = collections visible)
  const tabAnimationProgress = useSharedValue(initialTab === "recipes" ? 1 : 0);

  const switchTab = useCallback(
    (tab: TabType) => {
      const newTabIndex = tab === "recipes" ? 0 : 1;
      setActiveTab(tab);
      activeTabIndex.value = newTabIndex;

      // Animate tab-dependent elements
      tabAnimationProgress.value = withTiming(
        tab === "recipes" ? 1 : 0,
        animationConfig,
      );

      onTabChange?.(tab, tabAnimationProgress);
    },
    [activeTabIndex, tabAnimationProgress, onTabChange],
  );

  const handleSwipeTabChange = useCallback(
    (index: number) => {
      switchTab(index === 0 ? "recipes" : "collections");
    },
    [switchTab],
  );

  // Numeric value for consumers that need it
  const activeTabIndexValue = activeTab === "recipes" ? 0 : 1;

  return {
    activeTab,
    activeTabIndex: activeTabIndexValue,
    activeTabIndexShared: activeTabIndex,
    scrollProgress,
    tabAnimationProgress,
    switchTab,
    handleSwipeTabChange,
  };
};
