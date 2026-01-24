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
  useDerivedValue,
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
import { CollectionGridCard, ImageGrid } from "@/components/CollectionGridCard";
import { CreateCollectionCard } from "@/components/CreateCollectionCard";
import { RecipeCard } from "@/components/RecipeCard";
import { RecipeCollectionBrowser } from "@/components/RecipeCollectionBrowser";
import { SearchBar, SEARCH_BAR_HEIGHT } from "@/components/SearchBar";
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

// Collection grid layout constants
const COLLECTION_GRID_PADDING = 30;
const COLLECTION_GRID_GAP = 20; // GRID_GAP from CollectionGridCard
const COLLECTION_ROW_GAP = 20;
const COLLECTION_SEPARATOR_WIDTH = 12; // From CollectionSeparator

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);
const AnimatedFlatList = Animated.createAnimatedComponent(
  FlatList<CollectionWithMetadata | { id: "create"; type: "create" }>,
);

// Static separator component - defined outside to avoid recreation
const CollectionSeparator = () => <View style={styles.collectionSeparator} />;

// Animation config - static, moved to module scope to avoid hook overhead
const ANIMATION_CONFIG = {
  duration: 300,
  easing: Easing.bezier(0.4, 0, 0.2, 1),
};

// ─── Animated Recipe Overlay ─────────────────────────────────────────────────
interface AnimatedRecipeOverlayProps {
  recipe: RecipeListItem;
  browseY: number;
  searchY: number;
  searchProgress: SharedValue<number>;
  animatingTab: SharedValue<TabType>;
  isAnimating: Readonly<SharedValue<boolean>>;
}

