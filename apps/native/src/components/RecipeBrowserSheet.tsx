import { Ionicons } from "@expo/vector-icons";
import { TrueSheet } from "@lodev09/react-native-true-sheet";
import {
  forwardRef,
  useState,
  useCallback,
  useImperativeHandle,
  useRef,
} from "react";
import {
  View,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  Dimensions,
} from "react-native";
import Animated from "react-native-reanimated";
import { StyleSheet, UnistylesRuntime } from "react-native-unistyles";

import { useGetCollectionDetail } from "../api/collection";
import { CollectionGridCard, GRID_GAP } from "./CollectionGridCard";
import { FilterSheet, type FilterSheetRef } from "./FilterBottomSheet";
import { RecipeCard } from "./RecipeCard";
import { SearchBar, SEARCH_BAR_HEIGHT } from "./SearchBar";
import { SegmentedControl, type TabOption } from "./SegmentedControl";
import { MyRecipesListSkeleton, CollectionsListSkeleton } from "./Skeleton";
import { SwipeableTabView } from "./SwipeableTabView";
import { Text } from "./Text";

import {
  useRecipeCollectionBrowser,
  type Recipe,
  type CollectionWithMetadata,
  type TabType,
} from "@/hooks/useRecipeCollectionBrowser";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const GRID_PADDING = 20;
const NUM_COLUMNS = 2;
const COLLECTION_CARD_WIDTH =
  (SCREEN_WIDTH - GRID_PADDING * 2 - GRID_GAP) / NUM_COLUMNS;

const TAB_OPTIONS: TabOption<TabType>[] = [
  { value: "recipes", label: "Recipes" },
  { value: "collections", label: "Collections" },
];

// Recipe type from collection detail (dates are serialized to strings via tRPC)
type CollectionRecipe = {
  id: number;
  name: string;
  cookTime: number | null;
  servings: number | null;
  sourceUrl: string | null;
  createdAt: string;
  images: { id: number; url: string }[];
};

const RecipeSeparator = () => (
  <View style={styles.separatorContainer}>
    <View style={styles.separator} />
  </View>
);

export interface RecipeBrowserSheetProps {
  /** Title displayed in the sheet header */
  title: string;
  /** Called when a recipe is selected. Return a promise to dismiss after completion. */
  onSelectRecipe: (recipeId: number) => Promise<void> | void;
  /** Called when the sheet is dismissed */
  onDismiss?: () => void;
}

export interface RecipeBrowserSheetRef {
  present: () => void;
  dismiss: () => void;
}

export const RecipeBrowserSheet = forwardRef<
  RecipeBrowserSheetRef,
  RecipeBrowserSheetProps
