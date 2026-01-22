import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useCallback, useMemo, useRef, useState, useEffect, memo } from "react";
import {
  View,
  Alert,
  Pressable,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Dimensions,
  type TextInput,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedRef,
  useAnimatedScrollHandler,
  measure,
  withTiming,
  interpolate,
  Easing,
  type SharedValue,
} from "react-native-reanimated";
import { StyleSheet, UnistylesRuntime } from "react-native-unistyles";
import { scheduleOnRN, scheduleOnUI } from "react-native-worklets";

import {
  useCreateCollection,
  useGetUserCollectionsWithMetadata,
} from "@/api/collection";
import { useGetUserRecipes, type RecipeListItem } from "@/api/recipe";
import { CollectionGridCard } from "@/components/CollectionGridCard";
import { CreateCollectionCard } from "@/components/CreateCollectionCard";
import { RecipeCard } from "@/components/RecipeCard";
import { RecipeCollectionBrowser } from "@/components/RecipeCollectionBrowser";
import { SearchBar } from "@/components/SearchBar";
import { VSpace } from "@/components/Space";
import { Text } from "@/components/Text";
import type {
  Recipe,
  CollectionWithMetadata,
  TabType,
} from "@/hooks/useRecipeCollectionBrowser";
import { useTabBarScroll } from "@/lib/tabBarContext";

// ─── Constants ───────────────────────────────────────────────────────────────
const { width: SCREEN_WIDTH } = Dimensions.get("window");
const HORIZONTAL_PADDING = 20;
const HEADER_HEIGHT = 52;
const COLLECTION_CARD_WIDTH = 140;
const BACK_BUTTON_WIDTH = 44;
const BACK_BUTTON_GAP = 12;
const FILTER_BUTTON_SIZE = 50;
const FILTER_BUTTON_GAP = 12;

// Search mode layout constants (from RecipeCollectionBrowser)
const SEARCH_HEADER_CONTENT_HEIGHT = 134; // search (50) + VSpace (8) + segmented (44) + VSpace (32)
const RECIPE_CARD_HEIGHT = 100;
const RECIPE_SEPARATOR_HEIGHT = 17; // 8px padding + 1px line + 8px padding

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);

// Static separator component - defined outside to avoid recreation
const CollectionSeparator = () => <View style={styles.collectionSeparator} />;

// ─── Animated Recipe Overlay ─────────────────────────────────────────────────
interface AnimatedRecipeOverlayProps {
  recipe: RecipeListItem;
  browseY: number;
  searchY: number;
  searchProgress: SharedValue<number>;
  isVisible: SharedValue<boolean>;
}

const AnimatedRecipeOverlay = memo(function AnimatedRecipeOverlay({
  recipe,
  browseY,
  searchY,
  searchProgress,
  isVisible,
}: AnimatedRecipeOverlayProps) {
  // Use transform instead of top for GPU-accelerated animation
  const deltaY = searchY - browseY;

  // Memoize static top position style to avoid recreation on each render
  const topStyle = useMemo(() => ({ top: browseY }), [browseY]);

  const animatedStyle = useAnimatedStyle(() => {
    "worklet";
    const translateY = interpolate(searchProgress.value, [0, 1], [0, deltaY]);
    return {
      transform: [{ translateY }],
      // Visible during animation cycle, hidden when idle or when search fully active
      opacity: isVisible.value && searchProgress.value < 1 ? 1 : 0,
    };
  });

  return (
    <Animated.View
      style={[styles.recipeOverlay, topStyle, animatedStyle]}
      pointerEvents="none"
    >
      <RecipeCard recipe={recipe} />
    </Animated.View>
  );
});

