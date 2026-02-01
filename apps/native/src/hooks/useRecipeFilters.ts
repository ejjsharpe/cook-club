import { useCallback, useState } from "react";
import {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from "react-native-reanimated";

import { useAllTags } from "@/api/recipe";

const animationConfig = {
  duration: 250,
  easing: Easing.bezier(0.4, 0, 0.2, 1),
};

export const useRecipeFilters = () => {
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [maxTotalTime, setMaxTotalTime] = useState<string | undefined>();
  const { data: allTags } = useAllTags();

  // Filter button visibility animation (1 = visible, 0 = hidden)
  const filterButtonProgress = useSharedValue(1);

  // GPU-accelerated animation using transforms instead of layout properties
  const filterButtonStyle = useAnimatedStyle(() => {
    "worklet";
    const progress = filterButtonProgress.value;
    // Scale from 0.8 to 1 for a subtle size change
    const scale = 0.8 + 0.2 * progress;
    // Translate right as it fades out to simulate margin collapse
    const translateX = (1 - progress) * 58; // 50 (width) + 8 (margin)
    return {
      opacity: progress,
      transform: [{ translateX }, { scale }],
    };
  });

  // Animate search bar to expand when filter button hides
  const searchBarWrapperStyle = useAnimatedStyle(() => {
    "worklet";
    const progress = filterButtonProgress.value;
    // When filter visible (1): marginRight = 0
    // When filter hidden (0): marginRight = -58 (reclaim the space)
    return {
      marginRight: (1 - progress) * -58,
    };
  });

  const hasActiveFilters =
    selectedTagIds.length > 0 || maxTotalTime !== undefined;

  // Animate filter button visibility based on tab
  const setFilterButtonVisible = useCallback(
    (visible: boolean) => {
      filterButtonProgress.value = withTiming(visible ? 1 : 0, animationConfig);
    },
    [filterButtonProgress],
  );

  return {
    // Filter state
    selectedTagIds,
    setSelectedTagIds,
    maxTotalTime,
    setMaxTotalTime,
    hasActiveFilters,

    // Filter sheet props
    allTags: allTags ?? [],

    // Actions
    setFilterButtonVisible,

    // Animation
    filterButtonProgress,
    filterButtonStyle,
    searchBarWrapperStyle,

    // Parsed values for queries
    parsedTagIds: selectedTagIds.length > 0 ? selectedTagIds : undefined,
    parsedMaxTotalTime: maxTotalTime ? parseInt(maxTotalTime, 10) : undefined,
  };
};
