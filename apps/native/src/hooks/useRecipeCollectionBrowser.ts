import { useCallback, useState } from "react";
import { useAnimatedScrollHandler } from "react-native-reanimated";

import { useCollectionData } from "./useCollectionData";
import { useRecipeData } from "./useRecipeData";
import { useRecipeFilters } from "./useRecipeFilters";
import { useTabNavigation, type TabType } from "./useTabNavigation";

// Re-export types for consumers
export type { Recipe } from "./useRecipeData";
export type { CollectionWithMetadata } from "./useCollectionData";
export type { TabType } from "./useTabNavigation";

interface UseRecipeCollectionBrowserOptions {
  /** External search query - when provided, uses this instead of internal state */
  externalSearchQuery?: string;
  /** Initial tab to display */
  initialTab?: TabType;
}

export const useRecipeCollectionBrowser = ({
  externalSearchQuery,
  initialTab,
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
  } = useTabNavigation({ initialTab });

  // Compose filters with tab-aware animation
  const {
    hasActiveFilters,
    filterButtonProgress,
    filterButtonStyle,
    parsedTagIds,
    parsedMaxTotalTime,
    setFilterButtonVisible,
    // Filter sheet props
    selectedTagIds,
    setSelectedTagIds,
    maxTotalTime,
    setMaxTotalTime,
    allTags,
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

  // Scroll handlers (native tab bar handles visibility automatically)
  const recipesScrollHandler = useAnimatedScrollHandler({
    onScroll: () => {
      "worklet";
      // Native tab bar handles minimize behavior automatically
    },
  });

  const collectionsScrollHandler = useAnimatedScrollHandler({
    onScroll: () => {
      "worklet";
      // Native tab bar handles minimize behavior automatically
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

    // Filter button animation
    filterButtonProgress,
    filterButtonStyle,

    // Filter sheet props (for rendering FilterSheet)
    filterSheetProps: {
      selectedTagIds,
      onTagsChange: setSelectedTagIds,
      maxTotalTime,
      onTimeChange: setMaxTotalTime,
      allTags,
    },

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
