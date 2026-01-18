import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useCallback, useMemo, useRef, useState, useEffect } from "react";
import {
  View,
  Alert,
  Pressable,
  TouchableOpacity,
  ScrollView,
  FlatList,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  Easing,
} from "react-native-reanimated";
import { StyleSheet, UnistylesRuntime } from "react-native-unistyles";

import {
  useCreateCollection,
  useGetUserCollectionsWithMetadata,
} from "@/api/collection";
import { useGetUserRecipes, type RecipeListItem } from "@/api/recipe";
import { CollectionGridCard } from "@/components/CollectionGridCard";
import { CreateCollectionCard } from "@/components/CreateCollectionCard";
import { RecipeCard } from "@/components/RecipeCard";
import { RecipeCollectionBrowser } from "@/components/RecipeCollectionBrowser";
import { SafeAreaView } from "@/components/SafeAreaView";
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
const HORIZONTAL_PADDING = 20;
const HEADER_HEIGHT = 52;
const COLLECTION_CARD_WIDTH = 140;
const BACK_BUTTON_WIDTH = 44;
const BACK_BUTTON_GAP = 12;
const FILTER_BUTTON_SIZE = 50;
const FILTER_BUTTON_GAP = 12;

export const MyRecipesScreen = () => {
  const navigation = useNavigation();
  const { onScroll: onTabBarScroll } = useTabBarScroll();
  const insets = UnistylesRuntime.insets;

  // ─── State ────────────────────────────────────────────────────────────────────
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [showFloatingSearch, setShowFloatingSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Filter state from RecipeCollectionBrowser
  const [filterState, setFilterState] = useState<{
    hasActiveFilters: boolean;
    onOpenFilters: () => void;
    activeTab: TabType;
  } | null>(null);

  // Track the search bar's Y position relative to the screen
  const searchBarRef = useRef<View>(null);
  const searchBarY = useSharedValue(0);
  const searchBarMeasuredY = useRef(0);

  // Animation progress (0 = browse, 1 = search)
  const searchProgress = useSharedValue(0);

  // Scroll-based title fade (like HomeScreen)
  const titleOpacity = useSharedValue(1);

  // Filter button visibility (1 = visible on recipes tab, 0 = hidden on collections tab)
  const filterButtonProgress = useSharedValue(1);

  // Target Y position for search mode (matching RecipeCollectionBrowser's search bar)
  const searchModeY = insets.top;

  const animationConfig = useMemo(
    () => ({
      duration: 300,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
    }),
    [],
  );

  useEffect(() => {
    if (isSearchActive) {
      setShowFloatingSearch(true);
      searchProgress.value = withTiming(1, animationConfig);
    } else {
      searchProgress.value = withTiming(0, animationConfig);
      const timeout = setTimeout(() => {
        setShowFloatingSearch(false);
      }, animationConfig.duration);
      return () => clearTimeout(timeout);
    }
  }, [isSearchActive, animationConfig, searchProgress]);

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
    searchBarRef.current?.measureInWindow((_x, y) => {
      searchBarMeasuredY.current = y;
      searchBarY.value = y;
      setIsSearchActive(true);
    });
  }, [searchBarY]);

  const handleExitSearch = useCallback(() => {
    setIsSearchActive(false);
    setSearchQuery("");
  }, []);

  // ─── Scroll Handler with Title Fade ────────────────────────────────────────────
  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = event.nativeEvent.contentOffset.y;

      // Fade out title when scrolling up (search bar would collide with header)
      const titleShouldHide = y > 5;
      titleOpacity.value = withTiming(titleShouldHide ? 0 : 1, {
        duration: 150,
      });
    },
    [titleOpacity],
  );

  // ─── Animation Styles ─────────────────────────────────────────────────────────
  const browseAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(searchProgress.value, [0, 1], [1, 0]),
  }));

  const searchAnimatedStyle = useAnimatedStyle(() => ({
    opacity: searchProgress.value,
  }));

  const titleAnimatedStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
  }));

  // Floating search bar animates from browse position to search mode position (shorter, with space for back button and filter)
  const floatingSearchBarStyle = useAnimatedStyle(() => {
    // Filter button takes up space when visible (on recipes tab)
    const filterSpace =
      (FILTER_BUTTON_SIZE + FILTER_BUTTON_GAP) * filterButtonProgress.value;
    return {
      position: "absolute",
      top: interpolate(
        searchProgress.value,
        [0, 1],
        [searchBarY.value, searchModeY],
      ),
      left: interpolate(
        searchProgress.value,
        [0, 1],
        [
          HORIZONTAL_PADDING,
          HORIZONTAL_PADDING + BACK_BUTTON_WIDTH + BACK_BUTTON_GAP,
        ],
      ),
      right: interpolate(
        searchProgress.value,
        [0, 1],
        [HORIZONTAL_PADDING, HORIZONTAL_PADDING + filterSpace],
      ),
      zIndex: 100,
    };
  });

  // Filter button animates based on active tab (visible on recipes, hidden on collections)
  const filterButtonAnimatedStyle = useAnimatedStyle(() => ({
    position: "absolute",
    top: searchModeY,
    right: HORIZONTAL_PADDING,
    opacity: filterButtonProgress.value * searchProgress.value,
    transform: [{ scale: 0.8 + 0.2 * filterButtonProgress.value }],
    width: FILTER_BUTTON_SIZE * filterButtonProgress.value,
    zIndex: 100,
  }));

  // Back button fades in and slides from left
  const backButtonAnimatedStyle = useAnimatedStyle(() => ({
    position: "absolute",
    top: searchModeY,
    left: HORIZONTAL_PADDING,
    opacity: searchProgress.value,
    transform: [
      { translateX: interpolate(searchProgress.value, [0, 1], [-20, 0]) },
    ],
    zIndex: 101,
  }));

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <View style={styles.screen}>
      {/* Browse Mode */}
      <Animated.View
        style={[styles.listContainer, browseAnimatedStyle]}
        pointerEvents={showFloatingSearch ? "none" : "auto"}
      >
        <ScrollView
          contentContainerStyle={styles.browseContent}
          showsVerticalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
          {/* Pressable Search Bar Button (not a real input) */}
          <Pressable
            ref={searchBarRef}
            style={[
              styles.searchContainer,
              showFloatingSearch && styles.searchBarHidden,
            ]}
            onPress={handleSearchFocus}
          >
            <View pointerEvents="none">
              <SearchBar
                value=""
                onChangeText={() => {}}
                placeholder="Search recipes, collections..."
              />
            </View>
          </Pressable>

          <VSpace size={32} />

          {/* Collections Section */}
          <View>
            <Text type="title3" style={styles.sectionTitle}>
              Collections
            </Text>
            <FlatList<CollectionWithMetadata | { id: "create"; type: "create" }>
              horizontal
              data={[{ id: "create", type: "create" } as const, ...collections]}
              renderItem={({ item }) => {
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
              }}
              keyExtractor={(item) => item.id.toString()}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
              ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
            />
          </View>

          {/* Recently Added Section */}
          {recentRecipes.length > 0 && (
            <View style={styles.section}>
              <Text type="title3" style={styles.sectionTitle}>
                Recently Added
              </Text>
              <View style={styles.recentRecipesList}>
                {recentRecipes.map((recipe, index) => (
                  <View key={recipe.id}>
                    <RecipeCard
                      recipe={recipe}
                      onPress={() => handleRecipePress(recipe)}
                    />
                    {index < recentRecipes.length - 1 && <VSpace size={12} />}
                  </View>
                ))}
              </View>
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
        </ScrollView>

        {/* Fixed Title Header */}
        <View style={styles.fixedHeader}>
          <Animated.View style={titleAnimatedStyle}>
            <Text type="title1">My Recipes</Text>
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
        <SafeAreaView edges={[]} style={styles.searchModeContent}>
          <RecipeCollectionBrowser
            onRecipePress={handleRecipePress}
            onCollectionPress={handleCollectionPress}
            recipesEmptyMessage="No recipes in your library yet. Import recipes from the feed or add your own!"
            onTabBarScroll={onTabBarScroll}
            hideSearchBar
            externalSearchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            onFilterStateChange={setFilterState}
          />
        </SafeAreaView>
      </Animated.View>

      {/* Floating Search Bar (animates during transition, becomes interactive in search mode) */}
      {showFloatingSearch && (
        <Animated.View
          style={floatingSearchBarStyle}
          pointerEvents={isSearchActive ? "auto" : "none"}
        >
          <SearchBar
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search recipes, collections..."
            autoFocus={isSearchActive}
          />
        </Animated.View>
      )}

      {/* Back Button Overlay (appears in search mode) */}
      {showFloatingSearch && (
        <Animated.View style={backButtonAnimatedStyle}>
          <TouchableOpacity
            onPress={handleExitSearch}
            style={styles.backButton}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} style={styles.backIcon} />
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Filter Button (appears in search mode on recipes tab) */}
      {showFloatingSearch && filterState && (
        <Animated.View
          style={filterButtonAnimatedStyle}
          pointerEvents={filterState.activeTab === "recipes" ? "auto" : "none"}
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
    paddingTop: rt.insets.top + HEADER_HEIGHT,
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
  recentRecipesList: {
    // RecipeCard already has horizontal padding
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
