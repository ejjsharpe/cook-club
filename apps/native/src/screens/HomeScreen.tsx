import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useScrollToTop } from "@react-navigation/native";
import { useTRPC } from "@repo/trpc/client";
import { FlashList, type FlashListRef } from "@shopify/flash-list";
import { useQueryClient } from "@tanstack/react-query";
import { useState, useCallback, useMemo, useRef, memo, useEffect } from "react";
import {
  View,
  TouchableOpacity,
  Pressable,
  RefreshControl,
  FlatList,
  Alert,
  ActivityIndicator,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { useKeyboardHandler } from "react-native-keyboard-controller";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  Easing,
  type SharedValue,
} from "react-native-reanimated";
import { StyleSheet, UnistylesRuntime } from "react-native-unistyles";

import {
  useActivityFeed,
  useToggleActivityLike,
  FeedItem,
} from "@/api/activity";
import { useSearchUsers, SearchUser } from "@/api/follows";
import { useUser, User } from "@/api/user";
import { Avatar } from "@/components/Avatar";
import {
  CommentsSheet,
  type CommentsSheetRef,
} from "@/components/CommentsSheet";
import { EmptyFeedState } from "@/components/EmptyFeedState";
import { ImportActivityCard } from "@/components/ImportActivityCard";
import { ReviewActivityCard } from "@/components/ReviewActivityCard";
import { SearchBar, SEARCH_BAR_HEIGHT } from "@/components/SearchBar";
import { SearchEmptyState } from "@/components/SearchEmptyState";
import { HomeFeedSkeleton, SkeletonContainer } from "@/components/Skeleton";
import { VSpace } from "@/components/Space";
import { Text } from "@/components/Text";
import { UserSearchCard } from "@/components/UserSearchCard";
import { useDebounce } from "@/hooks/useDebounce";

// ─── Header Component ─────────────────────────────────────────────────────────

interface HeaderProps {
  user: User | undefined;
  onAvatarPress: () => void;
  titleOpacity: SharedValue<number>;
  avatarOpacity: SharedValue<number>;
}

const Header = memo(
  ({ user, onAvatarPress, titleOpacity, avatarOpacity }: HeaderProps) => {
    const titleAnimatedStyle = useAnimatedStyle(() => ({
      opacity: titleOpacity.value,
    }));

    const avatarAnimatedStyle = useAnimatedStyle(() => ({
      opacity: avatarOpacity.value,
    }));

    return (
      <View style={styles.headerContainer}>
        <View style={styles.headerRow}>
          <Animated.View style={titleAnimatedStyle}>
            <Text type="screenTitle" style={styles.headerTitle}>
              cook
              <Text
                type="screenTitle"
                style={[styles.headerTitle, styles.clubText]}
              >
                club
              </Text>
            </Text>
          </Animated.View>
          {user && (
            <Animated.View style={avatarAnimatedStyle}>
              <Avatar
                imageUrl={user.image}
                name={user.name}
                size={44}
                onPress={onAvatarPress}
              />
            </Animated.View>
          )}
        </View>
      </View>
    );
  },
);

// ─── Constants ───────────────────────────────────────────────────────────────
const HORIZONTAL_PADDING = 20;
const BACK_BUTTON_WIDTH = 44;
const HEADER_GAP = 12;
const HEADER_HEIGHT = 52; // Height of the cook club title + avatar row

// ─── Main Component ───────────────────────────────────────────────────────────

