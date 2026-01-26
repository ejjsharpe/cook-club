import { useCallback, useEffect } from "react";
import { View, Dimensions } from "react-native";
import Animated, {
  useAnimatedStyle,
  type SharedValue,
  type AnimatedRef,
} from "react-native-reanimated";
import { StyleSheet, UnistylesRuntime } from "react-native-unistyles";

import { CollectionGrid, type CollectionListItem } from "./CollectionGrid";
import { CollectionGridCard } from "./CollectionGridCard";
import { RecipeCard } from "./RecipeCard";
import {
  RecipeCollectionHeader,
  HEADER_CONTENT_HEIGHT,
} from "./RecipeCollectionHeader";
import { RecipeList } from "./RecipeList";
import { MyRecipesListSkeleton, CollectionsListSkeleton } from "./Skeleton";
import { SwipeableTabView } from "./SwipeableTabView";
import { Text } from "./Text";

import {
  useRecipeCollectionBrowser,
  type Recipe,
  type CollectionWithMetadata,
  type TabType,
} from "@/hooks/useRecipeCollectionBrowser";

// Re-export types for consumers
export type { Recipe, CollectionWithMetadata, TabType };

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface RecipeCollectionBrowserProps {
  onRecipePress: (recipe: Recipe) => void;
  onCollectionPress: (collectionId: number) => void;
  showCreateCollectionCard?: boolean;
  onCreateCollection?: () => void;
  isCreatingCollection?: boolean;
  recipesEmptyMessage?: string;
  /** Hide the search bar (when using external search bar) */
  hideSearchBar?: boolean;
  /** External search query to sync with internal state */
  externalSearchQuery?: string;
  /** Callback when internal search query changes */
  onSearchQueryChange?: (query: string) => void;
  /** Callback to receive filter state for external filter button rendering */
  onFilterStateChange?: (state: {
    hasActiveFilters: boolean;
    onOpenFilters: () => void;
    activeTab: TabType;
  }) => void;
  /** Animation progress for header entrance (0 = hidden, 1 = visible) */
  headerAnimationProgress?: SharedValue<number>;
  /** Initial tab to display */
  initialTab?: TabType;
  /** Ref attached to the first collection item for position measurement */
  firstCollectionRef?: AnimatedRef<Animated.View>;
}

