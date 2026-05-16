import { useNavigation, useScrollToTop } from "@react-navigation/native";
import { useTRPC } from "@repo/trpc/client";
import {
  FlashList,
  type FlashListRef,
  type ListRenderItemInfo,
} from "@shopify/flash-list";
import { useMutation } from "@tanstack/react-query";
import { useState, useCallback, useMemo, useRef, memo, useEffect } from "react";
import {
  View,
  Pressable,
  RefreshControl,
  FlatList,
  Alert,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { useKeyboardHandler } from "react-native-keyboard-controller";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  Easing,
  type SharedValue,
  withSpring,
  useAnimatedScrollHandler,
  runOnJS,
} from "react-native-reanimated";
import { StyleSheet, UnistylesRuntime } from "react-native-unistyles";

import {
  ActivityFeedListItem,
  useActivityFeed,
  useToggleActivityLike,
} from "@/api/activity";
import { useSearchUsers, SearchUser } from "@/api/follows";
import { useUnreadNotificationCount } from "@/api/notification";
import { useImportRecipe } from "@/api/recipe";
import { useUser, User } from "@/api/user";
import { Avatar } from "@/components/Avatar";
import {
  CommentsSheet,
  type CommentsSheetRef,
} from "@/components/CommentsSheet";
import { EmptyFeedState } from "@/components/EmptyFeedState";
import { ImportActivityCard } from "@/components/ImportActivityCard";
import { Ionicons } from "@/components/Ionicons";
import { NotificationBadge } from "@/components/NotificationBadge";
import { ReviewActivityCard } from "@/components/ReviewActivityCard";
import { SearchBar, SEARCH_BAR_HEIGHT } from "@/components/SearchBar";
import { SearchEmptyState } from "@/components/SearchEmptyState";
import { HomeFeedSkeleton, SkeletonContainer } from "@/components/Skeleton";
import { VSpace } from "@/components/Space";
import { Text } from "@/components/Text";
import { UserSearchCard } from "@/components/UserSearchCard";
import { ScalePressable } from "@/components/buttons/ScalePressable";
import { useDebounce } from "@/hooks/useDebounce";
import {
  createBackgroundImportId,
  useBackgroundImportQueue,
} from "@/lib/backgroundImportQueue";

// ─── Header Component ─────────────────────────────────────────────────────────

interface HeaderProps {
  user: User | undefined;
  onAvatarPress: () => void;
  onNotificationPress: () => void;
  unreadCount: number;
  titleOpacity: SharedValue<number>;
  avatarOpacity: SharedValue<number>;
}

const Header = memo(
  ({
    user,
    onAvatarPress,
    onNotificationPress,
    unreadCount,
    titleOpacity,
    avatarOpacity,
  }: HeaderProps) => {
    const notificationScale = useSharedValue(1);
    const avatarScale = useSharedValue(1);

    const titleAnimatedStyle = useAnimatedStyle(() => ({
      opacity: titleOpacity.value,
    }));

    const avatarOpacityStyle = useAnimatedStyle(() => ({
      opacity: avatarOpacity.value,
    }));

    const notificationAnimatedStyle = useAnimatedStyle(() => ({
      transform: [{ scale: notificationScale.value }],
    }));

    const avatarAnimatedStyle = useAnimatedStyle(() => ({
      transform: [{ scale: avatarScale.value }],
    }));

    const handleNotificationPressIn = () => {
      notificationScale.value = withSpring(0.9, { mass: 1 });
    };

    const handleNotificationPressOut = () => {
      notificationScale.value = withSpring(1);
    };

    const handleAvatarPressIn = () => {
      avatarScale.value = withSpring(0.9, { mass: 1 });
    };

    const handleAvatarPressOut = () => {
      avatarScale.value = withSpring(1);
    };

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
          <View style={styles.headerActions}>
            <Animated.View
              style={[avatarOpacityStyle, notificationAnimatedStyle]}
            >
              <Pressable
                onPress={onNotificationPress}
                onPressIn={handleNotificationPressIn}
                onPressOut={handleNotificationPressOut}
                style={styles.notificationButton}
              >
                <Ionicons
                  name="notifications"
                  size={24}
                  style={styles.notificationIcon}
                />
                <NotificationBadge count={unreadCount} />
              </Pressable>
            </Animated.View>
            {user && (
              <Animated.View style={[avatarOpacityStyle, avatarAnimatedStyle]}>
                <Pressable
                  onPress={onAvatarPress}
                  onPressIn={handleAvatarPressIn}
                  onPressOut={handleAvatarPressOut}
                >
                  <Avatar imageUrl={user.image} name={user.name} size={44} />
                </Pressable>
              </Animated.View>
            )}
          </View>
        </View>
      </View>
    );
  },
);

