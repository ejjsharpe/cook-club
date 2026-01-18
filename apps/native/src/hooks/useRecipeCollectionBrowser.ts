import { useCallback, useMemo, useState } from "react";
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import { SheetManager } from "react-native-actions-sheet";
import {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  useAnimatedScrollHandler,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { useGetUserCollectionsWithMetadata } from "@/api/collection";
import { useGetUserRecipes, useAllTags } from "@/api/recipe";

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
  onTabBarScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  /** External search query - when provided, uses this instead of internal state */
  externalSearchQuery?: string;
}

export const useRecipeCollectionBrowser = ({
  onTabBarScroll,
  externalSearchQuery,
}: UseRecipeCollectionBrowserOptions = {}) => {
  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>("recipes");
  const [internalSearchQuery, setInternalSearchQuery] = useState("");

  // Use external search query if provided, otherwise use internal
  const searchQuery = externalSearchQuery ?? internalSearchQuery;
  const setSearchQuery = setInternalSearchQuery;
  const scrollProgress = useSharedValue(0);
  const activeTabIndex = useSharedValue(0);

  const recipesScrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      "worklet";
      const offsetY = event.contentOffset.y;

      // Call external scroll handler if provided
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

      // Call external scroll handler if provided
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
      activeTabIndex.value = newTabIndex;

      // Animate filter button visibility
      filterButtonProgress.value = withTiming(
        tab === "recipes" ? 1 : 0,
        animationConfig,
      );
    },
    [activeTabIndex, filterButtonProgress],
  );

  // Derive activeTabIndex for consumers that need it as a number
  const activeTabIndexValue = activeTab === "recipes" ? 0 : 1;

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

  // Manual refresh state to avoid React Query's automatic state updates affecting other instances
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch recipes
  const {
    data: recipesData,
    fetchNextPage: fetchNextRecipes,
    hasNextPage: hasMoreRecipes,
    isFetchingNextPage: isFetchingNextRecipes,
    isPending: isPendingRecipes,
    refetch: refetchRecipes,
    error: recipesError,
  } = useGetUserRecipes({
    search: searchQuery,
    tagIds: selectedTagIds.length > 0 ? selectedTagIds : undefined,
    maxTotalTime: maxTotalTime ? parseInt(maxTotalTime, 10) : undefined,
  });

  // Fetch collections
  const {
    data: collectionsData,
    isPending: isPendingCollections,
    refetch: refetchCollections,
    error: collectionsError,
  } = useGetUserCollectionsWithMetadata({
    search: searchQuery,
  });

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([refetchRecipes(), refetchCollections()]);
    setIsRefreshing(false);
  }, [refetchRecipes, refetchCollections]);

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
    activeTabIndex: activeTabIndexValue,
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