>(({ title, onSelectRecipe, onDismiss }, ref) => {
  const theme = UnistylesRuntime.getTheme();
  const sheetRef = useRef<TrueSheet>(null);
  const filterSheetRef = useRef<FilterSheetRef>(null);
  const [selectedCollectionId, setSelectedCollectionId] = useState<
    number | null
  >(null);
  const [isSelecting, setIsSelecting] = useState(false);

  // Use the composable hook directly
  const {
    activeTab,
    activeTabIndex,
    scrollProgress,
    switchTab,
    handleSwipeTabChange,
    searchQuery,
    setSearchQuery,
    hasActiveFilters,
    filterButtonStyle,
    searchBarWrapperStyle,
    filterSheetProps,
    recipes,
    isPendingRecipes,
    recipesError,
    isFetchingNextRecipes,
    handleLoadMoreRecipes,
    collections,
    isPendingCollections,
    collectionsError,
  } = useRecipeCollectionBrowser();

  useImperativeHandle(ref, () => ({
    present: () => sheetRef.current?.present(),
    dismiss: () => sheetRef.current?.dismiss(),
  }));

  const { data: collectionDetail, isLoading: isLoadingCollection } =
    useGetCollectionDetail({
      collectionId: selectedCollectionId ?? 0,
      enabled: selectedCollectionId !== null,
    });

  const handleClose = () => {
    sheetRef.current?.dismiss();
  };

  const handleDismiss = () => {
    // Reset state when sheet is dismissed
    setSelectedCollectionId(null);
    setSearchQuery("");
    onDismiss?.();
  };

  const handleOpenFilters = useCallback(() => {
    filterSheetRef.current?.present();
  }, []);

  const handleSelectRecipe = useCallback(
    async (recipeId: number) => {
      if (isSelecting) return;

      try {
        setIsSelecting(true);
        await onSelectRecipe(recipeId);
        sheetRef.current?.dismiss();
      } catch {
        // Error handled by caller
      } finally {
        setIsSelecting(false);
      }
    },
    [onSelectRecipe, isSelecting],
  );

  const handleRecipePress = useCallback(
    (recipe: Recipe) => {
      handleSelectRecipe(recipe.id);
    },
    [handleSelectRecipe],
  );

  const handleCollectionPress = useCallback((collectionId: number) => {
    setSelectedCollectionId(collectionId);
  }, []);

  const handleBackPress = useCallback(() => {
    setSelectedCollectionId(null);
  }, []);

  const handleTabChange = useCallback(
    (value: TabType, _direction: number) => {
      switchTab(value);
    },
    [switchTab],
  );

  const renderRecipe = useCallback(
    ({ item }: { item: Recipe }) => (
      <RecipeCard recipe={item} onPress={() => handleRecipePress(item)} />
    ),
    [handleRecipePress],
  );

  const renderCollectionRecipe = useCallback(
    ({ item }: { item: CollectionRecipe }) => (
      <RecipeCard
        recipe={{
          id: item.id,
          name: item.name,
          cookTime: item.cookTime,
          sourceUrl: item.sourceUrl,
          coverImage: item.images[0]?.url,
        }}
        onPress={() => handleSelectRecipe(item.id)}
      />
    ),
    [handleSelectRecipe],
  );

  const renderCollection = useCallback(
    ({ item, index }: { item: CollectionWithMetadata; index: number }) => {
      const isLeftColumn = index % 2 === 0;
      return (
        <View
          style={[
            styles.collectionItem,
            {
              marginLeft: isLeftColumn ? 0 : GRID_GAP / 2,
              marginRight: isLeftColumn ? GRID_GAP / 2 : 0,
            },
          ]}
        >
          <CollectionGridCard
            collection={item}
            onPress={() => handleCollectionPress(item.id)}
            width={COLLECTION_CARD_WIDTH}
          />
        </View>
      );
    },
    [handleCollectionPress],
  );

  // Render recipe list content
  const renderRecipesContent = () => {
    if (isPendingRecipes) {
      return (
        <View style={styles.stateContainer}>
          <MyRecipesListSkeleton />
        </View>
      );
    }

    if (recipesError) {
      return (
        <View style={styles.centered}>
          <Text type="subheadline" style={styles.centeredText}>
            Failed to load recipes
          </Text>
        </View>
      );
    }

    if (recipes.length === 0) {
      return (
        <View style={styles.centered}>
          <Ionicons
            name="restaurant-outline"
            size={48}
            style={styles.emptyIcon}
          />
          <Text type="subheadline" style={styles.centeredText}>
            {searchQuery
              ? "No recipes found for your search"
              : "You don't have any recipes yet"}
          </Text>
        </View>
      );
    }

    return (
      <FlatList
        data={recipes}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderRecipe}
        ItemSeparatorComponent={RecipeSeparator}
        contentContainerStyle={styles.recipeListContent}
        onEndReached={handleLoadMoreRecipes}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          isFetchingNextRecipes ? (
            <View style={styles.footer}>
              <ActivityIndicator />
            </View>
          ) : null
        }
      />
    );
  };

  // Render collections grid content
  const renderCollectionsContent = () => {
    if (isPendingCollections) {
      return (
        <View style={styles.stateContainer}>
          <CollectionsListSkeleton />
        </View>
      );
    }

    if (collectionsError) {
      return (
        <View style={styles.centered}>
          <Text type="subheadline" style={styles.centeredText}>
            Failed to load collections
          </Text>
        </View>
      );
    }

    if (collections.length === 0) {
      return (
        <View style={styles.centered}>
          <Ionicons name="albums-outline" size={48} style={styles.emptyIcon} />
          <Text type="subheadline" style={styles.centeredText}>
            {searchQuery
              ? "No collections found for your search"
              : "No collections yet"}
          </Text>
        </View>
      );
    }

    return (
      <FlatList
        data={collections}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderCollection}
        numColumns={2}
        contentContainerStyle={styles.collectionGridContent}
      />
    );
  };

  return (
    <TrueSheet
      ref={sheetRef}
      detents={[1]}
      grabber={false}
      backgroundColor={theme.colors.background}
      scrollable
      onDidDismiss={handleDismiss}
    >
      <View style={styles.container}>
        {selectedCollectionId !== null ? (
          // Collection drill-down view
          <View style={styles.container}>
            <View style={styles.collectionHeader}>
              <TouchableOpacity
                onPress={handleBackPress}
                style={styles.backButton}
              >
                <Ionicons
                  name="chevron-back"
                  size={24}
                  style={styles.backIcon}
                />
              </TouchableOpacity>
              <Text
                type="headline"
                numberOfLines={1}
                style={styles.collectionTitle}
              >
                {collectionDetail?.name ?? "Collection"}
              </Text>
              <TouchableOpacity
                onPress={handleClose}
                style={styles.closeButton}
              >
                <View style={styles.closeButtonCircle}>
                  <Ionicons name="close" size={16} style={styles.closeIcon} />
                </View>
              </TouchableOpacity>
            </View>
            {isLoadingCollection ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" />
              </View>
            ) : (
              <FlatList
                data={collectionDetail?.recipes ?? []}
                keyExtractor={(item) => item.id.toString()}
                renderItem={renderCollectionRecipe}
                ItemSeparatorComponent={RecipeSeparator}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <Ionicons
                      name="restaurant-outline"
                      size={48}
                      style={styles.emptyIcon}
                    />
                    <Text type="subheadline" style={styles.centeredText}>
                      No recipes in this collection yet
                    </Text>
                  </View>
                }
              />
            )}
          </View>
        ) : (
          // Main browser view with inline layout
          <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerSpacer} />
              <Text type="headline">{title}</Text>
              <TouchableOpacity
                onPress={handleClose}
                style={styles.closeButton}
              >
                <View style={styles.closeButtonCircle}>
                  <Ionicons name="close" size={16} style={styles.closeIcon} />
                </View>
              </TouchableOpacity>
            </View>

            {/* Search Row */}
            <View style={styles.searchRow}>
              <Animated.View
                style={[styles.searchBarWrapper, searchBarWrapperStyle]}
              >
                <SearchBar
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Search recipes..."
                />
              </Animated.View>
              <Animated.View
                style={[styles.filterButtonWrapper, filterButtonStyle]}
              >
                <TouchableOpacity
                  style={styles.filterButton}
                  onPress={handleOpenFilters}
                >
                  <Ionicons
                    name="options-outline"
                    size={22}
                    style={styles.filterIcon}
                  />
                  {hasActiveFilters && <View style={styles.filterBadge} />}
                </TouchableOpacity>
              </Animated.View>
            </View>

            {/* Tab Switcher */}
            <View style={styles.tabContainer}>
              <SegmentedControl
                options={TAB_OPTIONS}
                value={activeTab}
                onValueChange={handleTabChange}
                scrollProgress={scrollProgress}
                fullWidth
              />
            </View>

            {/* Content Area */}
            <View style={styles.contentContainer}>
              <SwipeableTabView
                activeIndex={activeTabIndex}
                onIndexChange={handleSwipeTabChange}
                containerWidth={SCREEN_WIDTH}
                scrollProgress={scrollProgress}
              >
                {renderRecipesContent()}
                {renderCollectionsContent()}
              </SwipeableTabView>
            </View>
          </View>
        )}
      </View>

      {/* Filter Sheet */}
      <FilterSheet ref={filterSheetRef} {...filterSheetProps} />
    </TrueSheet>
  );
});

