import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useScrollToTop } from "@react-navigation/native";
import type { Outputs } from "@repo/trpc/client";
import { Image } from "expo-image";
import { useState, useCallback, useMemo, useRef, memo, useEffect } from "react";
import {
  View,
  TouchableOpacity,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  FlatList,
  ScrollView,
} from "react-native";
import { useKeyboardHandler } from "react-native-keyboard-controller";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  Easing,
} from "react-native-reanimated";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { StyleSheet } from "react-native-unistyles";

import { useSearchPublicCollections } from "@/api/collection";
import { useSearchUsers } from "@/api/follows";
import {
  useRecommendedRecipes,
  useLikeRecipe,
  useSearchAllRecipes,
  useAllTags,
  usePopularThisWeek,
} from "@/api/recipe";
import { useUser } from "@/api/user";
import { CollectionCard } from "@/components/CollectionCard";
import { CollectionSheetManager } from "@/components/CollectionSelectorSheet";
import { FeaturedRecipeCard } from "@/components/FeaturedRecipeCard";
import { SheetManager } from "@/components/FilterBottomSheet";
import { FullWidthRecipeCard } from "@/components/FullWidthRecipeCard";
import { RecipeCarousel } from "@/components/RecipeCarousel";
import { SearchBar } from "@/components/SearchBar";
import { SearchEmptyState } from "@/components/SearchEmptyState";
import { VSpace } from "@/components/Space";
import { Text } from "@/components/Text";
import { UnderlineTabBar, type TabOption } from "@/components/UnderlineTabBar";
import { UserSearchCard } from "@/components/UserSearchCard";
import { useDebounce } from "@/hooks/useDebounce";
import { useTabSlideAnimation } from "@/hooks/useTabSlideAnimation";

type RecipePage = Outputs["recipe"]["searchAllRecipes"];
type RecommendedRecipe = RecipePage["items"][number];
type CollectionPage = Outputs["collection"]["searchPublicCollections"];
type CollectionResult = CollectionPage["items"][number];
type SearchUser = Outputs["follows"]["searchUsers"][number];
type CurrentUser = Outputs["user"]["getUser"]["user"];

// ─── Header Component ─────────────────────────────────────────────────────────

interface HeaderProps {
  user: CurrentUser | undefined;
  onAvatarPress: () => void;
}

