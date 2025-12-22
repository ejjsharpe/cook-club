import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useScrollToTop } from "@react-navigation/native";
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
  runOnJS,
} from "react-native-reanimated";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { StyleSheet } from "react-native-unistyles";

import {
  useGetUserCollections,
  useToggleRecipeInCollection,
  useSearchPublicCollections,
} from "@/api/collection";
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
import {
  SearchTypeToggle,
  type SearchType,
} from "@/components/SearchTypeToggle";
import { VSpace } from "@/components/Space";
import { Text } from "@/components/Text";
import { UserSearchCard } from "@/components/UserSearchCard";
import { useDebounce } from "@/hooks/useDebounce";

interface Tag {
  id: number;
  name: string;
  type: string;
  count?: number;
}

interface User {
  id: string;
  name: string;
  email: string;
  image?: string | null;
}

interface RecommendedRecipe {
  id: number;
  name: string;
  description?: string | null;
  totalTime?: string | null;
  servings?: number | null;
  saveCount: number;
  likeCount: number;
  collectionIds: number[];
  isLiked: boolean;
  coverImage?: string | null;
  tags: Tag[];
  uploadedBy: User;
  createdAt: string;
}

interface CollectionResult {
  id: number;
  name: string;
  recipeCount: number;
  owner: {
    id: string;
    name: string;
    image: string | null;
  };
  createdAt: Date;
}

interface UserProfile {
  user: {
    id: string;
    name: string;
    email: string;
    image?: string | null;
    createdAt: string;
    updatedAt: string;
    emailVerified: boolean;
  };
}

// ─── Header Component ─────────────────────────────────────────────────────────

interface HeaderProps {
  userProfile: UserProfile | undefined;
  onAvatarPress: () => void;
}