export const RecipeCollectionBrowser = ({
  onRecipePress,
  onCollectionPress,
  showCreateCollectionCard = false,
  onCreateCollection,
  isCreatingCollection = false,
  recipesEmptyMessage = "No recipes in your library yet",
  hideSearchBar = false,
  externalSearchQuery,
  onSearchQueryChange,
  onFilterStateChange,
  headerAnimationProgress,
  initialTab,
  firstCollectionRef,
}: RecipeCollectionBrowserProps) => {
  const {
    activeTab,
    activeTabIndex,
    scrollProgress,
    switchTab,
    handleSwipeTabChange,
    searchQuery,
    setSearchQuery,
    hasActiveFilters,
    handleOpenFilters,
    filterButtonStyle,
    recipesScrollHandler,
    collectionsScrollHandler,
    recipes,
    isPendingRecipes,
    recipesError,
    isFetchingNextRecipes,
    handleLoadMoreRecipes,
    collections,
    isPendingCollections,
    collectionsError,
    isRefreshing,
    handleRefresh,
  } = useRecipeCollectionBrowser({
    externalSearchQuery,
    initialTab,
  });

  // Sync search query changes with parent if callback provided
  const handleSearchChange = useCallback(
    (query: string) => {
      setSearchQuery(query);
      onSearchQueryChange?.(query);
    },
    [setSearchQuery, onSearchQueryChange],
  );

  // Notify parent of filter state changes
  useEffect(() => {
    onFilterStateChange?.({
      hasActiveFilters,
      onOpenFilters: handleOpenFilters,
      activeTab,
    });
  }, [onFilterStateChange, hasActiveFilters, handleOpenFilters, activeTab]);

  // Hide list content until animation completes (prevents double recipe cards with overlay)
  const listEntranceStyle = useAnimatedStyle(() => {
    "worklet";
    if (!headerAnimationProgress) {
      return {};
    }
    return {
      opacity: headerAnimationProgress.value >= 1 ? 1 : 0,
    };
  });

  const insets = UnistylesRuntime.insets;
  const headerPaddingTop = insets.top + HEADER_CONTENT_HEIGHT;

  // Render item callbacks
  const renderRecipe = useCallback(
    ({ item }: { item: Recipe }) => (
      <RecipeCard recipe={item} onPress={() => onRecipePress(item)} />
    ),
    [onRecipePress],
  );

  const renderCollection = useCallback(
    ({ item }: { item: CollectionListItem }) => {
      // Create card is handled internally by CollectionGrid
      if ("type" in item && item.type === "create") {
        return null;
      }
      const collection = item as CollectionWithMetadata;
      return (
        <CollectionGridCard
          collection={collection}
          onPress={() => onCollectionPress(collection.id)}
        />
      );
    },
    [onCollectionPress],
  );

  // Render recipes tab content
  const renderRecipesContent = () => {
    if (isPendingRecipes) {
      return (
        <View style={[styles.stateContainer, { paddingTop: headerPaddingTop }]}>
          <MyRecipesListSkeleton />
        </View>
      );
    }

    if (recipesError) {
      return (
        <View style={[styles.centered, { paddingTop: headerPaddingTop }]}>
          <Text type="subheadline" style={styles.centeredText}>
            Failed to load recipes
          </Text>
        </View>
      );
    }

    if (recipes.length === 0) {
      return (
        <View style={[styles.centered, { paddingTop: headerPaddingTop }]}>
          <Text type="subheadline" style={styles.centeredText}>
            {searchQuery
              ? "No recipes found for your search"
              : recipesEmptyMessage}
          </Text>
        </View>
      );
    }

    return (
      <RecipeList
        recipes={recipes}
        renderItem={renderRecipe}
        onLoadMore={handleLoadMoreRecipes}
        isFetchingMore={isFetchingNextRecipes}
        onScroll={recipesScrollHandler}
        isRefreshing={isRefreshing}
        onRefresh={handleRefresh}
        headerHeight={HEADER_CONTENT_HEIGHT}
      />
    );
  };

  // Render collections tab content
  const renderCollectionsContent = () => {
    if (isPendingCollections) {
      return (
        <View style={[styles.stateContainer, { paddingTop: headerPaddingTop }]}>
          <CollectionsListSkeleton />
        </View>
      );
    }

    if (collectionsError) {
      return (
        <View style={[styles.centered, { paddingTop: headerPaddingTop }]}>
          <Text type="subheadline" style={styles.centeredText}>
            Failed to load collections
          </Text>
        </View>
      );
    }

    // Show empty state only if not showing create card
    if (collections.length === 0 && !showCreateCollectionCard) {
      return (
        <View style={[styles.centered, { paddingTop: headerPaddingTop }]}>
          <Text type="subheadline" style={styles.centeredText}>
            {searchQuery
              ? "No collections found for your search"
              : "No collections yet"}
          </Text>
        </View>
      );
    }

    return (
      <CollectionGrid
        collections={collections}
        renderItem={renderCollection}
        showCreateCard={showCreateCollectionCard}
        onCreateCollection={onCreateCollection}
        isCreatingCollection={isCreatingCollection}
        onScroll={collectionsScrollHandler}
        isRefreshing={isRefreshing}
        onRefresh={handleRefresh}
        headerHeight={HEADER_CONTENT_HEIGHT}
        firstItemRef={firstCollectionRef}
      />
    );
  };

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.listWrapper, listEntranceStyle]}>
        <SwipeableTabView
          activeIndex={activeTabIndex}
          onIndexChange={handleSwipeTabChange}
          containerWidth={SCREEN_WIDTH}
          scrollProgress={scrollProgress}
        >
          {renderRecipesContent()}
          {renderCollectionsContent()}
        </SwipeableTabView>
      </Animated.View>
      <RecipeCollectionHeader
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        hideSearchBar={hideSearchBar}
        activeTab={activeTab}
        onTabChange={switchTab}
        scrollProgress={scrollProgress}
        hasActiveFilters={hasActiveFilters}
        onOpenFilters={handleOpenFilters}
        filterButtonStyle={filterButtonStyle}
        headerAnimationProgress={headerAnimationProgress}
      />
    </View>
  );
};

const styles = StyleSheet.create((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  listWrapper: {
    flex: 1,
  },
  stateContainer: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  centeredText: {
    textAlign: "center",
    color: theme.colors.textSecondary,
  },
}));
