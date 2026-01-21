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

  const filterButtonStyle = useAnimatedStyle(() => ({
    opacity: filterButtonProgress.value,
    transform: [{ scale: 0.8 + 0.2 * filterButtonProgress.value }],
    width: 50 * filterButtonProgress.value,
    marginLeft: 12 * filterButtonProgress.value,
  }));

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
