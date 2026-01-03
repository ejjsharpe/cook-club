import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useScrollToTop } from "@react-navigation/native";
import { useTRPC } from "@repo/trpc/client";
import { useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useState, useCallback, useMemo, useRef, memo, useEffect } from "react";
import {
  View,
  TouchableOpacity,
  Pressable,
  RefreshControl,
  FlatList,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useKeyboardHandler } from "react-native-keyboard-controller";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  Easing,
} from "react-native-reanimated";
import { StyleSheet, UnistylesRuntime } from "react-native-unistyles";

import { useActivityFeed, FeedItem } from "@/api/activity";
import { useSearchUsers, SearchUser } from "@/api/follows";
import { useUser, User } from "@/api/user";
import { EmptyFeedState } from "@/components/EmptyFeedState";
import { HomeFeedSkeleton } from "@/components/Skeleton";
import { ImportActivityCard } from "@/components/ImportActivityCard";
import { ReviewActivityCard } from "@/components/ReviewActivityCard";
import { SafeAreaView } from "@/components/SafeAreaView";
import { SearchBar, SEARCH_BAR_HEIGHT } from "@/components/SearchBar";
import { SearchEmptyState } from "@/components/SearchEmptyState";
import { VSpace } from "@/components/Space";
import { Text } from "@/components/Text";
import { UserSearchCard } from "@/components/UserSearchCard";
import { useDebounce } from "@/hooks/useDebounce";

// ─── Header Component ─────────────────────────────────────────────────────────

