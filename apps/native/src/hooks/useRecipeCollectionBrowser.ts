import { useCallback, useState } from "react";
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import { useAnimatedScrollHandler } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { useCollectionData } from "./useCollectionData";
import { useRecipeData } from "./useRecipeData";
import { useRecipeFilters } from "./useRecipeFilters";
import { useTabNavigation, type TabType } from "./useTabNavigation";

// Re-export types for consumers
export type { Recipe } from "./useRecipeData";
export type { CollectionWithMetadata } from "./useCollectionData";
export type { TabType } from "./useTabNavigation";

interface UseRecipeCollectionBrowserOptions {
  onTabBarScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  /** External search query - when provided, uses this instead of internal state */
  externalSearchQuery?: string;
}

export const useRecipeCollectionBrowser = ({
  onTabBarScroll,
  externalSearchQuery,
}: UseRecipeCollectionBrowserOptions = {}) => {
  // Search state
  const [internalSearchQuery, setInternalSearchQuery] = useState("");
  const searchQuery = externalSearchQuery ?? internalSearchQuery;
  const setSearchQuery = setInternalSearchQuery;

  // Compose tab navigation
  const {
    activeTab,
    activeTabIndex,
    scrollProgress,
    switchTab: baseSwitchTab,
  } = useTabNavigation();

  // Compose filters with tab-aware animation
  const {
    hasActiveFilters,
    handleOpenFilters,
    filterButtonProgress,
    filterButtonStyle,
    parsedTagIds,
    parsedMaxTotalTime,
    setFilterButtonVisible,
  } = useRecipeFilters();

  // Override switchTab to also animate filter button
  const switchTab = useCallback(
    (tab: TabType) => {
      baseSwitchTab(tab);
      setFilterButtonVisible(tab === "recipes");
    },
    [baseSwitchTab, setFilterButtonVisible],
  );

  const handleSwipeTabChange = useCallback(
    (index: number) => {
      const tab = index === 0 ? "recipes" : "collections";
      switchTab(tab);
    },
    [switchTab],
  );

  // Compose recipe data
  const {
    recipes,
    isPending: isPendingRecipes,
    error: recipesError,
    isFetchingNext: isFetchingNextRecipes,
    handleLoadMore: handleLoadMoreRecipes,
    refetch: refetchRecipes,
  } = useRecipeData({
    search: searchQuery,
    tagIds: parsedTagIds,
    maxTotalTime: parsedMaxTotalTime,
  });

  // Compose collection data
  const {
    collections,
    isPending: isPendingCollections,
    error: collectionsError,
    refetch: refetchCollections,
  } = useCollectionData({
    search: searchQuery,
  });

  // Coordinated refresh
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([refetchRecipes(), refetchCollections()]);
    setIsRefreshing(false);
  }, [refetchRecipes, refetchCollections]);

  // Scroll handlers that delegate to external callback
  const recipesScrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      "worklet";
      const offsetY = event.contentOffset.y;

      if (onTabBarScroll) {
        scheduleOnRN(onTabBarScroll, {
          nativeEvent: {
            contentOffset: { y: offsetY },
            contentSize: { height: event.contentSize.height },
            layoutMeasurement: { height: event.layoutMeasurement.height },
          },
        } as NativeSyntheticEvent<NativeScrollEvent>);
      }
    },
  });

  const collectionsScrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      "worklet";
      const offsetY = event.contentOffset.y;

      if (onTabBarScroll) {
        scheduleOnRN(onTabBarScroll, {
          nativeEvent: {
            contentOffset: { y: offsetY },
            contentSize: { height: event.contentSize.height },
            layoutMeasurement: { height: event.layoutMeasurement.height },
          },
        } as NativeSyntheticEvent<NativeScrollEvent>);
      }
    },
  });

  return {
    // Tab state
    activeTab,
    activeTabIndex,
    scrollProgress,
    switchTab,
    handleSwipeTabChange,

    // Search
    searchQuery,
    setSearchQuery,

    // Filters
    hasActiveFilters,
    handleOpenFilters,

    // Filter button animation
    filterButtonProgress,
    filterButtonStyle,

    // Scroll handlers
    recipesScrollHandler,
    collectionsScrollHandler,

    // Recipes data
    recipes,
    isPendingRecipes,
    recipesError,
    isFetchingNextRecipes,
    handleLoadMoreRecipes,

    // Collections data
    collections,
    isPendingCollections,
    collectionsError,

    // Refresh
    isRefreshing,
    handleRefresh,
  };
};
