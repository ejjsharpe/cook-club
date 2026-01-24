import { useCallback, useState } from "react";
import { SheetManager } from "react-native-actions-sheet";
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
    const translateX = (1 - progress) * 62; // 50 (width) + 12 (margin)
    return {
      opacity: progress,
      transform: [{ translateX }, { scale }],
    };
  });

  const handleOpenFilters = useCallback(() => {
    SheetManager.show("filter-sheet", {
      payload: {
        selectedTagIds,
        onTagsChange: setSelectedTagIds,
        maxTotalTime,
        onTimeChange: setMaxTotalTime,
        allTags: allTags ?? [],
      },
    });
  }, [selectedTagIds, maxTotalTime, allTags]);

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
    maxTotalTime,
    hasActiveFilters,

    // Actions
    handleOpenFilters,
    setFilterButtonVisible,

    // Animation
    filterButtonProgress,
    filterButtonStyle,

    // Parsed values for queries
    parsedTagIds: selectedTagIds.length > 0 ? selectedTagIds : undefined,
    parsedMaxTotalTime: maxTotalTime ? parseInt(maxTotalTime, 10) : undefined,
  };
};