const Header = memo(({ userProfile, onAvatarPress }: HeaderProps) => {
  const renderAvatar = () => {
    if (!userProfile) return null;
    return (
      <TouchableOpacity
        style={styles.avatar}
        onPress={onAvatarPress}
        activeOpacity={0.7}
      >
        {userProfile.user.image ? (
          <Image
            source={{ uri: userProfile.user.image }}
            style={styles.avatarImage}
            cachePolicy="memory-disk"
            transition={100}
          />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text type="heading" style={styles.avatarText}>
              {userProfile.user.name.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.headerContainer}>
      <View style={styles.headerRow}>
        <Text type="title2">
          cook
          <Text type="title2" style={styles.clubText}>
            club
          </Text>
        </Text>
        {renderAvatar()}
      </View>
    </View>
  );
});

// ─── Search Empty State ───────────────────────────────────────────────────────

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
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Track keyboard height for empty state centering
  useKeyboardHandler({
    onMove: (e) => {
      "worklet";
      runOnJS(setKeyboardHeight)(e.height);
    },
    onEnd: (e) => {
      "worklet";
      runOnJS(setKeyboardHeight)(e.height);
    },
  });

  // Track the search bar's Y position relative to the screen
  const searchBarY = useSharedValue(0);
  const searchBarMeasuredY = useRef(0);

  // Animation progress (0 = browse, 1 = search)
  const searchProgress = useSharedValue(0);

  // Filter button visibility (0 = hidden, 1 = visible) - animated separately for tab changes
  const filterButtonProgress = useSharedValue(1);

  // Target Y position for search mode (safe area top + padding)
  const searchModeY = insets.top + 20;

  const animationConfig = {
    duration: 300,
    easing: Easing.bezier(0.4, 0, 0.2, 1),
  };

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
  }, [isSearchActive]);

  // Animate filter button when tab changes
  useEffect(() => {
    filterButtonProgress.value = withTiming(
      activeTab === "recipes" ? 1 : 0,
      animationConfig,
    );
  }, [activeTab]);

  // Debounce search query
  const debouncedSearch = useDebounce(searchQuery, 300);

  // ─── API Hooks ────────────────────────────────────────────────────────────────
  const { data: userProfile } = useUser();
  const { data: userCollections = [] } = useGetUserCollections();
  const { data: allTags = [] } = useAllTags();
  const { data: popularRecipes = [] } = usePopularThisWeek();
  const likeRecipeMutation = useLikeRecipe();
  const toggleMutation = useToggleRecipeInCollection();

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

  const searchRecipes: RecommendedRecipe[] = useMemo(() => {
    if (!shouldFetchRecipes) return [];
    return recipeData?.pages.flatMap((page: any) => page?.items ?? []) ?? [];
  }, [recipeData, shouldFetchRecipes]);

  const collections: CollectionResult[] = useMemo(() => {
    if (!shouldFetchCollections) return [];
    return (
      collectionData?.pages.flatMap((page: any) => page?.items ?? []) ?? []
    );
  }, [collectionData, shouldFetchCollections]);

  const users: User[] = useMemo(() => {
    if (!shouldFetchUsers) return [];
    return usersData ?? [];
  }, [usersData, shouldFetchUsers]);

  // ─── Handlers ─────────────────────────────────────────────────────────────────
  const handleAvatarPress = useCallback(() => {
    if (userProfile?.user?.id) {
      navigation.navigate("UserProfile", { userId: userProfile.user.id });
    }
  }, [userProfile?.user?.id, navigation]);

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

  const handleSavePress = useCallback(
    (recipeId: number) => {
      CollectionSheetManager.show("collection-selector-sheet", {
        payload: { recipeId },
      });
    },
    [userCollections?.length, toggleMutation],
  );

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

  const handleTabChange = useCallback((tab: SearchType) => {
    setActiveTab(tab);
    if (tab !== "recipes") {
      setSelectedTagIds([]);
      setMaxTotalTime(undefined);
    }
  }, []);

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

  const renderUser = ({ item }: { item: User }) => (
    <View style={styles.userCardWrapper}>
      <UserSearchCard
        user={item}
        onUserPress={() => handleUserPress(item.id)}
      />
    </View>
  );

  // ─── Browse Mode Header ───────────────────────────────────────────────────────
  const BrowseListHeader = (
    <>
      <VSpace size={20} />
      <Header userProfile={userProfile} onAvatarPress={handleAvatarPress} />
      <VSpace size={16} />
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
      <VSpace size={24} />
      {featuredRecipe && (
        <>
          <FeaturedRecipeCard
            recipe={featuredRecipe}
            onPress={() => handleRecipePress(featuredRecipe.id)}
          />
          <VSpace size={24} />
        </>
      )}
      {popularRecipes.length > 0 && (
        <RecipeCarousel
          title="Popular this week"
          recipes={popularRecipes}
          onRecipePress={handleRecipePress}
        />
      )}
      <VSpace size={24} />
    </>
  );

  // ─── Search Mode Header ───────────────────────────────────────────────────────
  // The search bar, back button, filter button, and tab switcher are rendered as
  // fixed elements outside the FlatList. FlatList only contains search results.
  const SearchListHeader = useMemo(() => <VSpace size={16} />, []);

  // ─── Search Empty State ───────────────────────────────────────────────────────
  const renderSearchEmpty = () => {
    const isFetching =
      (activeTab === "recipes" && (recipesPending || recipesFetching)) ||
      (activeTab === "collections" &&
        (collectionsPending || collectionsFetching)) ||
      (activeTab === "users" && (usersPending || usersFetching));

    const shouldFetch =
      (activeTab === "recipes" && shouldFetchRecipes) ||
      (activeTab === "collections" && shouldFetchCollections) ||
      (activeTab === "users" && shouldFetchUsers);

    // Calculate padding to center content between keyboard and scrollable area top
    // The fixed header includes: safe area top + 20px padding + search bar height + 12px gap + tabs height (~40px) + 16px bottom padding
    const fixedHeaderHeight = insets.top + SEARCH_BAR_HEIGHT;
    const keyboardPadding = keyboardHeight > 0 ? keyboardHeight / 2 : 0;
    const emptyStateStyle = {
      paddingBottom: keyboardPadding + fixedHeaderHeight,
    };

    if (isFetching && shouldFetch) {
      const loadingText =
        activeTab === "recipes"
          ? "Searching recipes..."
          : activeTab === "collections"
            ? "Searching collections..."
            : "Searching users...";

      return (
        <View style={[styles.emptyState, emptyStateStyle]}>
          <ActivityIndicator size="large" />
          <VSpace size={16} />
          <Text type="bodyFaded">{loadingText}</Text>
        </View>
      );
    }

    if (!shouldFetch) {
      let icon: "search-outline" | "albums-outline" | "people-outline" =
        "search-outline";
      let title = "Start searching";
      let subtitle = "";

      if (activeTab === "recipes") {
        icon = "search-outline";
        title = "Start searching";
        subtitle =
          "Enter a search term or select a cuisine/category to discover recipes";
      } else if (activeTab === "collections") {
        icon = "albums-outline";
        title = "Search collections";
        subtitle = "Find recipe collections from other users";
      } else {
        icon = "people-outline";
        title = "Search users";
        subtitle = "Find other cooks to follow";
      }

      return (
        <View style={[styles.emptyState, emptyStateStyle]}>
          <Ionicons name={icon} size={64} style={styles.emptyIcon} />
          <VSpace size={16} />
          <Text type="heading">{title}</Text>
          <VSpace size={8} />
          <Text type="bodyFaded" style={styles.emptyText}>
            {subtitle}
          </Text>
        </View>
      );
    }

    let icon: "restaurant-outline" | "albums-outline" | "people-outline" =
      "restaurant-outline";
    let title = "No results found";
    let subtitle = "Try a different search term";

    if (activeTab === "recipes") {
      icon = "restaurant-outline";
      title = "No recipes found";
      subtitle = "Try adjusting your filters or search query";
    } else if (activeTab === "collections") {
      icon = "albums-outline";
      title = "No collections found";
      subtitle = "Try a different search term";
    } else {
      icon = "people-outline";
      title = "No users found";
      subtitle = "Try a different search term";
    }

    return (
      <View style={[styles.emptyState, emptyStateStyle]}>
        <Ionicons name={icon} size={64} style={styles.emptyIcon} />
        <VSpace size={16} />
        <Text type="heading">{title}</Text>
        <VSpace size={8} />
        <Text type="bodyFaded" style={styles.emptyText}>
          {subtitle}
        </Text>
      </View>
    );
  };

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

  const searchKeyExtractor = (item: any) =>
    activeTab === "recipes"
      ? item.id.toString()
      : activeTab === "collections"
        ? `collection-${item.id}`
        : item.id;

  const canRefresh =
    (activeTab === "recipes" && shouldFetchRecipes) ||
    (activeTab === "collections" && shouldFetchCollections) ||
    (activeTab === "users" && shouldFetchUsers);

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
            <SearchTypeToggle
              value={activeTab}
              onValueChange={handleTabChange}
            />
          </View>
          <VSpace size={16} />
        </SafeAreaView>

        {/* Scrollable search results */}
        <FlatList
          ref={searchListRef}
          data={searchData}
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
              enabled={canRefresh}
            />
          }
          showsVerticalScrollIndicator={false}
          style={styles.searchResultsList}
          contentContainerStyle={styles.searchResultsContent}
        />
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
    borderRadius: theme.borderRadius.medium,
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
  userCardWrapper: {
    paddingHorizontal: 20,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    alignItems: "center",
  },
  emptyIcon: {
    color: theme.colors.border,
  },
  emptyText: {
    textAlign: "center",
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: "center",
  },
}));
