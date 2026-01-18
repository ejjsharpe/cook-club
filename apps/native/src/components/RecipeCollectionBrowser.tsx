import { Ionicons } from "@expo/vector-icons";
import { LegendList } from "@legendapp/list";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useEffect } from "react";
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import {
  View,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import Animated, { FadeIn as ReanimatedFadeIn } from "react-native-reanimated";
import { StyleSheet, UnistylesRuntime } from "react-native-unistyles";

import { CollectionGridCard, GRID_GAP } from "./CollectionGridCard";
import { CreateCollectionCard } from "./CreateCollectionCard";
import { RecipeCard } from "./RecipeCard";
import { SearchBar } from "./SearchBar";
import { SegmentedControl, type TabOption } from "./SegmentedControl";
import { MyRecipesListSkeleton, CollectionsListSkeleton } from "./Skeleton";
import { VSpace } from "./Space";
import { SwipeableTabView } from "./SwipeableTabView";
import { Text } from "./Text";

import {
  useRecipeCollectionBrowser,
  type Recipe,
  type CollectionWithMetadata,
  type TabType,
} from "@/hooks/useRecipeCollectionBrowser";

const AnimatedLegendList = Animated.createAnimatedComponent(LegendList) as <T>(
  props: React.ComponentProps<typeof LegendList<T>> & { entering?: any },
) => React.ReactElement;

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Special item type for the create collection button
type CreateCollectionItem = { id: "create"; type: "create" };
type CollectionListItem = CollectionWithMetadata | CreateCollectionItem;

const tabOptions: TabOption<TabType>[] = [
  { value: "recipes", label: "Recipes" },
  { value: "collections", label: "Collections" },
];

interface RecipeCollectionBrowserProps {
  onRecipePress: (recipe: Recipe) => void;
  onCollectionPress: (collectionId: number) => void;
  showCreateCollectionCard?: boolean;
  onCreateCollection?: () => void;
  isCreatingCollection?: boolean;
  recipesEmptyMessage?: string;
  onTabBarScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
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
}

export const RecipeCollectionBrowser = ({
  onRecipePress,
  onCollectionPress,
  showCreateCollectionCard = false,
  onCreateCollection,
  isCreatingCollection = false,
  recipesEmptyMessage = "No recipes in your library yet",
  onTabBarScroll,
  hideSearchBar = false,
  externalSearchQuery,
  onSearchQueryChange,
  onFilterStateChange,
}: RecipeCollectionBrowserProps) => {
  const theme = UnistylesRuntime.getTheme();

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
    isPendingRecipes: isLoadingRecipes,
    recipesError,
    isFetchingNextRecipes,
    handleLoadMoreRecipes,
    collections,
    isPendingCollections: isLoadingCollections,
    collectionsError,
    isRefreshing,
    handleRefresh,
  } = useRecipeCollectionBrowser({
    onTabBarScroll,
    externalSearchQuery,
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

  // Build collections list with optional create card
  const collectionsList: CollectionListItem[] = showCreateCollectionCard
    ? [{ id: "create", type: "create" } as CreateCollectionItem, ...collections]
    : collections;

  const renderRecipe = useCallback(
    ({ item }: { item: Recipe }) => (
      <RecipeCard recipe={item} onPress={() => onRecipePress(item)} />
    ),
    [onRecipePress],
  );

  const RecipeSeparator = () => (
    <View style={styles.separatorContainer}>
      <View style={styles.separator} />
    </View>
  );

  const renderCollection = useCallback(
    ({ item }: { item: CollectionListItem }) => {
      // Handle create collection item
      if ("type" in item && item.type === "create") {
        if (!onCreateCollection) return null;
        return (
          <CreateCollectionCard
            variant="grid"
            onPress={onCreateCollection}
            disabled={isCreatingCollection}
          />
        );
      }

      const collection = item as CollectionWithMetadata;
      return (
        <CollectionGridCard
          collection={collection}
          onPress={() => onCollectionPress(collection.id)}
        />
      );
    },
    [onCreateCollection, isCreatingCollection, onCollectionPress],
  );

  const renderRecipesEmpty = () => {
    if (recipesError) {
      return (
        <View style={styles.centered}>
          <Text type="subheadline" style={styles.centeredText}>
            Failed to load recipes
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.centered}>
        <Text type="subheadline" style={styles.centeredText}>
          {searchQuery
            ? "No recipes found for your search"
            : recipesEmptyMessage}
        </Text>
      </View>
    );
  };

  const renderCollectionsEmpty = () => {
    if (collectionsError) {
      return (
        <View style={styles.centered}>
          <Text type="subheadline" style={styles.centeredText}>
            Failed to load collections
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.centered}>
        <Text type="subheadline" style={styles.centeredText}>
          {searchQuery
            ? "No collections found for your search"
            : "No collections yet"}
        </Text>
      </View>
    );
  };

  const renderRecipesFooter = () => {
    if (!isFetchingNextRecipes) return null;
    return (
      <View style={styles.footer}>
        <ActivityIndicator />
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <SwipeableTabView
        activeIndex={activeTabIndex}
        onIndexChange={handleSwipeTabChange}
        containerWidth={SCREEN_WIDTH}
        scrollProgress={scrollProgress}
      >
        {isLoadingRecipes ? (
          <View style={styles.skeletonContainer}>
            <MyRecipesListSkeleton />
          </View>
        ) : (
          <AnimatedLegendList
            data={recipes}
            renderItem={renderRecipe}
            keyExtractor={(item) => item.id.toString()}
            onEndReached={handleLoadMoreRecipes}
            onEndReachedThreshold={0.5}
            ListHeaderComponent={ListHeaderSpacer}
            ListFooterComponent={renderRecipesFooter}
            ListEmptyComponent={renderRecipesEmpty}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            ItemSeparatorComponent={RecipeSeparator}
            onScroll={recipesScrollHandler}
            scrollEventThrottle={32}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={handleRefresh}
                tintColor={theme.colors.primary}
              />
            }
          />
        )}
        {isLoadingCollections ? (
          <View style={styles.skeletonContainer}>
            <CollectionsListSkeleton />
          </View>
        ) : (
          <AnimatedLegendList
            data={collectionsList}
            renderItem={renderCollection}
            keyExtractor={(item) => item.id.toString()}
            ListHeaderComponent={ListHeaderSpacer}
            ListEmptyComponent={
              showCreateCollectionCard ? undefined : renderCollectionsEmpty
            }
            showsVerticalScrollIndicator={false}
            numColumns={2}
            contentContainerStyle={styles.collectionsGridContent}
            columnWrapperStyle={styles.collectionsRow as any}
            onScroll={collectionsScrollHandler}
            scrollEventThrottle={20}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={handleRefresh}
                tintColor={theme.colors.primary}
              />
            }
          />
        )}
      </SwipeableTabView>
      <View style={styles.headerContainer}>
        <LinearGradient
          colors={[theme.colors.background, "#FFFFFFE6", "#FFFFFF00"]}
          style={styles.headerGradient}
          pointerEvents="none"
        />
        <View
          style={[
            styles.header,
            hideSearchBar && {
              paddingTop: UnistylesRuntime.insets.top + SEARCH_BAR_ROW_HEIGHT,
            },
          ]}
        >
          {!hideSearchBar && (
            <>
              <View style={[styles.searchRow, styles.headerPadded]}>
                <View style={styles.searchBarWrapper}>
                  <SearchBar
                    placeholder={
                      activeTab === "recipes"
                        ? "Search recipes..."
                        : "Search collections..."
                    }
                    value={searchQuery}
                    onChangeText={handleSearchChange}
                  />
                </View>
                <Animated.View
                  style={[styles.filterButtonWrapper, filterButtonStyle]}
                  pointerEvents={activeTab === "recipes" ? "auto" : "none"}
                >
                  <TouchableOpacity
                    style={styles.filterButton}
                    onPress={handleOpenFilters}
                  >
                    <Ionicons
                      name="options-outline"
                      size={22}
                      color={theme.colors.text}
                    />
                    {hasActiveFilters && <View style={styles.filterBadge} />}
                  </TouchableOpacity>
                </Animated.View>
              </View>
              <VSpace size={8} />
            </>
          )}
          <View style={styles.headerPadded}>
            <SegmentedControl
              options={tabOptions}
              value={activeTab}
              onValueChange={(tab) => switchTab(tab)}
              scrollProgress={scrollProgress}
              fullWidth
            />
          </View>
          <VSpace size={32} />
        </View>
      </View>
    </View>
  );
};

// Header content heights
// Full: search (50) + VSpace (8) + segmented (44) + VSpace (32) = 134
const HEADER_CONTENT_HEIGHT = 134;
const SEARCH_BAR_ROW_HEIGHT = 58; // search (50) + VSpace (8)

// Spacer component for list header (LegendList doesn't respect paddingTop in contentContainerStyle)
const ListHeaderSpacer = () => {
  const insets = UnistylesRuntime.insets;
  return <VSpace size={insets.top + HEADER_CONTENT_HEIGHT} />;
};

const styles = StyleSheet.create((theme, rt) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  headerContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  skeletonContainer: {
    flex: 1,
    paddingTop: rt.insets.top + HEADER_CONTENT_HEIGHT,
  },
  header: {
    paddingTop: rt.insets.top,
  },
  headerGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  headerPadded: {
    paddingHorizontal: 20,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  searchBarWrapper: {
    flex: 1,
  },
  filterButtonWrapper: {
    overflow: "hidden",
  },
  filterButton: {
    backgroundColor: theme.colors.inputBackground,
    borderRadius: theme.borderRadius.full,
    width: 50,
    height: 50,
    justifyContent: "center",
    alignItems: "center",
  },
  filterBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.primary,
  },
  listContent: {
    paddingBottom: rt.insets.bottom + 48,
    flexGrow: 1,
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
  footer: {
    paddingVertical: 20,
    alignItems: "center",
  },
  separatorContainer: {
    paddingVertical: 8,
    paddingLeft: 134, // 20 (card padding) + 100 (thumbnail) + 14 (gap)
    paddingRight: 20,
  },
  separator: {
    height: 1,
    backgroundColor: theme.colors.border,
  },
  collectionsGridContent: {
    paddingHorizontal: 30,
    paddingBottom: rt.insets.bottom + 48,
  },
  collectionsRow: {
    gap: GRID_GAP,
    marginBottom: GRID_GAP,
  },
}));
