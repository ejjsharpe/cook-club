import { useCallback, useMemo, useState } from "react";
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import { SheetManager } from "react-native-actions-sheet";
import {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  useAnimatedScrollHandler,
  runOnJS,
} from "react-native-reanimated";

import { useGetUserCollectionsWithMetadata } from "@/api/collection";
import { useGetUserRecipes, useAllTags } from "@/api/recipe";
import { useAnimatedHeaderScroll } from "@/hooks/useAnimatedHeaderScroll";

const SEARCH_ROW_HEIGHT = 50;
const TABS_HEIGHT = 16 + 50 + 16; // VSpace(16) + tabs + VSpace(16)

const animationConfig = {
  duration: 250,
  easing: Easing.bezier(0.4, 0, 0.2, 1),
};

export type Recipe = NonNullable<
  ReturnType<typeof useGetUserRecipes>["data"]
>["pages"][number]["items"][number];

export type CollectionWithMetadata = NonNullable<
  ReturnType<typeof useGetUserCollectionsWithMetadata>["data"]
>[number];

export type TabType = "recipes" | "collections";

interface UseRecipeCollectionBrowserOptions {
  titleSectionHeight: number;
  onTabBarScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
}

export const useRecipeCollectionBrowser = ({
  titleSectionHeight,
  onTabBarScroll,
}: UseRecipeCollectionBrowserOptions) => {
  const headerHeight = titleSectionHeight + SEARCH_ROW_HEIGHT + TABS_HEIGHT;

  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>("recipes");
  const [searchQuery, setSearchQuery] = useState("");
  const scrollProgress = useSharedValue(0);

  const activeTabIndex = activeTab === "recipes" ? 0 : 1;

  // Animated header
  const {
    headerAnimatedStyle,
    titleAnimatedStyle,
    createScrollCallback,
    handleTabSwitch,
  } = useAnimatedHeaderScroll({
    titleSectionHeight,
    headerHeight,
    tabCount: 2,
    activeTabIndex,
    onScroll: onTabBarScroll,
  });

  // Create scroll callbacks for each tab
  const handleRecipesScrollCallback = createScrollCallback(0);
  const handleCollectionsScrollCallback = createScrollCallback(1);

  const recipesScrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      runOnJS(handleRecipesScrollCallback)(
        event.contentOffset.y,
        event.contentSize.height,
        event.layoutMeasurement.height,
      );
    },
  });

  const collectionsScrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      runOnJS(handleCollectionsScrollCallback)(
        event.contentOffset.y,
        event.contentSize.height,
        event.layoutMeasurement.height,
      );
    },
  });

  // Filter state
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [maxTotalTime, setMaxTotalTime] = useState<string | undefined>();
  const { data: allTags } = useAllTags();

  // Filter button animation
  const filterButtonProgress = useSharedValue(1); // 1 = visible, 0 = hidden

  const filterButtonStyle = useAnimatedStyle(() => ({
    opacity: filterButtonProgress.value,
    transform: [{ scale: 0.8 + 0.2 * filterButtonProgress.value }],
    width: 50 * filterButtonProgress.value,
    marginLeft: 12 * filterButtonProgress.value,
  }));

  const switchTab = useCallback(
    (tab: TabType) => {
      const newTabIndex = tab === "recipes" ? 0 : 1;
      setActiveTab(tab);
      handleTabSwitch(newTabIndex);

      // Animate filter button visibility
      filterButtonProgress.value = withTiming(
        tab === "recipes" ? 1 : 0,
        animationConfig,
      );
    },
    [handleTabSwitch, filterButtonProgress],
  );

  const handleSwipeTabChange = useCallback(
    (index: number) => {
      switchTab(index === 0 ? "recipes" : "collections");
    },
    [switchTab],
  );

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

  // Fetch recipes
  const {
    data: recipesData,
    fetchNextPage: fetchNextRecipes,
    hasNextPage: hasMoreRecipes,
    isFetchingNextPage: isFetchingNextRecipes,
    isLoading: isLoadingRecipes,
    error: recipesError,
  } = useGetUserRecipes({
    search: searchQuery,
    tagIds: selectedTagIds.length > 0 ? selectedTagIds : undefined,
    maxTotalTime: maxTotalTime ? parseInt(maxTotalTime, 10) : undefined,
  });

  // Fetch collections
  const {
    data: collectionsData,
    isLoading: isLoadingCollections,
    error: collectionsError,
  } = useGetUserCollectionsWithMetadata({
    search: searchQuery,
  });

  const recipes = useMemo(() => {
    return recipesData?.pages.flatMap((page) => page?.items ?? []) ?? [];
  }, [recipesData]);

  const collections = useMemo(() => {
    return collectionsData ?? [];
  }, [collectionsData]);

  const handleLoadMoreRecipes = useCallback(() => {
    if (hasMoreRecipes && !isFetchingNextRecipes) {
      fetchNextRecipes();
    }
  }, [hasMoreRecipes, isFetchingNextRecipes, fetchNextRecipes]);

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

    // Header animation
    headerHeight,
    headerAnimatedStyle,
    titleAnimatedStyle,

    // Scroll handlers
    recipesScrollHandler,
    collectionsScrollHandler,

    // Recipes data
    recipes,
    isLoadingRecipes,
    recipesError,
    isFetchingNextRecipes,
    handleLoadMoreRecipes,

    // Collections data
    collections,
    isLoadingCollections,
    collectionsError,
  };
};