interface HeaderProps {
  user: User | undefined;
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

// ─── Constants ───────────────────────────────────────────────────────────────
const HORIZONTAL_PADDING = 20;
const BACK_BUTTON_WIDTH = 44;
const HEADER_GAP = 12;

// ─── Main Component ───────────────────────────────────────────────────────────

export const HomeScreen = () => {
  const browseScrollRef = useRef<FlatList>(null);
  const searchListRef = useRef<FlatList>(null);
  const searchBarRef = useRef<View>(null);
  useScrollToTop(browseScrollRef);
  const navigation = useNavigation();
  const insets = UnistylesRuntime.insets;
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // ─── State ────────────────────────────────────────────────────────────────────
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [showFloatingSearch, setShowFloatingSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isImporting, setIsImporting] = useState(false);

  // Track the search bar's Y position relative to the screen
  const searchBarY = useSharedValue(0);
  const searchBarMeasuredY = useRef(0);

  // Animation progress (0 = browse, 1 = search)
  const searchProgress = useSharedValue(0);

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

  // Debounce search query
  const debouncedSearch = useDebounce(searchQuery, 300);

  // ─── API Hooks ────────────────────────────────────────────────────────────────
  const { data: userData } = useUser();
  const user = userData?.user;

  // Activity feed
  const {
    data: activityData,
    isPending: activityPending,
    isFetchingNextPage: activityFetchingNext,
    hasNextPage: activityHasNext,
    fetchNextPage: activityFetchNext,
    refetch: activityRefetch,
  } = useActivityFeed();

  // Search condition - only search users
  const shouldFetchUsers = isSearchActive && debouncedSearch.length >= 2;

  const {
    data: usersData,
    isPending: usersPending,
    refetch: usersRefetch,
    isFetching: usersFetching,
  } = useSearchUsers({
    query: debouncedSearch,
  });

  // ─── Flatten Data ─────────────────────────────────────────────────────────────
  const activityFeedItems = useMemo(() => {
    return activityData?.pages.flatMap((page) => page?.items ?? []) ?? [];
  }, [activityData]);

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

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    if (isSearchActive) {
      if (shouldFetchUsers) {
        await usersRefetch();
      }
    } else {
      await activityRefetch();
    }
    setIsRefreshing(false);
  }, [isSearchActive, shouldFetchUsers, usersRefetch, activityRefetch]);

  const handleActivityLoadMore = useCallback(() => {
    if (activityHasNext && !activityFetchingNext) {
      activityFetchNext();
    }
  }, [activityHasNext, activityFetchingNext, activityFetchNext]);

  const handleDiscoverPress = useCallback(() => {
    // Activate search mode
    setIsSearchActive(true);
  }, []);

  const handleImportRecipe = useCallback(
    async (sourceUrl: string) => {
      if (isImporting) return;

      setIsImporting(true);
      try {
        const result = await queryClient.fetchQuery(
          trpc.recipe.parseRecipeFromUrl.queryOptions({ url: sourceUrl }),
        );

        if (result.success) {
          navigation.navigate("EditRecipe", { parsedRecipe: result });
        } else {
          Alert.alert("Error", "Failed to parse recipe from URL");
        }
      } catch (error) {
        console.error("Import error:", error);
        Alert.alert("Error", "Something went wrong. Please try again.");
      } finally {
        setIsImporting(false);
      }
    },
    [isImporting, queryClient, trpc, navigation],
  );

  // ─── Render Functions ─────────────────────────────────────────────────────────
  const renderUser = ({ item }: { item: SearchUser }) => (
    <View style={styles.userCardWrapper}>
      <UserSearchCard
        user={item}
        onUserPress={() => handleUserPress(item.id)}
      />
    </View>
  );

  // ─── Activity Feed Render Function ────────────────────────────────────────────
  const renderActivityItem = useCallback(
    ({ item }: { item: FeedItem }) => {
      if (item.type === "cooking_review") {
        return (
          <ReviewActivityCard
            activity={item}
            onPress={() => handleRecipePress(item.recipe.id)}
            onUserPress={() => handleUserPress(item.actor.id)}
            onImportPress={handleImportRecipe}
          />
        );
      }

      return (
        <ImportActivityCard
          activity={item}
          onPress={() => handleRecipePress(item.recipe.id)}
          onUserPress={() => handleUserPress(item.actor.id)}
          onImportPress={handleImportRecipe}
        />
      );
    },
    [handleRecipePress, handleUserPress, handleImportRecipe],
  );

  const activityKeyExtractor = useCallback((item: FeedItem) => item.id, []);

  // ─── Browse Mode Header ───────────────────────────────────────────────────────
  const BrowseListHeader = useMemo(
    () => (
      <>
        <VSpace size={24} />
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
              placeholder="Search users..."
            />
          </View>
        </Pressable>
        <VSpace size={16} />
      </>
    ),
    [user, handleAvatarPress, showFloatingSearch, handleSearchFocus],
  );

  // ─── Activity Feed Empty State ─────────────────────────────────────────────────
  const renderActivityEmpty = useCallback(() => {
    if (activityPending) {
      return <HomeFeedSkeleton />;
    }
    return <EmptyFeedState onDiscoverPress={handleDiscoverPress} />;
  }, [activityPending, handleDiscoverPress]);

  // ─── Activity Feed Footer ──────────────────────────────────────────────────────
  const renderActivityFooter = useCallback(() => {
    if (!activityFetchingNext) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="large" />
        <VSpace size={20} />
      </View>
    );
  }, [activityFetchingNext]);

  // ─── Search Mode Header ───────────────────────────────────────────────────────
  // The search bar and back button are rendered as fixed elements outside the FlatList.
  // FlatList only contains search results.
  const SearchListHeader = useMemo(() => <VSpace size={16} />, []);

  // ─── Search Empty State ───────────────────────────────────────────────────────
  const isFetching = usersPending || usersFetching;

  const fixedHeaderHeight = insets.top + SEARCH_BAR_HEIGHT;

  const renderSearchEmpty = () => (
    <SearchEmptyState
      activeTab="users"
      isFetching={isFetching}
      shouldFetch={shouldFetchUsers}
      keyboardHeight={keyboardHeight}
      fixedHeaderHeight={fixedHeaderHeight}
    />
  );

  const searchKeyExtractor = (item: SearchUser) => item.id;

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
      right: HORIZONTAL_PADDING,
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

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <View style={styles.screen}>
      {/* Browse Mode - Activity Feed */}
      <Animated.View
        style={[styles.listContainer, browseAnimatedStyle]}
        pointerEvents={showFloatingSearch ? "none" : "auto"}
      >
        <SafeAreaView edges={["top"]} style={styles.feedContainer}>
          <FlatList
            ref={browseScrollRef}
            data={activityFeedItems}
            renderItem={renderActivityItem}
            keyExtractor={activityKeyExtractor}
            ListHeaderComponent={BrowseListHeader}
            ListEmptyComponent={renderActivityEmpty}
            ListFooterComponent={renderActivityFooter}
            onEndReached={handleActivityLoadMore}
            onEndReachedThreshold={0.5}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.feedContent}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing && !isSearchActive}
                onRefresh={handleRefresh}
              />
            }
          />
        </SafeAreaView>
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
        {/* Fixed header */}
        <SafeAreaView edges={["top"]} style={styles.searchFixedHeader}>
          {/* Spacer for the floating search bar row */}
          <VSpace size={20 + SEARCH_BAR_HEIGHT + 12} />
        </SafeAreaView>

        {/* Scrollable search results */}
        <View style={styles.searchResultsList}>
          <FlatList
            ref={searchListRef}
            data={users}
            renderItem={renderUser}
            keyExtractor={searchKeyExtractor}
            ListHeaderComponent={SearchListHeader}
            ListEmptyComponent={renderSearchEmpty}
            onEndReachedThreshold={0.5}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing && isSearchActive}
                onRefresh={handleRefresh}
                enabled={shouldFetchUsers}
              />
            }
            showsVerticalScrollIndicator={false}
            style={styles.flatListFlex}
            contentContainerStyle={styles.searchResultsContent}
          />
        </View>
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
              placeholder="Search users..."
            />
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
  feedContainer: {
    flex: 1,
  },
  feedContent: {
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
    width: 44,
    height: 50,
    justifyContent: "center",
    alignItems: "center",
  },
  backIcon: {
    color: theme.colors.text,
  },
  userCardWrapper: {
    paddingHorizontal: 20,
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: "center",
  },
}));