export const MyRecipesScreen = () => {
  const navigation = useNavigation();
  const { onScroll: onTabBarScroll } = useTabBarScroll();
  const insets = UnistylesRuntime.insets;

  // ─── State ────────────────────────────────────────────────────────────────────
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<TextInput>(null);

  // Filter state from RecipeCollectionBrowser
  const [filterState, setFilterState] = useState<{
    hasActiveFilters: boolean;
    onOpenFilters: () => void;
    activeTab: TabType;
  } | null>(null);

  // Track the search bar's Y position relative to the screen
  const searchBarRef = useAnimatedRef<Animated.View>();
  const searchBarY = useSharedValue(0);

  // Recipe card position tracking for shared element transition
  const firstRecipeRef = useAnimatedRef<Animated.View>();
  const browsePositions = useRef<{ id: number; y: number }[]>([]);

  // Animation progress (0 = browse, 1 = search)
  const searchProgress = useSharedValue(0);
  // Tracks whether floating search should be visible (true during entire animation cycle)
  const isFloatingVisible = useSharedValue(false);

  // Scroll-based title fade (like HomeScreen)
  const titleOpacity = useSharedValue(1);

  // Filter button visibility (1 = visible on recipes tab, 0 = hidden on collections tab)
  const filterButtonProgress = useSharedValue(1);

  // Target Y position for search mode (matching RecipeCollectionBrowser's search bar)
  const searchModeY = insets.top;

  // Calculate search mode target Y position for a recipe at given index
  // ListHeaderSpacer always uses insets.top + HEADER_CONTENT_HEIGHT (134)
  const getSearchTargetY = useCallback(
    (index: number) => {
      const headerHeight = insets.top + SEARCH_HEADER_CONTENT_HEIGHT;
      return (
        headerHeight + index * (RECIPE_CARD_HEIGHT + RECIPE_SEPARATOR_HEIGHT)
      );
    },
    [insets.top],
  );

  const animationConfig = useMemo(
    () => ({
      duration: 300,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
    }),
    [],
  );

  useEffect(() => {
    if (isSearchActive) {
      isFloatingVisible.value = true;
      searchProgress.value = withTiming(1, animationConfig);
      searchInputRef.current?.focus();
    } else {
      searchInputRef.current?.blur();
      searchProgress.value = withTiming(0, animationConfig, (finished) => {
        "worklet";
        if (finished) {
          isFloatingVisible.value = false;
        }
      });
    }
  }, [isSearchActive, animationConfig, searchProgress, isFloatingVisible]);

  // Animate filter button visibility based on active tab
  useEffect(() => {
    if (filterState) {
      filterButtonProgress.value = withTiming(
        filterState.activeTab === "recipes" ? 1 : 0,
        animationConfig,
      );
    }
  }, [filterState?.activeTab, filterButtonProgress, animationConfig]);

  // ─── Data Fetching ─────────────────────────────────────────────────────────────
  const createCollectionMutation = useCreateCollection();

  // Collections for horizontal list
  const { data: collectionsData } = useGetUserCollectionsWithMetadata({
    search: "",
  });
  const collections = (collectionsData ?? []) as CollectionWithMetadata[];

  // Memoize collections list with create button to avoid recreating array every render
  const collectionsWithCreate = useMemo(
    () =>
      [{ id: "create", type: "create" } as const, ...collections] as (
        | CollectionWithMetadata
        | { id: "create"; type: "create" }
      )[],
    [collections],
  );

  // Recent recipes (first 5)
  const { data: recentRecipesData } = useGetUserRecipes({ limit: 5 });
  const recentRecipes = useMemo(() => {
    return recentRecipesData?.pages[0]?.items?.slice(0, 5) ?? [];
  }, [recentRecipesData]);

  // ─── Handlers ─────────────────────────────────────────────────────────────────
  const handleRecipePress = useCallback(
    (recipe: Recipe | RecipeListItem) => {
      navigation.navigate("RecipeDetail", { recipeId: recipe.id });
    },
    [navigation],
  );

  const handleCollectionPress = useCallback(
    (collectionId: number) => {
      navigation.navigate("CollectionDetail", { collectionId });
    },
    [navigation],
  );

  const handleCreateCollection = useCallback(() => {
    Alert.prompt(
      "New Collection",
      "Enter a name for your collection",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Create",
          onPress: (collectionName?: string) => {
            const trimmedName = collectionName?.trim();
            if (!trimmedName) {
              Alert.alert("Error", "Collection name cannot be empty");
              return;
            }
            createCollectionMutation.mutate({ name: trimmedName });
          },
        },
      ],
      "plain-text",
    );
  }, [createCollectionMutation]);

  const handleSearchFocus = useCallback(() => {
    // Helper to store positions and start animation (called from RN thread)
    const startAnimation = (positions: { id: number; y: number }[]) => {
      browsePositions.current = positions;
      setIsSearchActive(true);
    };

    // Measure search bar and first recipe card on UI thread
    scheduleOnUI(() => {
      "worklet";
      // Measure search bar position
      const searchBarMeasurement = measure(searchBarRef);
      if (searchBarMeasurement && searchBarMeasurement.pageY > 0) {
        searchBarY.value = searchBarMeasurement.pageY;
      }

      // Measure first recipe card and calculate all positions
      const recipeMeasurement = measure(firstRecipeRef);
      if (recipeMeasurement && recipeMeasurement.pageY > 0) {
        const positions = recentRecipes.map((recipe, index) => ({
          id: recipe.id,
          y: recipeMeasurement.pageY + index * (RECIPE_CARD_HEIGHT + 12),
        }));
        scheduleOnRN(startAnimation, positions);
      } else {
        scheduleOnRN(startAnimation, []);
      }
    });
  }, [searchBarRef, searchBarY, recentRecipes, firstRecipeRef]);

  const handleExitSearch = useCallback(() => {
    setIsSearchActive(false);
    setSearchQuery("");
  }, []);

  // Memoized renderItem for collections FlatList
  const renderCollectionItem = useCallback(
    ({
      item,
    }: {
      item: CollectionWithMetadata | { id: "create"; type: "create" };
    }) => {
      if ("type" in item && item.type === "create") {
        return (
          <CreateCollectionCard
            variant="grid"
            onPress={handleCreateCollection}
            disabled={createCollectionMutation.isPending}
            width={COLLECTION_CARD_WIDTH}
          />
        );
      }
      const collection = item as CollectionWithMetadata;
      return (
        <CollectionGridCard
          collection={collection}
          onPress={() => handleCollectionPress(collection.id)}
          width={COLLECTION_CARD_WIDTH}
        />
      );
    },
    [
      handleCreateCollection,
      createCollectionMutation.isPending,
      handleCollectionPress,
    ],
  );

  // ─── Scroll Handler with Title Fade ────────────────────────────────────────────
  const handleScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      "worklet";
      // Fade out title when scrolling up (search bar would collide with header)
      const titleShouldHide = event.contentOffset.y > 5;
      titleOpacity.value = withTiming(titleShouldHide ? 0 : 1, {
        duration: 150,
      });
    },
  });

  // ─── Animation Styles ─────────────────────────────────────────────────────────
  // Browse view fades with animation (title, collections visible during transition)
  const browseAnimatedStyle = useAnimatedStyle(() => {
    "worklet";
    return {
      opacity: interpolate(searchProgress.value, [0, 0.5], [1, 0]),
    };
  });

  // Search view fades with animation progress
  const searchAnimatedStyle = useAnimatedStyle(() => {
    "worklet";
    return {
      opacity: searchProgress.value,
    };
  });

  // Recipe cards stay hidden until animation fully completes (overlays handle the transition)
  const recipeCardsStyle = useAnimatedStyle(() => {
    "worklet";
    return {
      opacity: isFloatingVisible.value ? 0 : 1,
    };
  });

  const titleAnimatedStyle = useAnimatedStyle(() => {
    "worklet";
    return {
      opacity: titleOpacity.value,
    };
  });

  // Floating search bar animates from browse position to search mode position
  // Using transforms for GPU-accelerated animation (translateX, translateY, width)
  const floatingSearchBarStyle = useAnimatedStyle(() => {
    "worklet";
    // Calculate Y delta for transform
    const deltaY = searchModeY - searchBarY.value;
    // Filter button takes up space when visible (on recipes tab)
    const filterSpace =
      (FILTER_BUTTON_SIZE + FILTER_BUTTON_GAP) * filterButtonProgress.value;

    // Calculate width change instead of animating left/right (layout properties)
    const startWidth = SCREEN_WIDTH - HORIZONTAL_PADDING * 2;
    const endWidth =
      SCREEN_WIDTH -
      HORIZONTAL_PADDING * 2 -
      BACK_BUTTON_WIDTH -
      BACK_BUTTON_GAP -
      filterSpace;

    return {
      position: "absolute" as const,
      top: searchBarY.value || searchModeY,
      left: HORIZONTAL_PADDING,
      width: interpolate(searchProgress.value, [0, 1], [startWidth, endWidth]),
      zIndex: 100,
      // Visible during entire animation cycle
      opacity: isFloatingVisible.value ? 1 : 0,
      // Use transforms for GPU-accelerated animation
      transform: [
        {
          translateX: interpolate(
            searchProgress.value,
            [0, 1],
            [0, BACK_BUTTON_WIDTH + BACK_BUTTON_GAP],
          ),
        },
        { translateY: interpolate(searchProgress.value, [0, 1], [0, deltaY]) },
      ],
    };
  });

  // Inline search bar hides when floating one is visible
  const inlineSearchBarStyle = useAnimatedStyle(() => {
    "worklet";
    return {
      opacity: isFloatingVisible.value ? 0 : 1,
    };
  });

  // Filter button animates based on active tab (visible on recipes, hidden on collections)
  // Filter button uses scale transform for GPU-accelerated show/hide
  const filterButtonAnimatedStyle = useAnimatedStyle(() => {
    "worklet";
    const scale = interpolate(
      filterButtonProgress.value * searchProgress.value,
      [0, 1],
      [0, 1],
    );
    return {
      opacity: filterButtonProgress.value * searchProgress.value,
      transform: [{ scale }],
    };
  });

  // Back button scales in like the filter button
  const backButtonAnimatedStyle = useAnimatedStyle(() => {
    "worklet";
    const scale = searchProgress.value;
    return {
      opacity: searchProgress.value,
      transform: [{ scale }],
    };
  });

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <View style={styles.screen}>
      {/* Browse Mode */}
      <Animated.View
        style={[styles.listContainer, browseAnimatedStyle]}
        pointerEvents={isSearchActive ? "none" : "auto"}
      >
        <AnimatedScrollView
          contentContainerStyle={styles.browseContent}
          showsVerticalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
          {/* Pressable Search Bar Button (not a real input) */}
          <AnimatedPressable
            ref={searchBarRef}
            style={[styles.searchContainer, inlineSearchBarStyle]}
            onPress={handleSearchFocus}
          >
            <View pointerEvents="none">
              <SearchBar
                value=""
                onChangeText={() => {}}
                placeholder="Search recipes, collections..."
              />
            </View>
          </AnimatedPressable>

          <VSpace size={32} />

          {/* Collections Section */}
          <View>
            <Text type="title3" style={styles.sectionTitle}>
              Collections
            </Text>
            <FlatList<CollectionWithMetadata | { id: "create"; type: "create" }>
              horizontal
              data={collectionsWithCreate}
              renderItem={renderCollectionItem}
              keyExtractor={(item) => item.id.toString()}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
              ItemSeparatorComponent={CollectionSeparator}
            />
          </View>

          {/* Recently Added Section */}
          {recentRecipes.length > 0 && (
            <View style={styles.section}>
              <Text type="title3" style={styles.sectionTitle}>
                Recently Added
              </Text>
              <Animated.View
                style={[styles.recentRecipesList, recipeCardsStyle]}
              >
                {recentRecipes.map((recipe, index) => (
                  <Animated.View
                    key={recipe.id}
                    ref={index === 0 ? firstRecipeRef : undefined}
                  >
                    <RecipeCard
                      recipe={recipe}
                      onPress={() => handleRecipePress(recipe)}
                    />
                    {index < recentRecipes.length - 1 && <VSpace size={12} />}
                  </Animated.View>
                ))}
              </Animated.View>
            </View>
          )}

          {/* Empty State */}
          {collections.length === 0 && recentRecipes.length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons
                name="book-outline"
                size={48}
                style={styles.emptyIcon}
              />
              <Text type="headline" style={styles.emptyTitle}>
                No recipes yet
              </Text>
              <Text type="body" style={styles.emptySubtitle}>
                Import recipes from the feed or add your own to get started
              </Text>
            </View>
          )}
        </AnimatedScrollView>

        {/* Fixed Title Header */}
        <View style={styles.fixedHeader}>
          <Animated.View style={titleAnimatedStyle}>
            <Text type="screenTitle">My Recipes</Text>
          </Animated.View>
        </View>
      </Animated.View>

      {/* Search Mode - RecipeCollectionBrowser */}
      <Animated.View
        style={[
          styles.listContainer,
          styles.searchModeContainer,
          searchAnimatedStyle,
        ]}
        pointerEvents={isSearchActive ? "auto" : "none"}
      >
        <View style={styles.searchModeContent}>
          <RecipeCollectionBrowser
            onRecipePress={handleRecipePress}
            onCollectionPress={handleCollectionPress}
            recipesEmptyMessage="No recipes in your library yet. Import recipes from the feed or add your own!"
            onTabBarScroll={onTabBarScroll}
            hideSearchBar
            externalSearchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            onFilterStateChange={setFilterState}
            headerAnimationProgress={searchProgress}
          />
        </View>
      </Animated.View>

      {/* Floating Search Bar - always mounted for worklet pre-warming */}
      <Animated.View
        style={floatingSearchBarStyle}
        pointerEvents={isSearchActive ? "auto" : "none"}
      >
        <SearchBar
          ref={searchInputRef}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search recipes, collections..."
        />
      </Animated.View>

      {/* Back Button - always mounted for worklet pre-warming */}
      <Animated.View
        style={[
          styles.backButtonContainer,
          { top: searchModeY },
          backButtonAnimatedStyle,
        ]}
        pointerEvents={isSearchActive ? "auto" : "none"}
      >
        <TouchableOpacity
          onPress={handleExitSearch}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} style={styles.backIcon} />
        </TouchableOpacity>
      </Animated.View>

      {/* Filter Button - always mounted for worklet pre-warming */}
      {filterState && (
        <Animated.View
          style={[
            styles.filterButtonContainer,
            { top: searchModeY },
            filterButtonAnimatedStyle,
          ]}
          pointerEvents={
            filterState.activeTab === "recipes" && isSearchActive
              ? "auto"
              : "none"
          }
        >
          <TouchableOpacity
            style={styles.filterButton}
            onPress={filterState.onOpenFilters}
            activeOpacity={0.7}
          >
            <Ionicons
              name="options-outline"
              size={22}
              style={styles.filterIcon}
            />
            {filterState.hasActiveFilters && (
              <View style={styles.filterBadge} />
            )}
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Recipe Transition Overlay (animating recipe cards) - always mounted */}
      {recentRecipes.map((recipe, index) => {
        const browsePos = browsePositions.current[index];
        return (
          <AnimatedRecipeOverlay
            key={`overlay-${recipe.id}`}
            recipe={recipe}
            browseY={browsePos?.y ?? 0}
            searchY={getSearchTargetY(index)}
            searchProgress={searchProgress}
            isVisible={isFloatingVisible}
          />
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create((theme, rt) => ({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  listContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  searchModeContainer: {
    backgroundColor: theme.colors.background,
  },
  searchModeContent: {
    flex: 1,
  },
  fixedHeader: {
    position: "absolute",
    top: rt.insets.top,
    left: 0,
    right: 0,
    paddingHorizontal: HORIZONTAL_PADDING,
  },
  browseContent: {
    paddingTop: rt.insets.top + HEADER_HEIGHT + 8,
    paddingBottom: rt.insets.bottom + 100,
  },
  searchContainer: {
    paddingHorizontal: HORIZONTAL_PADDING,
  },
  searchBarHidden: {
    opacity: 0,
  },
  section: {
    marginTop: 32,
  },
  sectionTitle: {
    paddingHorizontal: HORIZONTAL_PADDING,
    marginBottom: 12,
  },
  horizontalList: {
    paddingHorizontal: HORIZONTAL_PADDING,
  },
  collectionSeparator: {
    width: 12,
  },
  recentRecipesList: {
    // RecipeCard already has horizontal padding
  },
  hiddenCard: {
    opacity: 0,
  },
  recipeOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 50,
  },
  backButtonContainer: {
    position: "absolute",
    left: HORIZONTAL_PADDING,
    zIndex: 101,
  },
  filterButtonContainer: {
    position: "absolute",
    right: HORIZONTAL_PADDING,
    zIndex: 100,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    paddingTop: 80,
  },
  emptyIcon: {
    color: theme.colors.textTertiary,
    marginBottom: 16,
  },
  emptyTitle: {
    textAlign: "center",
    marginBottom: 8,
  },
  emptySubtitle: {
    textAlign: "center",
    color: theme.colors.textSecondary,
  },
  backButton: {
    width: 50,
    height: 50,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: theme.colors.inputBackground,
    borderRadius: 25,
  },
  backIcon: {
    color: theme.colors.text,
  },
  filterButton: {
    backgroundColor: theme.colors.inputBackground,
    borderRadius: theme.borderRadius.full,
    width: FILTER_BUTTON_SIZE,
    height: FILTER_BUTTON_SIZE,
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
}));