const styles = StyleSheet.create((theme) => ({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerSpacer: {
    width: 30,
  },
  closeButton: {
    padding: 4,
  },
  closeButtonCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: theme.colors.inputBackground,
    justifyContent: "center",
    alignItems: "center",
  },
  closeIcon: {
    color: theme.colors.textSecondary,
  },

  // Search row styles
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 6,
  },
  searchBarWrapper: {
    flex: 1,
  },
  filterButtonWrapper: {
    marginLeft: 8,
  },
  filterButton: {
    width: SEARCH_BAR_HEIGHT,
    height: SEARCH_BAR_HEIGHT,
    borderRadius: SEARCH_BAR_HEIGHT / 2,
    backgroundColor: theme.colors.inputBackground,
    justifyContent: "center",
    alignItems: "center",
  },
  filterIcon: {
    color: theme.colors.text,
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

  // Tab container
  tabContainer: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },

  // Content area
  contentContainer: {
    flex: 1,
  },
  stateContainer: {
    flex: 1,
    paddingTop: 8,
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
    paddingHorizontal: 40,
  },
  emptyIcon: {
    color: theme.colors.textTertiary,
    marginBottom: 12,
  },

  // Recipe list
  recipeListContent: {
    paddingBottom: 40,
    flexGrow: 1,
  },
  footer: {
    paddingVertical: 20,
    alignItems: "center",
  },

  // Collection grid
  collectionGridContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  collectionItem: {
    flex: 1,
    marginBottom: GRID_GAP,
  },

  // Collection drill-down view
  collectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backButton: {
    marginRight: 8,
  },
  backIcon: {
    color: theme.colors.text,
  },
  collectionTitle: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  listContent: {
    paddingBottom: 40,
    flexGrow: 1,
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 60,
  },
  separatorContainer: {
    paddingHorizontal: 20,
  },
  separator: {
    height: 1,
    backgroundColor: theme.colors.border,
  },
}));