// ─── Constants ───────────────────────────────────────────────────────────────
const { width: SCREEN_WIDTH } = Dimensions.get("window");
const HORIZONTAL_PADDING = 20;
const BACK_BUTTON_WIDTH = 44;
const HEADER_GAP = 6;
const HEADER_HEIGHT = 52; // Height of the cook club title + avatar row
const SCROLLED_DOWN_LIMIT = 200;
const TAB_BAR_LIST_CLEARANCE = 112;

const ActivitySeparator = () => <VSpace size={16} />;
const ReanimatedFlashList = Animated.createAnimatedComponent(
  FlashList<ActivityFeedListItem>,
);

interface SearchUserRowProps {
  user: SearchUser;
  onUserPress: (userId: string) => void;
}

const SearchUserRow = memo(({ user, onUserPress }: SearchUserRowProps) => {
  const handlePress = useCallback(() => {
    onUserPress(user.id);
  }, [user.id, onUserPress]);

  return (
    <View style={styles.userCardWrapper}>
      <UserSearchCard user={user} onUserPress={handlePress} />
    </View>
  );
});

// ─── Main Component ───────────────────────────────────────────────────────────

export const HomeScreen = () => {
  const browseScrollRef = useRef<FlashListRef<ActivityFeedListItem>>(null);
  const searchListRef = useRef<FlatList>(null);
  const searchBarRef = useRef<View>(null);
  const commentsSheetRef = useRef<CommentsSheetRef>(null);
  useScrollToTop(browseScrollRef);
  const navigation = useNavigation();
  const insets = UnistylesRuntime.insets;
  const listBottomPadding = TAB_BAR_LIST_CLEARANCE;
  const trpc = useTRPC();
  const parseRecipeFromUrl = useMutation(
    trpc.recipe.parseRecipeFromUrl.mutationOptions({ retry: false }),
  );
  const importRecipeMutation = useImportRecipe();
  const { startImport } = useBackgroundImportQueue();

  // ─── State ────────────────────────────────────────────────────────────────────
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [showFloatingSearch, setShowFloatingSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [commentActivityId, setCommentActivityId] = useState<number>(0);
  const [showLoadLatest, setShowLoadLatest] = useState(false);

  // Track the search bar's Y position relative to the screen
  const searchBarY = useSharedValue(0);
  const searchBarMeasuredY = useRef(0);

  // Animation progress (0 = browse, 1 = search)
  const searchProgress = useSharedValue(0);

  // Scroll tracking for header fade
  const scrollY = useSharedValue(0);
  const titleOpacity = useSharedValue(1);
  const avatarOpacity = useSharedValue(1);
  const titleHidden = useSharedValue(false);
  const avatarHidden = useSharedValue(false);
  const isScrolledDown = useSharedValue(false);

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

  // Notification unread count (poll every 60s)
  const { data: unreadData } = useUnreadNotificationCount({
    refetchInterval: 60000,
  });
  const unreadCount = unreadData?.count ?? 0;

  // Activity feed
  const {
    data: activityFeedItems = [],
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

  const handleNotificationPress = useCallback(() => {
    navigation.navigate("Notifications");
  }, [navigation]);

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
        try {
          await usersRefetch();
        } finally {
          setIsRefreshing(false);
        }
        return;
      }
    } else {
      setShowLoadLatest(false);
      try {
        await activityRefetch();
      } finally {
        setIsRefreshing(false);
      }
      return;
    }
    setIsRefreshing(false);
  }, [isSearchActive, shouldFetchUsers, usersRefetch, activityRefetch]);

  const handleLoadLatest = useCallback(async () => {
    browseScrollRef.current?.scrollToOffset({ offset: 0, animated: true });
    setShowLoadLatest(false);
    await activityRefetch();
  }, [activityRefetch]);

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
    (sourceUrl: string) => {
      startImport({
        id: createBackgroundImportId("url"),
        mode: "url",
        title: sourceUrl,
        run: () => parseRecipeFromUrl.mutateAsync({ url: sourceUrl }),
      });
      navigation.navigate("Add recipe");
    },
    [navigation, parseRecipeFromUrl, startImport],
  );

  const handleImportExistingRecipe = useCallback(
    async (recipeId: number) => {
      try {
        await importRecipeMutation.mutateAsync({ recipeId });
        Alert.alert("Success", "Recipe added to your collection!");
      } catch (err: any) {
        Alert.alert("Error", err?.message || "Failed to import recipe");
      }
    },
    [importRecipeMutation],
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
  const handleScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      const y = event.contentOffset.y;
      scrollY.value = y;

      const nextTitleHidden = y > 5;
      if (titleHidden.value !== nextTitleHidden) {
        titleHidden.value = nextTitleHidden;
        titleOpacity.value = withTiming(nextTitleHidden ? 0 : 1, {
          duration: 150,
        });
      }

      const nextAvatarHidden = y > 10;
      if (avatarHidden.value !== nextAvatarHidden) {
        avatarHidden.value = nextAvatarHidden;
        avatarOpacity.value = withTiming(nextAvatarHidden ? 0 : 1, {
          duration: 150,
        });
      }

      const nextScrolledDown = y > SCROLLED_DOWN_LIMIT;
      if (isScrolledDown.value !== nextScrolledDown) {
        isScrolledDown.value = nextScrolledDown;
        runOnJS(setShowLoadLatest)(nextScrolledDown);
      }
    },
  });

  // ─── Render Functions ─────────────────────────────────────────────────────────
  const renderUser = useCallback(
    ({ item }: { item: SearchUser }) => (
      <SearchUserRow user={item} onUserPress={handleUserPress} />
    ),
    [handleUserPress],
  );

  // ─── Activity Feed Render Function ────────────────────────────────────────────
  const getActivityItemType = useCallback(
    (item: ActivityFeedListItem) => item.type,
    [],
  );

  const renderActivityItem = useCallback(
    ({ item }: ListRenderItemInfo<ActivityFeedListItem>) => {
      if (item.type === "cooking_review") {
        return (
          <ReviewActivityCard
            activity={item}
            onRecipePress={handleRecipePress}
            onUserPress={handleUserPress}
            onLikePress={handleLikePress}
            onCommentPress={handleCommentPress}
            onImportPress={handleImportRecipe}
            onImportRecipePress={handleImportExistingRecipe}
            timeAgo={item._display.timeAgo}
            userInitials={item._display.userInitials}
          />
        );
      }

      return (
        <ImportActivityCard
          activity={item}
          onRecipePress={handleRecipePress}
          onUserPress={handleUserPress}
          onLikePress={handleLikePress}
          onCommentPress={handleCommentPress}
          onImportPress={handleImportRecipe}
          onImportRecipePress={handleImportExistingRecipe}
          timeAgo={item._display.timeAgo}
          userInitials={item._display.userInitials}
          sourceDescription={item._display.sourceDescription}
        />
      );
    },
    [
      handleRecipePress,
      handleUserPress,
      handleLikePress,
      handleCommentPress,
      handleImportRecipe,
      handleImportExistingRecipe,
    ],
  );

  const activityKeyExtractor = useCallback(
    (item: ActivityFeedListItem) => item.id,
    [],
  );

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
  // Using a two-layer clip technique for GPU-accelerated animation:
  // 1. Outer clip wrapper with overflow:hidden animates position (transforms) and width
  // 2. Inner search bar width snaps to endWidth when animation completes for proper input visibility
  const startWidth = SCREEN_WIDTH - HORIZONTAL_PADDING * 2;
  const endWidth =
    SCREEN_WIDTH - HORIZONTAL_PADDING * 2 - BACK_BUTTON_WIDTH - HEADER_GAP;
  const BACK_BUTTON_OFFSET = BACK_BUTTON_WIDTH + HEADER_GAP;

  // Outer clip wrapper - animates position and clips content
  const floatingSearchClipStyle = useAnimatedStyle(() => {
    "worklet";
    const baseY = searchBarY.value || searchModeY;
    const deltaY = searchModeY - baseY;
    const clipWidth =
      startWidth + searchProgress.value * (endWidth - startWidth);

    return {
      top: baseY,
      width: clipWidth,
      overflow: "hidden" as const,
      // GPU-accelerated position animation
      transform: [
        { translateX: searchProgress.value * BACK_BUTTON_OFFSET },
        { translateY: searchProgress.value * deltaY },
      ],
    };
  });

  // Inner search bar - full width during animation, snaps to endWidth when complete
  const floatingSearchInnerStyle = useAnimatedStyle(() => {
    "worklet";
    // When animation is complete, snap to endWidth so input area is fully visible
    const width = searchProgress.value === 1 ? endWidth : startWidth;
    return { width };
  });

  // Back button scales in
  const backButtonAnimatedStyle = useAnimatedStyle(() => ({
    position: "absolute",
    top: searchModeY,
    left: HORIZONTAL_PADDING,
    opacity: searchProgress.value,
    transform: [{ scale: searchProgress.value }],
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
                contentContainerStyle={[
                  styles.feedContent,
                  { paddingBottom: listBottomPadding },
                ]}
              />
            }
          >
            <ReanimatedFlashList
              maintainVisibleContentPosition={{ disabled: true }}
              ref={browseScrollRef}
              data={activityFeedItems}
              renderItem={renderActivityItem}
              getItemType={getActivityItemType}
              keyExtractor={activityKeyExtractor}
              ListHeaderComponent={BrowseListHeader}
              ListEmptyComponent={renderActivityEmpty}
              ListFooterComponent={renderActivityFooter}
              ItemSeparatorComponent={ActivitySeparator}
              onEndReached={handleActivityLoadMore}
              onEndReachedThreshold={0.5}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={[
                styles.feedContent,
                { paddingBottom: listBottomPadding },
              ]}
              drawDistance={1200}
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
            onNotificationPress={handleNotificationPress}
            unreadCount={unreadCount}
            titleOpacity={titleOpacity}
            avatarOpacity={avatarOpacity}
          />
        </View>

        {showLoadLatest && (
          <View style={styles.loadLatestContainer} pointerEvents="box-none">
            <ScalePressable
              onPress={handleLoadLatest}
              style={styles.loadLatestButton}
              accessibilityRole="button"
              accessibilityLabel="Load latest activity"
            >
              <Ionicons
                name="arrow-up"
                size={16}
                style={styles.loadLatestIcon}
              />
              <Text type="subheadline" style={styles.loadLatestText}>
                Latest
              </Text>
            </ScalePressable>
          </View>
        )}
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
          contentContainerStyle={[
            styles.searchResultsContent,
            { paddingBottom: listBottomPadding },
          ]}
        />
      </Animated.View>

      {/* Floating Search Bar (appears during transition and in search mode) */}
      {showFloatingSearch && (
        <>
          <Animated.View style={backButtonAnimatedStyle}>
            <ScalePressable
              onPress={handleExitSearch}
              style={styles.backButton}
              accessibilityRole="button"
              accessibilityLabel="Exit search"
            >
              <Ionicons name="arrow-back" size={24} style={styles.backIcon} />
            </ScalePressable>
          </Animated.View>

          <Animated.View
            style={[styles.floatingSearchClip, floatingSearchClipStyle]}
            pointerEvents={isSearchActive ? "auto" : "none"}
          >
            <Animated.View style={floatingSearchInnerStyle}>
              <SearchBar
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus={isSearchActive}
                placeholder="Search users..."
              />
            </Animated.View>
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
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  notificationButton: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: theme.colors.inputBackground,
    borderRadius: 22,
  },
  notificationIcon: {
    color: theme.colors.text,
  },
  searchContainer: {
    paddingHorizontal: 20,
  },
  searchBarHidden: {
    opacity: 0,
  },
  floatingSearchClip: {
    position: "absolute",
    left: HORIZONTAL_PADDING,
    zIndex: 100,
    borderRadius: SEARCH_BAR_HEIGHT / 2,
    overflow: "hidden",
  },
  searchModeHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: theme.colors.inputBackground,
    borderRadius: 22,
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
  loadLatestContainer: {
    position: "absolute",
    top: rt.insets.top,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  loadLatestButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.primary,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 4,
  },
  loadLatestIcon: {
    color: theme.colors.buttonText,
  },
  loadLatestText: {
    color: theme.colors.buttonText,
    fontWeight: "600",
  },
}));