export const HomeScreen = () => {
  const browseScrollRef = useRef<FlashListRef<FeedItem>>(null);
  const searchListRef = useRef<FlatList>(null);
  const searchBarRef = useRef<View>(null);
  const commentsSheetRef = useRef<CommentsSheetRef>(null);
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
  const [commentActivityId, setCommentActivityId] = useState<number>(0);

  // Track the search bar's Y position relative to the screen
  const searchBarY = useSharedValue(0);
  const searchBarMeasuredY = useRef(0);

  // Animation progress (0 = browse, 1 = search)
  const searchProgress = useSharedValue(0);

  // Scroll tracking for header fade
  const scrollY = useSharedValue(0);
  const titleOpacity = useSharedValue(1);
  const avatarOpacity = useSharedValue(1);

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

  // Target Y position for search mode (at the top where the header is)
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

  const toggleLike = useToggleActivityLike();

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
    // Measure the search bar position before transitioning (same as handleSearchFocus)
    searchBarRef.current?.measureInWindow((_x, y) => {
      searchBarMeasuredY.current = y;
      searchBarY.value = y;
      setIsSearchActive(true);
    });
  }, [searchBarY]);

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

  const handleLikePress = useCallback(
    (activityEventId: number) => {
      toggleLike.mutate({ activityEventId });
    },
    [toggleLike],
  );

  const handleCommentPress = useCallback((activityEventId: number) => {
    setCommentActivityId(activityEventId);
    commentsSheetRef.current?.present();
  }, []);

  // ─── Scroll Handler with Header Fade ────────────────────────────────────────────
  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = event.nativeEvent.contentOffset.y;
      scrollY.value = y;

      // Fade out when search bar would collide with header
      // Title fades first, avatar fades slightly after
      const titleShouldHide = y > 5;
      titleOpacity.value = withTiming(titleShouldHide ? 0 : 1, {
        duration: 150,
      });

      const avatarShouldHide = y > 10;
      avatarOpacity.value = withTiming(avatarShouldHide ? 0 : 1, {
        duration: 150,
      });
    },
    [scrollY, titleOpacity, avatarOpacity],
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
  const getActivityItemType = useCallback((item: FeedItem) => item.type, []);

  const renderActivityItem = useCallback(
    ({ item }: { item: FeedItem }) => {
      const activityId = parseInt(item.id, 10);

      if (item.type === "cooking_review") {
        return (
          <ReviewActivityCard
            activity={item}
            onPress={() => handleRecipePress(item.recipe.id)}
            onUserPress={() => handleUserPress(item.actor.id)}
            onLikePress={() => handleLikePress(activityId)}
            onCommentPress={() => handleCommentPress(activityId)}
            onImportPress={handleImportRecipe}
          />
        );
      }

      return (
        <ImportActivityCard
          activity={item}
          onPress={() => handleRecipePress(item.recipe.id)}
          onUserPress={() => handleUserPress(item.actor.id)}
          onLikePress={() => handleLikePress(activityId)}
          onCommentPress={() => handleCommentPress(activityId)}
          onImportPress={handleImportRecipe}
        />
      );
    },
    [
      handleRecipePress,
      handleUserPress,
      handleLikePress,
      handleCommentPress,
      handleImportRecipe,
    ],
  );

  const activityKeyExtractor = useCallback((item: FeedItem) => item.id, []);

  // ─── Browse Mode Header ───────────────────────────────────────────────────────
  // The Header is rendered as a fixed element outside the list
  const BrowseListHeader = useMemo(
    () => (
      <>
        <VSpace size={insets.top + HEADER_HEIGHT + 8} />
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
        <VSpace size={8} />
      </>
    ),
    [showFloatingSearch, handleSearchFocus, insets.top],
  );

  // ─── Activity Feed Empty State ─────────────────────────────────────────────────
  const renderActivityEmpty = useCallback(() => {
    return <EmptyFeedState onDiscoverPress={handleDiscoverPress} />;
  }, [handleDiscoverPress]);

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
  // FlatList only contains search results with top spacing for the fixed header.
  const SearchListHeader = useMemo(
    () => <VSpace size={insets.top + SEARCH_BAR_HEIGHT + 16} />,
    [insets.top],
  );

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
        <View style={styles.feedContainer}>
          <SkeletonContainer
            isLoading={activityPending}
            skeleton={
              <FlatList
                ListHeaderComponent={BrowseListHeader}
                ListEmptyComponent={HomeFeedSkeleton}
                data={[]}
                renderItem={() => null}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.feedContent}
              />
            }
          >
            <FlashList
              ref={browseScrollRef}
              data={activityFeedItems}
              renderItem={renderActivityItem}
              getItemType={getActivityItemType}
              keyExtractor={activityKeyExtractor}
              ListHeaderComponent={BrowseListHeader}
              ListEmptyComponent={renderActivityEmpty}
              ListFooterComponent={renderActivityFooter}
              ItemSeparatorComponent={() => <VSpace size={16} />}
              onEndReached={handleActivityLoadMore}
              onEndReachedThreshold={0.5}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.feedContent}
              onScroll={handleScroll}
              scrollEventThrottle={16}
              refreshControl={
                <RefreshControl
                  refreshing={isRefreshing && !isSearchActive}
                  onRefresh={handleRefresh}
                />
              }
            />
          </SkeletonContainer>
        </View>

        {/* Fixed Header - stays in place while content scrolls beneath */}
        <View style={styles.fixedHeader}>
          <Header
            user={user}
            onAvatarPress={handleAvatarPress}
            titleOpacity={titleOpacity}
            avatarOpacity={avatarOpacity}
          />
        </View>
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
        {/* Scrollable search results */}
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
              placeholder="Search users..."
            />
          </Animated.View>
        </>
      )}

      {/* Comments Sheet */}
      <CommentsSheet
        ref={commentsSheetRef}
        activityEventId={commentActivityId}
      />
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
  searchResultsContent: {
    flexGrow: 1,
    paddingBottom: rt.insets.bottom,
  },
  feedContainer: {
    flex: 1,
  },
  feedContent: {
    paddingBottom: rt.insets.bottom,
  },
  fixedHeader: {
    position: "absolute",
    top: rt.insets.top,
    left: 0,
    right: 0,
  },
  headerContainer: {
    paddingHorizontal: 20,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    textAlignVertical: "center",
  },
  headerTitle: {},
  clubText: {
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
  userCardWrapper: {
    paddingHorizontal: 20,
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: "center",
  },
}));