const Header = memo(({ user, onAvatarPress }: HeaderProps) => {
  const renderAvatar = () => {
    if (!user) return null;
    return (
      <TouchableOpacity
        style={styles.avatar}
        onPress={onAvatarPress}
        activeOpacity={0.7}
      >
        {user.image ? (
          <Image
            source={{ uri: user.image }}
            style={styles.avatarImage}
            cachePolicy="memory-disk"
            transition={100}
          />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text type="heading" style={styles.avatarText}>
              {user.name.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.headerContainer}>
      <View style={styles.headerRow}>
        <Text type="title1">
          cook
          <Text type="title1" style={styles.clubText}>
            club
          </Text>
        </Text>
        {renderAvatar()}
      </View>
    </View>
  );
});

// ─── Search Empty State ───────────────────────────────────────────────────────

// ─── Types ───────────────────────────────────────────────────────────────────
type SearchType = "recipes" | "collections" | "users";

const searchTabOptions: TabOption<SearchType>[] = [
  { value: "recipes", label: "Recipes" },
  { value: "collections", label: "Collections" },
  { value: "users", label: "Users" },
];

// ─── Constants ───────────────────────────────────────────────────────────────
const HORIZONTAL_PADDING = 20;
const BACK_BUTTON_WIDTH = 40;
const FILTER_BUTTON_WIDTH = 44;
const HEADER_GAP = 12;
const SEARCH_BAR_HEIGHT = 44;

// ─── Main Component ───────────────────────────────────────────────────────────

export const HomeScreen = () => {
  const browseScrollRef = useRef<ScrollView>(null);
  const searchListRef = useRef<FlatList>(null);
  const searchBarRef = useRef<View>(null);
  useScrollToTop(browseScrollRef);
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  // ─── State ────────────────────────────────────────────────────────────────────
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [showFloatingSearch, setShowFloatingSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<SearchType>("recipes");
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [maxTotalTime, setMaxTotalTime] = useState<string | undefined>();

  // Track the search bar's Y position relative to the screen
  const searchBarY = useSharedValue(0);
  const searchBarMeasuredY = useRef(0);

  // Animation progress (0 = browse, 1 = search)
  const searchProgress = useSharedValue(0);

  // Filter button visibility (0 = hidden, 1 = visible) - animated separately for tab changes
  const filterButtonProgress = useSharedValue(1);

  // Keyboard height as animated value for empty state centering
  const keyboardHeight = useSharedValue(0);

  useKeyboardHandler({
    onMove: (e) => {
      "worklet";
      keyboardHeight.value = e.height;
    },
    onEnd: (e) => {
      "worklet";
      keyboardHeight.value = e.height;
    },
  });

  // Tab slide animation from hook
  const { animatedStyle: tabContentStyle, triggerSlide } =
    useTabSlideAnimation();

  // Target Y position for search mode (safe area top + padding)
  const searchModeY = insets.top + 20;

  const animationConfig = useMemo(
    () => ({
      duration: 300,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
    }),
    [],
  );

  useEffect(() => {
    if (isSearchActive) {
      // Show floating search immediately when entering search mode
      setShowFloatingSearch(true);
      searchProgress.value = withTiming(1, animationConfig);
    } else {
      // Animate out, then hide floating search after animation completes
      searchProgress.value = withTiming(0, animationConfig);
      const timeout = setTimeout(() => {
        setShowFloatingSearch(false);
      }, animationConfig.duration);
      return () => clearTimeout(timeout);
    }
  }, [isSearchActive, animationConfig, searchProgress]);

  // Animate filter button when tab changes
  useEffect(() => {
    filterButtonProgress.value = withTiming(
      activeTab === "recipes" ? 1 : 0,
      animationConfig,
    );
  }, [activeTab, animationConfig, filterButtonProgress]);

  // Debounce search query
  const debouncedSearch = useDebounce(searchQuery, 300);

  // ─── API Hooks ────────────────────────────────────────────────────────────────
  const { data: userData } = useUser();
  const user = userData?.user;
  const { data: allTags = [] } = useAllTags();
  const { data: popularRecipes = [] } = usePopularThisWeek();
  const likeRecipeMutation = useLikeRecipe();

  // Recommended recipes (for featured card)
  const { data: recommendedData, refetch: recommendedRefetch } =
    useRecommendedRecipes();

  // Search conditions
  const shouldFetchRecipes =
    isSearchActive &&
    activeTab === "recipes" &&
    (debouncedSearch.trim() !== "" ||
      selectedTagIds.length > 0 ||
      maxTotalTime !== undefined);

  const shouldFetchCollections =
    isSearchActive &&
    activeTab === "collections" &&
    debouncedSearch.length >= 2;

  const shouldFetchUsers =
    isSearchActive && activeTab === "users" && debouncedSearch.length >= 2;

  // Search hooks
  const {
    data: recipeData,
    isPending: recipesPending,
    isFetchingNextPage: recipesFetchingNext,
    hasNextPage: recipesHasNext,
    fetchNextPage: recipesFetchNext,
    refetch: recipesRefetch,
    isFetching: recipesFetching,
  } = useSearchAllRecipes({
    search: debouncedSearch,
    tagIds: selectedTagIds.length > 0 ? selectedTagIds : undefined,
    maxTotalTime,
  });

  const {
    data: collectionData,
    isPending: collectionsPending,
    isFetchingNextPage: collectionsFetchingNext,
    hasNextPage: collectionsHasNext,
    fetchNextPage: collectionsFetchNext,
    refetch: collectionsRefetch,
    isFetching: collectionsFetching,
  } = useSearchPublicCollections({
    query: debouncedSearch,
  });

  const {
    data: usersData,
    isPending: usersPending,
    refetch: usersRefetch,
    isFetching: usersFetching,
  } = useSearchUsers({
    query: debouncedSearch,
  });

  // ─── Flatten Data ─────────────────────────────────────────────────────────────
  const featuredRecipe: RecommendedRecipe | undefined = useMemo(
    () => recommendedData?.pages[0]?.items?.[0],
    [recommendedData],
  );

  const searchRecipes = useMemo(() => {
    if (!shouldFetchRecipes) return [];
    return (
      recipeData?.pages.flatMap((page: RecipePage) => page?.items ?? []) ?? []
    );
  }, [recipeData, shouldFetchRecipes]);

  const collections = useMemo(() => {
    if (!shouldFetchCollections) return [];
    return (
      collectionData?.pages.flatMap(
        (page: CollectionPage) => page?.items ?? [],
      ) ?? []
    );
  }, [collectionData, shouldFetchCollections]);

  const users: SearchUser[] = useMemo(() => {
    if (!shouldFetchUsers) return [];
    return usersData ?? [];
  }, [usersData, shouldFetchUsers]);

  // ─── Handlers ─────────────────────────────────────────────────────────────────
  const handleAvatarPress = useCallback(() => {
    if (user?.id) {
      navigation.navigate("UserProfile", { userId: user.id });
    }
  }, [user?.id, navigation]);

  const handleRecipePress = useCallback(
    (recipeId: number) => {
      navigation.navigate("RecipeDetail", { recipeId });
    },
    [navigation],
  );

  const handleLikePress = useCallback(
    (recipeId: number) => {
      likeRecipeMutation.mutate({ recipeId });
    },
    [likeRecipeMutation],
  );

  const handleSavePress = useCallback((recipeId: number) => {
    CollectionSheetManager.show("collection-selector-sheet", {
      payload: { recipeId },
    });
  }, []);

  const handleUserPress = useCallback(
    (userId: string) => {
      navigation.navigate("UserProfile", { userId });
    },
    [navigation],
  );

  const handleSearchFocus = useCallback(() => {
    // Measure the search bar position before transitioning
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

  const handleTabChange = useCallback(
    (tab: SearchType, direction: number) => {
      triggerSlide(direction);
      setActiveTab(tab);
      if (tab !== "recipes") {
        setSelectedTagIds([]);
        setMaxTotalTime(undefined);
      }
    },
    [triggerSlide],
  );

  const handleFilterPress = useCallback(() => {
    SheetManager.show("filter-sheet", {
      payload: {
        selectedTagIds,
        onTagsChange: setSelectedTagIds,
        maxTotalTime,
        onTimeChange: setMaxTotalTime,
        allTags,
      },
    });
  }, [selectedTagIds, maxTotalTime, allTags]);

  const handleLoadMore = useCallback(() => {
    if (activeTab === "recipes") {
      if (shouldFetchRecipes && recipesHasNext && !recipesFetchingNext) {
        recipesFetchNext();
      }
    } else if (activeTab === "collections") {
      if (
        shouldFetchCollections &&
        collectionsHasNext &&
        !collectionsFetchingNext
      ) {
        collectionsFetchNext();
      }
    }
  }, [
    activeTab,
    shouldFetchRecipes,
    recipesHasNext,
    recipesFetchingNext,
    recipesFetchNext,
    shouldFetchCollections,
    collectionsHasNext,
    collectionsFetchingNext,
    collectionsFetchNext,
  ]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    if (isSearchActive) {
      if (activeTab === "recipes" && shouldFetchRecipes) {
        await recipesRefetch();
      } else if (activeTab === "collections" && shouldFetchCollections) {
        await collectionsRefetch();
      } else if (activeTab === "users" && shouldFetchUsers) {
        await usersRefetch();
      }
    } else {
      await recommendedRefetch();
    }
    setIsRefreshing(false);
  }, [
    isSearchActive,
    activeTab,
    shouldFetchRecipes,
    recipesRefetch,
    shouldFetchCollections,
    collectionsRefetch,
    shouldFetchUsers,
    usersRefetch,
    recommendedRefetch,
  ]);

  // ─── Render Functions ─────────────────────────────────────────────────────────
  const renderSearchRecipe = ({ item }: { item: RecommendedRecipe }) => (
    <FullWidthRecipeCard
      recipe={item}
      onPress={() => handleRecipePress(item.id)}
      onLikePress={() => handleLikePress(item.id)}
      onSavePress={() => handleSavePress(item.id)}
      onUserPress={() => handleUserPress(item.uploadedBy.id)}
    />
  );

  const renderCollection = ({ item }: { item: CollectionResult }) => (
    <CollectionCard
      collection={item}
      onPress={() => handleUserPress(item.owner.id)}
      onOwnerPress={() => handleUserPress(item.owner.id)}
    />
  );

  const renderUser = ({ item }: { item: SearchUser }) => (
    <View style={styles.userCardWrapper}>
      <UserSearchCard
        user={item}
        onUserPress={() => handleUserPress(item.id)}
      />
    </View>
  );

  // ─── Browse Mode Header ───────────────────────────────────────────────────────
  const BrowseListHeader = useMemo(
    () => (
      <>
        <VSpace size={28} />
        <Header user={user} onAvatarPress={handleAvatarPress} />
        <VSpace size={20} />
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
              placeholder="Search recipes, collections, users..."
            />
          </View>
        </Pressable>
        <VSpace size={28} />
        {featuredRecipe && (
          <>
            <Text type="title3" style={styles.sectionTitle}>
              Today's featured recipe
            </Text>
            <VSpace size={12} />
            <FeaturedRecipeCard
              recipe={featuredRecipe}
              onPress={() => handleRecipePress(featuredRecipe.id)}
            />
            <VSpace size={28} />
          </>
        )}
        {popularRecipes.length > 0 && (
          <RecipeCarousel
            title="Trending"
            recipes={popularRecipes}
            onRecipePress={handleRecipePress}
          />
        )}
        <VSpace size={24} />
      </>
    ),
    [
      user,
      handleAvatarPress,
      showFloatingSearch,
      handleSearchFocus,
      featuredRecipe,
      handleRecipePress,
      popularRecipes,
    ],
  );

  // ─── Search Mode Header ───────────────────────────────────────────────────────
  // The search bar, back button, filter button, and tab switcher are rendered as
  // fixed elements outside the FlatList. FlatList only contains search results.
  const SearchListHeader = useMemo(() => <VSpace size={16} />, []);

  // ─── Search Empty State ───────────────────────────────────────────────────────
  const isFetching =
    (activeTab === "recipes" && (recipesPending || recipesFetching)) ||
    (activeTab === "collections" &&
      (collectionsPending || collectionsFetching)) ||
    (activeTab === "users" && (usersPending || usersFetching));

  const shouldFetch =
    (activeTab === "recipes" && shouldFetchRecipes) ||
    (activeTab === "collections" && shouldFetchCollections) ||
    (activeTab === "users" && shouldFetchUsers);

  const fixedHeaderHeight = insets.top + SEARCH_BAR_HEIGHT;

  const renderSearchEmpty = () => (
    <SearchEmptyState
      activeTab={activeTab}
      isFetching={isFetching}
      shouldFetch={shouldFetch}
      keyboardHeight={keyboardHeight}
      fixedHeaderHeight={fixedHeaderHeight}
    />
  );

  // ─── Search Footer ────────────────────────────────────────────────────────────
  const renderSearchFooter = () => {
    const isFetchingNext =
      (activeTab === "recipes" && recipesFetchingNext) ||
      (activeTab === "collections" && collectionsFetchingNext);

    if (!isFetchingNext) return null;

    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="large" />
        <VSpace size={20} />
      </View>
    );
  };

  // Determine search data
  const searchData =
    activeTab === "recipes"
      ? searchRecipes
      : activeTab === "collections"
        ? collections
        : users;

  const searchRenderItem =
    activeTab === "recipes"
      ? renderSearchRecipe
      : activeTab === "collections"
        ? renderCollection
        : renderUser;

  const searchKeyExtractor = (
    item: RecommendedRecipe | CollectionResult | SearchUser,
  ) =>
    "uploadedBy" in item
      ? item.id.toString()
      : "owner" in item
        ? `collection-${item.id}`
        : item.id;

  // ─── Animation Styles ─────────────────────────────────────────────────────────
  // Use showFloatingSearch to control visibility so the animation plays out fully
  const browseAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(searchProgress.value, [0, 1], [1, 0]),
  }));

  const searchAnimatedStyle = useAnimatedStyle(() => ({
    opacity: searchProgress.value,
  }));

  // Floating search bar animates from its scroll position to fixed position
  const floatingSearchBarStyle = useAnimatedStyle(() => {
    // Calculate the right padding based on filter button visibility
    const filterSpace = interpolate(
      filterButtonProgress.value,
      [0, 1],
      [0, FILTER_BUTTON_WIDTH + HEADER_GAP],
    );

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
          HORIZONTAL_PADDING + BACK_BUTTON_WIDTH + HEADER_GAP,
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

  // Back button slides in from left
  const backButtonAnimatedStyle = useAnimatedStyle(() => ({
    position: "absolute",
    top: searchModeY,
    left: HORIZONTAL_PADDING,
    opacity: searchProgress.value,
    transform: [
      { translateX: interpolate(searchProgress.value, [0, 1], [-20, 0]) },
    ],
  }));

  // Filter button slides in from right
  const filterButtonAnimatedStyle = useAnimatedStyle(() => ({
    position: "absolute",
    top: searchModeY,
    right: HORIZONTAL_PADDING,
    opacity: searchProgress.value * filterButtonProgress.value,
    transform: [
      {
        translateX: interpolate(
          Math.min(searchProgress.value, filterButtonProgress.value),
          [0, 1],
          [20, 0],
        ),
      },
    ],
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
          ref={browseScrollRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing && !isSearchActive}
              onRefresh={handleRefresh}
            />
          }
        >
          <SafeAreaView edges={["top"]}>{BrowseListHeader}</SafeAreaView>
        </ScrollView>
      </Animated.View>

      {/* Search Mode */}
      <Animated.View
        style={[
          styles.listContainer,
          styles.searchModeContainer,
          searchAnimatedStyle,
        ]}
        pointerEvents={isSearchActive ? "auto" : "none"}
      >
        {/* Fixed header with tabs */}
        <SafeAreaView edges={["top"]} style={styles.searchFixedHeader}>
          {/* Spacer for the floating search bar row */}
          <VSpace size={20 + SEARCH_BAR_HEIGHT + 12} />
          <View style={styles.searchContainer}>
            <UnderlineTabBar
              options={searchTabOptions}
              value={activeTab}
              onValueChange={handleTabChange}
            />
          </View>
          <VSpace size={16} />
        </SafeAreaView>

        {/* Scrollable search results */}
        <Animated.View style={[styles.searchResultsList, tabContentStyle]}>
          <FlatList
            ref={searchListRef}
            data={searchData}
            // Type assertion needed: data and renderItem change types based on activeTab
            renderItem={searchRenderItem as any}
            keyExtractor={searchKeyExtractor}
            ListHeaderComponent={SearchListHeader}
            ListEmptyComponent={renderSearchEmpty}
            ListFooterComponent={renderSearchFooter}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.5}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing && isSearchActive}
                onRefresh={handleRefresh}
                enabled={shouldFetch}
              />
            }
            showsVerticalScrollIndicator={false}
            style={styles.flatListFlex}
            contentContainerStyle={styles.searchResultsContent}
          />
        </Animated.View>
      </Animated.View>

      {/* Floating Search Bar (appears during transition and in search mode) */}
      {showFloatingSearch && (
        <>
          <Animated.View style={backButtonAnimatedStyle}>
            <TouchableOpacity
              onPress={handleExitSearch}
              style={styles.backButton}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={24} style={styles.backIcon} />
            </TouchableOpacity>
          </Animated.View>

          <Animated.View
            style={floatingSearchBarStyle}
            pointerEvents={isSearchActive ? "auto" : "none"}
          >
            <SearchBar
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus={isSearchActive}
            />
          </Animated.View>

          <Animated.View style={filterButtonAnimatedStyle}>
            <TouchableOpacity
              style={styles.filterButton}
              onPress={handleFilterPress}
              activeOpacity={0.7}
            >
              <Ionicons
                name="options-outline"
                size={24}
                style={
                  selectedTagIds.length > 0 || maxTotalTime
                    ? styles.filterIconActive
                    : styles.filterIcon
                }
              />
            </TouchableOpacity>
          </Animated.View>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create((theme) => ({
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
  searchFixedHeader: {
    backgroundColor: theme.colors.background,
  },
  searchResultsList: {
    flex: 1,
  },
  flatListFlex: {
    flex: 1,
  },
  searchResultsContent: {
    flexGrow: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  headerContainer: {
    paddingHorizontal: 20,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  clubText: {
    color: theme.colors.primary,
  },
  avatar: {
    width: 40,
    height: 40,
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.primary + "20",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: 16,
    color: theme.colors.primary,
  },
  searchContainer: {
    paddingHorizontal: 20,
  },
  searchBarHidden: {
    opacity: 0,
  },
  searchModeHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  backIcon: {
    color: theme.colors.text,
  },
  searchBarExpanded: {
    flex: 1,
  },
  filterButton: {
    width: 44,
    height: 44,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: theme.colors.background,
  },
  filterIcon: {
    color: theme.colors.text,
  },
  filterIconActive: {
    color: theme.colors.primary,
  },
  sectionHeader: {
    paddingHorizontal: 20,
  },
  sectionTitle: {
    paddingHorizontal: 20,
  },
  userCardWrapper: {
    paddingHorizontal: 20,
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: "center",
  },
}));