const AnimatedRecipeOverlay = memo(function AnimatedRecipeOverlay({
  recipe,
  browseY,
  searchY,
  searchProgress,
  animatingTab,
  isAnimating,
}: AnimatedRecipeOverlayProps) {
  // Use transform instead of top for GPU-accelerated animation
  const deltaY = searchY - browseY;

  // Memoize static top position style to avoid recreation on each render
  const topStyle = useMemo(() => ({ top: browseY }), [browseY]);

  const animatedStyle = useAnimatedStyle(() => {
    "worklet";
    return {
      transform: [{ translateY: searchProgress.value * deltaY }],
      opacity: animatingTab.value === "recipes" && isAnimating.value ? 1 : 0,
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

// ─── Animated Collection Overlay ──────────────────────────────────────────────
interface AnimatedCollectionOverlayProps {
  collection: CollectionWithMetadata;
  browseX: number;
  browseY: number;
  searchX: number;
  searchY: number;
  browseWidth: number;
  searchWidth: number;
  searchProgress: SharedValue<number>;
  animatingTab: SharedValue<TabType>;
  isAnimating: Readonly<SharedValue<boolean>>;
}

const AnimatedCollectionOverlay = memo(function AnimatedCollectionOverlay({
  collection,
  browseX,
  browseY,
  searchX,
  searchY,
  browseWidth,
  searchWidth,
  searchProgress,
  animatingTab,
  isAnimating,
}: AnimatedCollectionOverlayProps) {
  // Calculate deltas for transform
  const deltaX = searchX - browseX;
  const deltaY = searchY - browseY;
  const imageScale = searchWidth / browseWidth;

  // The image is square (aspectRatio 1), so height equals width
  const browseImageHeight = browseWidth;
  const searchImageHeight = searchWidth;
  // Extra height added by scaling the image
  const imageHeightDelta = searchImageHeight - browseImageHeight;

  // Shared translateX - computed once per frame, used by both imageStyle and textStyle
  const animatedTranslateX = useDerivedValue(() => {
    "worklet";
    return searchProgress.value * deltaX;
  });

  // Memoize static position style to avoid recreation on each render
  const positionStyle = useMemo(
    () => ({
      top: browseY,
      left: browseX,
      width: browseWidth,
    }),
    [browseY, browseX, browseWidth],
  );

  // Combined image style - handles visibility, position, and scale in one animated style
  const imageStyle = useAnimatedStyle(() => {
    "worklet";
    const translateY = searchProgress.value * deltaY;
    // Scale interpolates from 1 to imageScale: 1 + progress * (imageScale - 1)
    const scale = 1 + searchProgress.value * (imageScale - 1);

    return {
      opacity: animatingTab.value === "collections" && isAnimating.value ? 1 : 0,
      transform: [
        { translateX: animatedTranslateX.value },
        { translateY },
        { scale },
      ],
      transformOrigin: "top left",
    };
  });

  // Text only translates (no scale), accounts for image height change
  const textStyle = useAnimatedStyle(() => {
    "worklet";
    // Text needs to move down by deltaY plus the extra image height from scaling
    const translateY = searchProgress.value * (deltaY + imageHeightDelta);

    return {
      opacity: animatingTab.value === "collections" && isAnimating.value ? 1 : 0,
      transform: [{ translateX: animatedTranslateX.value }, { translateY }],
    };
  });

  const previewImages =
    "previewImages" in collection ? collection.previewImages : [];
  const recipeCount = "recipeCount" in collection ? collection.recipeCount : 0;

  return (
    <View
      style={[styles.collectionOverlay, positionStyle]}
      pointerEvents="none"
    >
      {/* Image with scale transform */}
      <Animated.View style={[{ width: browseWidth }, imageStyle]}>
        <ImageGrid images={previewImages} width={browseWidth} />
      </Animated.View>
      {/* Text with translate only (no scale) */}
      <Animated.View style={[styles.collectionOverlayText, textStyle]}>
        <Text type="headline" numberOfLines={1}>
          {collection.name}
        </Text>
        <Text type="caption" style={styles.collectionOverlayCaption}>
          {recipeCount} {recipeCount === 1 ? "recipe" : "recipes"}
        </Text>
      </Animated.View>
    </View>
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

  // Collection card position tracking for shared element transition
  const firstBrowseCollectionRef = useAnimatedRef<Animated.View>();
  const firstSearchCollectionRef = useAnimatedRef<Animated.View>();
  const browseCollectionPositions = useRef<
    { id: number; x: number; y: number; width: number }[]
  >([]);
  const searchCollectionTarget = useRef<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const collectionScrollX = useSharedValue(0);

  // Animation progress (0 = browse, 1 = search)
  const searchProgress = useSharedValue(0);
  // Derived value for animation boundary check - computed once per frame
  const isAnimating = useDerivedValue(() => {
    return searchProgress.value > 0 && searchProgress.value < 1;
  });
  // Tracks which tab's overlays should be visible during animation ("recipes" or "collections")
  const animatingTab = useSharedValue<TabType>("recipes");

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

  // Calculate search mode target position for a collection at given index
  const getCollectionSearchTarget = useCallback(
    (
      index: number,
      firstCardMeasurement: {
        x: number;
        y: number;
        width: number;
        height: number;
      },
    ) => {
      const row = Math.floor(index / 2);
      const col = index % 2;
      const { x, y, width, height } = firstCardMeasurement;

      return {
        x: x + col * (width + COLLECTION_GRID_GAP),
        y: y + row * (height + COLLECTION_ROW_GAP),
        width,
      };
    },
    [],
  );

  useEffect(() => {
    if (isSearchActive) {
      searchProgress.value = withTiming(1, ANIMATION_CONFIG);
      searchInputRef.current?.focus();
    } else {
      searchInputRef.current?.blur();
      searchProgress.value = withTiming(0, ANIMATION_CONFIG);
    }
  }, [isSearchActive, searchProgress]);

  // Animate filter button visibility based on active tab
  useEffect(() => {
    if (filterState) {
      filterButtonProgress.value = withTiming(
        filterState.activeTab === "recipes" ? 1 : 0,
        ANIMATION_CONFIG,
      );
    }
  }, [filterState]);

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
    return recentRecipesData?.pages[0]?.items ?? [];
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
    // Determine which tab to animate based on last active tab
    const tabToAnimate = filterState?.activeTab ?? "recipes";

    // Capture current data for position calculations (avoid closures in worklet)
    const recipeCount = recentRecipes.length;
    const collectionCount = collections.length;
    const recipeIds = recentRecipes.map((r) => r.id);
    const collectionIds = collections.map((c) => c.id);

    // Helper to process measurements and start animation (called from RN thread)
    const processMeasurements = (measurements: {
      searchBarY: number | undefined;
      recipeY: number | undefined;
      collectionX: number | undefined;
      collectionY: number | undefined;
      scrollOffset: number;
      searchCollectionX: number | undefined;
      searchCollectionY: number | undefined;
      searchCollectionWidth: number | undefined;
      searchCollectionHeight: number | undefined;
    }) => {
      // Update search bar position
      if (measurements.searchBarY && measurements.searchBarY > 0) {
        searchBarY.value = measurements.searchBarY;
      }

      // Calculate recipe positions on JS thread
      const recipePositions: { id: number; y: number }[] = [];
      if (measurements.recipeY && measurements.recipeY > 0) {
        for (let i = 0; i < recipeCount; i++) {
          const recipeId = recipeIds[i];
          if (recipeId !== undefined) {
            recipePositions.push({
              id: recipeId,
              y: measurements.recipeY + i * (RECIPE_CARD_HEIGHT + 12),
            });
          }
        }
      }

      // Calculate collection positions on JS thread
      const collectionPositions: {
        id: number;
        x: number;
        y: number;
        width: number;
      }[] = [];
      if (measurements.collectionX && measurements.collectionX > 0) {
        for (let i = 0; i < collectionCount; i++) {
          const collectionId = collectionIds[i];
          if (collectionId !== undefined) {
            collectionPositions.push({
              id: collectionId,
              x:
                measurements.collectionX +
                i * (COLLECTION_CARD_WIDTH + COLLECTION_SEPARATOR_WIDTH) -
                measurements.scrollOffset,
              y: measurements.collectionY ?? 0,
              width: COLLECTION_CARD_WIDTH,
            });
          }
        }
      }

      // Build search collection target
      let searchCollectionMeasurement: {
        x: number;
        y: number;
        width: number;
        height: number;
      } | null = null;
      if (
        measurements.searchCollectionX &&
        measurements.searchCollectionX > 0 &&
        measurements.searchCollectionX < SCREEN_WIDTH
      ) {
        searchCollectionMeasurement = {
          x: measurements.searchCollectionX,
          y: measurements.searchCollectionY ?? 0,
          width: measurements.searchCollectionWidth ?? 0,
          height: measurements.searchCollectionHeight ?? 0,
        };
      }

      // Store positions and start animation
      browsePositions.current = recipePositions;
      browseCollectionPositions.current = collectionPositions;
      searchCollectionTarget.current = searchCollectionMeasurement;
      animatingTab.value = tabToAnimate;
      setIsSearchActive(true);
    };

    // Measure elements on UI thread - keep worklet lightweight
    scheduleOnUI(() => {
      "worklet";
      const searchBarMeasurement = measure(searchBarRef);
      const recipeMeasurement = measure(firstRecipeRef);
      const browseCollectionMeasurement = measure(firstBrowseCollectionRef);
      const scrollOffset = collectionScrollX.value;

      // Only measure search collection if entering on collections tab
      let searchCollectionMeasured = null;
      if (tabToAnimate === "collections") {
        searchCollectionMeasured = measure(firstSearchCollectionRef);
      }

      // Pass raw measurements back to JS thread for position calculations
      scheduleOnRN(processMeasurements, {
        searchBarY: searchBarMeasurement?.pageY,
        recipeY: recipeMeasurement?.pageY,
        collectionX: browseCollectionMeasurement?.pageX,
        collectionY: browseCollectionMeasurement?.pageY,
        scrollOffset,
        searchCollectionX: searchCollectionMeasured?.pageX,
        searchCollectionY: searchCollectionMeasured?.pageY,
        searchCollectionWidth: searchCollectionMeasured?.width,
        searchCollectionHeight: searchCollectionMeasured?.height,
      });
    });
  }, [
    searchBarRef,
    searchBarY,
    recentRecipes,
    firstRecipeRef,
    collections,
    firstBrowseCollectionRef,
    firstSearchCollectionRef,
    collectionScrollX,
    filterState,
    animatingTab,
  ]);

  const handleExitSearch = useCallback(() => {
    const currentTab = filterState?.activeTab ?? "recipes";

    // Capture current data for position calculations (avoid closures in worklet)
    const recipeCount = recentRecipes.length;
    const collectionCount = collections.length;
    const recipeIds = recentRecipes.map((r) => r.id);
    const collectionIds = collections.map((c) => c.id);

    // Helper to process measurements and start exit animation (called from RN thread)
    const processMeasurements = (measurements: {
      recipeY: number | undefined;
      collectionX: number | undefined;
      collectionY: number | undefined;
      scrollOffset: number;
      searchCollectionX: number | undefined;
      searchCollectionY: number | undefined;
      searchCollectionWidth: number | undefined;
      searchCollectionHeight: number | undefined;
    }) => {
      // Calculate recipe positions on JS thread
      const recipePositions: { id: number; y: number }[] = [];
      if (measurements.recipeY && measurements.recipeY > 0) {
        for (let i = 0; i < recipeCount; i++) {
          const recipeId = recipeIds[i];
          if (recipeId !== undefined) {
            recipePositions.push({
              id: recipeId,
              y: measurements.recipeY + i * (RECIPE_CARD_HEIGHT + 12),
            });
          }
        }
      }

      // Calculate collection positions on JS thread
      const collectionPositions: {
        id: number;
        x: number;
        y: number;
        width: number;
      }[] = [];
      if (measurements.collectionX && measurements.collectionX > 0) {
        for (let i = 0; i < collectionCount; i++) {
          const collectionId = collectionIds[i];
          if (collectionId !== undefined) {
            collectionPositions.push({
              id: collectionId,
              x:
                measurements.collectionX +
                i * (COLLECTION_CARD_WIDTH + COLLECTION_SEPARATOR_WIDTH) -
                measurements.scrollOffset,
              y: measurements.collectionY ?? 0,
              width: COLLECTION_CARD_WIDTH,
            });
          }
        }
      }

      // Build search collection target if valid
      let searchCollectionMeasurement: {
        x: number;
        y: number;
        width: number;
        height: number;
      } | null = null;
      if (
        measurements.searchCollectionX &&
        measurements.searchCollectionX > 0 &&
        measurements.searchCollectionX < SCREEN_WIDTH
      ) {
        searchCollectionMeasurement = {
          x: measurements.searchCollectionX,
          y: measurements.searchCollectionY ?? 0,
          width: measurements.searchCollectionWidth ?? 0,
          height: measurements.searchCollectionHeight ?? 0,
        };
      }

      // Update positions BEFORE setting visibility
      browsePositions.current = recipePositions;
      browseCollectionPositions.current = collectionPositions;

      // Update search collection target if we have a valid measurement
      if (searchCollectionMeasurement) {
        searchCollectionTarget.current = searchCollectionMeasurement;
      }

      // Set animation tab and visibility based on current tab
      animatingTab.value = currentTab;

      // Trigger exit animation
      setIsSearchActive(false);
      setSearchQuery("");
    };

    // Measure elements on UI thread - keep worklet lightweight
    scheduleOnUI(() => {
      "worklet";
      const recipeMeasurement = measure(firstRecipeRef);
      const browseCollectionMeasurement = measure(firstBrowseCollectionRef);
      const scrollOffset = collectionScrollX.value;

      // Only measure search collection if on collections tab
      let searchCollectionMeasured = null;
      if (currentTab === "collections") {
        searchCollectionMeasured = measure(firstSearchCollectionRef);
      }

      // Pass raw measurements back to JS thread for position calculations
      scheduleOnRN(processMeasurements, {
        recipeY: recipeMeasurement?.pageY,
        collectionX: browseCollectionMeasurement?.pageX,
        collectionY: browseCollectionMeasurement?.pageY,
        scrollOffset,
        searchCollectionX: searchCollectionMeasured?.pageX,
        searchCollectionY: searchCollectionMeasured?.pageY,
        searchCollectionWidth: searchCollectionMeasured?.width,
        searchCollectionHeight: searchCollectionMeasured?.height,
      });
    });
  }, [
    filterState,
    animatingTab,
    firstRecipeRef,
    firstBrowseCollectionRef,
    firstSearchCollectionRef,
    collectionScrollX,
    recentRecipes,
    collections,
  ]);

  // Collection cards in browse mode stay hidden only when overlay is actually visible
  const collectionCardsStyle = useAnimatedStyle(() => {
    "worklet";
    const overlayVisible = animatingTab.value === "collections" && isAnimating.value;
    return {
      opacity: overlayVisible ? 0 : 1,
    };
  });

  // Memoized renderItem for collections FlatList
  const renderCollectionItem = useCallback(
    ({
      item,
      index,
    }: {
      item: CollectionWithMetadata | { id: "create"; type: "create" };
      index: number;
    }) => {
      if ("type" in item && item.type === "create") {
        // Create card stays visible - fades with browse view naturally
        return (
          <CreateCollectionCard
            variant="grid"
            onPress={handleCreateCollection}
            disabled={createCollectionMutation.isPending}
            width={COLLECTION_CARD_WIDTH}
          />
        );
      }

      // Actual collection cards get hidden during animation (overlays cover them)
      const collection = item as CollectionWithMetadata;
      const card = (
        <CollectionGridCard
          collection={collection}
          onPress={() => handleCollectionPress(collection.id)}
          width={COLLECTION_CARD_WIDTH}
        />
      );

      // Wrap first real collection (index 1 after create card) with ref for measurement
      if (index === 1) {
        return (
          <Animated.View ref={firstBrowseCollectionRef} style={collectionCardsStyle}>
            {card}
          </Animated.View>
        );
      }

      return (
        <Animated.View style={collectionCardsStyle}>
          {card}
        </Animated.View>
      );
    },
    [
      handleCreateCollection,
      createCollectionMutation.isPending,
      handleCollectionPress,
      firstBrowseCollectionRef,
      collectionCardsStyle,
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

  // ─── Collections Horizontal Scroll Handler ──────────────────────────────────────
  const collectionsHorizontalScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      "worklet";
      collectionScrollX.value = event.contentOffset.x;
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

  // Recipe cards stay hidden only when overlay is actually visible (synced with overlay)
  const recipeCardsStyle = useAnimatedStyle(() => {
    "worklet";
    const overlayVisible = animatingTab.value === "recipes" && isAnimating.value;
    return {
      opacity: overlayVisible ? 0 : 1,
    };
  });

  const titleAnimatedStyle = useAnimatedStyle(() => {
    "worklet";
    return {
      opacity: titleOpacity.value,
    };
  });

  // Floating search bar animates from browse position to search mode position
  // Using a two-layer clip technique for GPU-accelerated animation:
  // 1. Outer clip wrapper with overflow:hidden animates position (translateX, translateY)
  // 2. Inner search bar is full width but gets clipped by the wrapper
  // This avoids animating width (layout property) while keeping text crisp

  // Calculate static widths (only filterButtonProgress changes these, not searchProgress)
  const startWidth = SCREEN_WIDTH - HORIZONTAL_PADDING * 2;

  // Pre-computed constant for back button offset
  const BACK_BUTTON_OFFSET = BACK_BUTTON_WIDTH + BACK_BUTTON_GAP;

  // Outer clip wrapper - animates position only, clips content to end width
  const floatingSearchClipStyle = useAnimatedStyle(() => {
    "worklet";
    const baseY = searchBarY.value || searchModeY;
    const deltaY = searchModeY - baseY;
    // Filter button space - this only changes on tab switch, not during enter/exit
    const filterSpace =
      (FILTER_BUTTON_SIZE + FILTER_BUTTON_GAP) * filterButtonProgress.value;
    const endWidth =
      SCREEN_WIDTH -
      HORIZONTAL_PADDING * 2 -
      BACK_BUTTON_WIDTH -
      BACK_BUTTON_GAP -
      filterSpace;

    // Linear interpolation: startWidth + progress * (endWidth - startWidth)
    const clipWidth =
      startWidth + searchProgress.value * (endWidth - startWidth);

    return {
      top: baseY,
      width: clipWidth,
      overflow: "hidden" as const,
      opacity: searchProgress.value > 0 ? 1 : 0,
      // GPU-accelerated position animation (simple multiplication replaces interpolate)
      transform: [
        { translateX: searchProgress.value * BACK_BUTTON_OFFSET },
        { translateY: searchProgress.value * deltaY },
      ],
    };
  });

  // Inner search bar - full width, gets clipped by wrapper
  const floatingSearchInnerStyle = useAnimatedStyle(() => {
    "worklet";
    return {
      width: startWidth,
    };
  });

  // Inline search bar hides when floating one is visible
  const inlineSearchBarStyle = useAnimatedStyle(() => {
    "worklet";
    return {
      opacity: searchProgress.value > 0 ? 0 : 1,
    };
  });

  // Filter button animates based on active tab (visible on recipes, hidden on collections)
  // Filter button uses scale transform for GPU-accelerated show/hide
  const filterButtonAnimatedStyle = useAnimatedStyle(() => {
    "worklet";
    const combined = filterButtonProgress.value * searchProgress.value;
    return {
      opacity: combined,
      transform: [{ scale: combined }],
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
          <Text type="title3" style={styles.sectionTitle}>
            Collections
          </Text>
          <AnimatedFlatList
            horizontal
            data={collectionsWithCreate}
            renderItem={renderCollectionItem}
            keyExtractor={(item) => item.id.toString()}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalList}
            ItemSeparatorComponent={CollectionSeparator}
            onScroll={collectionsHorizontalScroll}
            scrollEventThrottle={16}
          />

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
            initialTab={filterState?.activeTab ?? "recipes"}
            firstCollectionRef={firstSearchCollectionRef}
          />
        </View>
      </Animated.View>

      {/* Floating Search Bar - always mounted for worklet pre-warming */}
      {/* Two-layer clip technique: outer clips, inner has full width */}
      <Animated.View
        style={[styles.floatingSearchClip, floatingSearchClipStyle]}
        pointerEvents={isSearchActive ? "auto" : "none"}
      >
        <Animated.View style={floatingSearchInnerStyle}>
          <SearchBar
            ref={searchInputRef}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search recipes, collections..."
          />
        </Animated.View>
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
            animatingTab={animatingTab}
            isAnimating={isAnimating}
          />
        );
      })}

      {/* Collection Transition Overlay (animating collection cards) - always mounted */}
      {collections.map((collection, index) => {
        const browsePos = browseCollectionPositions.current[index];
        // Skip collections that are outside the viewport or don't have positions
        if (
          !browsePos ||
          browsePos.x < -COLLECTION_CARD_WIDTH ||
          browsePos.x > SCREEN_WIDTH
        ) {
          return null;
        }
        const searchTarget = searchCollectionTarget.current
          ? getCollectionSearchTarget(index, searchCollectionTarget.current)
          : { x: COLLECTION_GRID_PADDING, y: 0, width: browsePos.width };
        return (
          <AnimatedCollectionOverlay
            key={`collection-overlay-${collection.id}`}
            collection={collection}
            browseX={browsePos.x}
            browseY={browsePos.y}
            searchX={searchTarget.x}
            searchY={searchTarget.y}
            browseWidth={browsePos.width}
            searchWidth={searchTarget.width}
            searchProgress={searchProgress}
            animatingTab={animatingTab}
            isAnimating={isAnimating}
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
  floatingSearchClip: {
    position: "absolute",
    top: rt.insets.top,
    left: HORIZONTAL_PADDING,
    zIndex: 100,
    borderRadius: SEARCH_BAR_HEIGHT / 2,
    overflow: "hidden",
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
  collectionOverlay: {
    position: "absolute",
    zIndex: 50,
  },
  collectionOverlayText: {
    paddingTop: 8,
    gap: 2,
  },
  collectionOverlayCaption: {
    color: theme.colors.textSecondary,
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
