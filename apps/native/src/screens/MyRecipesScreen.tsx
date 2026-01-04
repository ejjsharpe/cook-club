import { Ionicons } from "@expo/vector-icons";
import { LegendList } from "@legendapp/list";
import { useNavigation } from "@react-navigation/native";
import { useState, useMemo, useCallback } from "react";
import {
  View,
  Alert,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import type { ViewStyle } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  FadeIn as ReanimatedFadeIn,
  useAnimatedScrollHandler,
  interpolate,
  Extrapolation,
  runOnJS,
} from "react-native-reanimated";
import { StyleSheet, UnistylesRuntime } from "react-native-unistyles";

import {
  useGetUserCollectionsWithMetadata,
  useCreateCollection,
  useDeleteCollection,
} from "@/api/collection";
import { useGetUserRecipes, useAllTags } from "@/api/recipe";
import {
  CollectionGridCard,
  GRID_GAP,
  GRID_PADDING,
} from "@/components/CollectionGridCard";
import { CreateCollectionCard } from "@/components/CreateCollectionCard";
import { SheetManager } from "@/components/FilterBottomSheet";
import { RecipeCard } from "@/components/RecipeCard";
import { SafeAreaView } from "@/components/SafeAreaView";
import { SearchBar } from "@/components/SearchBar";
import {
  MyRecipesListSkeleton,
  CollectionsListSkeleton,
} from "@/components/Skeleton";
import { VSpace } from "@/components/Space";
import { SwipeableTabView } from "@/components/SwipeableTabView";
import { Text } from "@/components/Text";
import { UnderlineTabBar, type TabOption } from "@/components/UnderlineTabBar";
import { useTabBarScroll } from "@/lib/tabBarContext";

const AnimatedLegendList = Animated.createAnimatedComponent(LegendList) as <T>(
  props: React.ComponentProps<typeof LegendList<T>> & { entering?: any },
) => React.ReactElement;

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Header height constants
const TITLE_HEIGHT = 20 + 34; // VSpace + title row (title1 font)
const SEARCH_ROW_HEIGHT = 20 + 50; // VSpace + search bar height
const TABS_HEIGHT = 16 + 50 + 16; // VSpace + tabs + VSpace
const HEADER_HEIGHT = TITLE_HEIGHT + SEARCH_ROW_HEIGHT + TABS_HEIGHT;

type Recipe = NonNullable<
  ReturnType<typeof useGetUserRecipes>["data"]
>["pages"][number]["items"][number];

// Collection type from the metadata query
type CollectionWithMetadata = NonNullable<
  ReturnType<typeof useGetUserCollectionsWithMetadata>["data"]
>[number];

type MyRecipesTab = "recipes" | "collections";

// Special item type for the create collection button
type CreateCollectionItem = { id: "create"; type: "create" };
type CollectionListItem = CollectionWithMetadata | CreateCollectionItem;

const tabOptions: TabOption<MyRecipesTab>[] = [
  { value: "recipes", label: "Recipes" },
  { value: "collections", label: "Collections" },
];

const animationConfig = {
  duration: 250,
  easing: Easing.bezier(0.4, 0, 0.2, 1),
};

export const MyRecipesScreen = () => {
  const navigation = useNavigation();
  const theme = UnistylesRuntime.getTheme();
  const { onScroll: onTabBarScroll } = useTabBarScroll();

  const [activeTab, setActiveTab] = useState<MyRecipesTab>("recipes");
  const [searchQuery, setSearchQuery] = useState("");
  const scrollProgress = useSharedValue(0);
  const scrollY = useSharedValue(0);

  // Header collapse animation - EXTEND allows overscroll bounce
  const headerAnimatedStyle = useAnimatedStyle(() => {
    const translateY = interpolate(
      scrollY.value,
      [0, HEADER_HEIGHT],
      [0, -HEADER_HEIGHT],
    );
    return {
      transform: [{ translateY }],
    };
  });

  const handleScrollEvent = useCallback(
    (offsetY: number, contentHeight: number, layoutHeight: number) => {
      onTabBarScroll({
        nativeEvent: {
          contentOffset: { y: offsetY },
          contentSize: { height: contentHeight },
          layoutMeasurement: { height: layoutHeight },
        },
      } as any);
    },
    [onTabBarScroll],
  );

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
      runOnJS(handleScrollEvent)(
        event.contentOffset.y,
        event.contentSize.height,
        event.layoutMeasurement.height,
      );
    },
  });

  // Filter state
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [maxTotalTime, setMaxTotalTime] = useState<string | undefined>();
  const { data: allTags } = useAllTags();

  // Filter button animation
  const filterButtonProgress = useSharedValue(1); // 1 = visible, 0 = hidden

  const filterButtonStyle = useAnimatedStyle(() => ({
    opacity: filterButtonProgress.value,
    transform: [{ scale: 0.8 + 0.2 * filterButtonProgress.value }],
    width: (50 + 20) * filterButtonProgress.value,
    marginLeft: 12 * filterButtonProgress.value,
    marginRight: -20 * filterButtonProgress.value,
    paddingRight: 20 * filterButtonProgress.value,
  }));

  const activeTabIndex = activeTab === "recipes" ? 0 : 1;

  const handleTabChange = useCallback(
    (tab: MyRecipesTab) => {
      setActiveTab(tab);

      // Animate filter button visibility
      filterButtonProgress.value = withTiming(
        tab === "recipes" ? 1 : 0,
        animationConfig,
      );
    },
    [filterButtonProgress],
  );

  const handleSwipeTabChange = useCallback(
    (index: number) => {
      const tab = index === 0 ? "recipes" : "collections";
      setActiveTab(tab);

      // Animate filter button visibility
      filterButtonProgress.value = withTiming(
        tab === "recipes" ? 1 : 0,
        animationConfig,
      );
    },
    [filterButtonProgress],
  );

  const handleOpenFilters = useCallback(() => {
    SheetManager.show("filter-sheet", {
      payload: {
        selectedTagIds,
        onTagsChange: setSelectedTagIds,
        maxTotalTime,
        onTimeChange: setMaxTotalTime,
        allTags: allTags ?? [],
      },
    });
  }, [selectedTagIds, maxTotalTime, allTags]);

  const hasActiveFilters =
    selectedTagIds.length > 0 || maxTotalTime !== undefined;

  // Fetch recipes
  const {
    data: recipesData,
    fetchNextPage: fetchNextRecipes,
    hasNextPage: hasMoreRecipes,
    isFetchingNextPage: isFetchingNextRecipes,
    isLoading: isLoadingRecipes,
    error: recipesError,
  } = useGetUserRecipes({
    search: searchQuery,
    tagIds: selectedTagIds.length > 0 ? selectedTagIds : undefined,
    maxTotalTime: maxTotalTime ? parseInt(maxTotalTime, 10) : undefined,
  });

  // Fetch collections
  const {
    data: collectionsData,
    isLoading: isLoadingCollections,
    error: collectionsError,
  } = useGetUserCollectionsWithMetadata({
    search: searchQuery,
  });

  // Mutations
  const createCollectionMutation = useCreateCollection();
  const deleteCollectionMutation = useDeleteCollection();

  const recipes = useMemo(() => {
    return recipesData?.pages.flatMap((page) => page?.items ?? []) ?? [];
  }, [recipesData]);

  const collections = useMemo((): CollectionListItem[] => {
    const createItem: CreateCollectionItem = { id: "create", type: "create" };
    return [createItem, ...(collectionsData ?? [])];
  }, [collectionsData]);

  const renderRecipe = ({ item }: { item: Recipe }) => (
    <RecipeCard
      recipe={item}
      onPress={() => navigation.navigate("RecipeDetail", { recipeId: item.id })}
    />
  );

  const RecipeSeparator = () => (
    <View style={styles.separatorContainer}>
      <View style={styles.separator} />
    </View>
  );

  const handleDeleteCollection = (collection: CollectionWithMetadata) => {
    if (collection.isDefault) {
      Alert.alert(
        "Cannot Delete",
        "Your default collection cannot be deleted.",
      );
      return;
    }

    Alert.alert(
      "Delete Collection",
      `Are you sure you want to delete "${collection.name}"? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            deleteCollectionMutation.mutate({ collectionId: collection.id });
          },
        },
      ],
    );
  };

  const renderCollection = ({ item }: { item: CollectionListItem }) => {
    // Handle create collection item
    if ("type" in item && item.type === "create") {
      return (
        <CreateCollectionCard
          variant="grid"
          onPress={handleCreateCollection}
          disabled={createCollectionMutation.isPending}
        />
      );
    }

    const collection = item as CollectionWithMetadata;
    return (
      <CollectionGridCard
        collection={collection}
        onPress={() =>
          navigation.navigate("CollectionDetail", {
            collectionId: collection.id,
          })
        }
      />
    );
  };

  const handleCreateCollection = () => {
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
  };

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
            : "No recipes in your library yet. Import recipes from the feed or add your own!"}
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

  const handleLoadMoreRecipes = useCallback(() => {
    if (hasMoreRecipes && !isFetchingNextRecipes) {
      fetchNextRecipes();
    }
  }, [hasMoreRecipes, isFetchingNextRecipes, fetchNextRecipes]);

  const renderRecipesFooter = () => {
    if (!isFetchingNextRecipes) return null;
    return (
      <View style={styles.footer}>
        <ActivityIndicator />
      </View>
    );
  };

  const ListSpacer = useCallback(
    () => <View style={{ height: HEADER_HEIGHT }} />,
    [],
  );

  return (
    <SafeAreaView edges={["top"]} style={styles.container}>
      <SwipeableTabView
        activeIndex={activeTabIndex}
        onIndexChange={handleSwipeTabChange}
        containerWidth={SCREEN_WIDTH}
        scrollProgress={scrollProgress}
      >
        {isLoadingRecipes ? (
          <View style={styles.skeletonContainer}>
            <View style={{ height: HEADER_HEIGHT }} />
            <MyRecipesListSkeleton />
          </View>
        ) : (
          <AnimatedLegendList
            entering={ReanimatedFadeIn.duration(200)}
            data={recipes}
            renderItem={renderRecipe}
            keyExtractor={(item) => item.id.toString()}
            onEndReached={handleLoadMoreRecipes}
            onEndReachedThreshold={0.5}
            ListHeaderComponent={ListSpacer}
            ListFooterComponent={renderRecipesFooter}
            ListEmptyComponent={renderRecipesEmpty}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            ItemSeparatorComponent={RecipeSeparator}
            onScroll={scrollHandler}
            scrollEventThrottle={16}
          />
        )}
        {isLoadingCollections ? (
          <View style={styles.skeletonContainer}>
            <View style={{ height: HEADER_HEIGHT }} />
            <CollectionsListSkeleton />
          </View>
        ) : (
          <AnimatedLegendList
            entering={ReanimatedFadeIn.duration(200)}
            data={collections}
            renderItem={renderCollection}
            keyExtractor={(item) => item.id.toString()}
            ListHeaderComponent={ListSpacer}
            ListEmptyComponent={renderCollectionsEmpty}
            showsVerticalScrollIndicator={false}
            numColumns={2}
            contentContainerStyle={styles.collectionsGridContent}
            columnWrapperStyle={styles.collectionsRow as any}
            onScroll={scrollHandler}
            scrollEventThrottle={16}
          />
        )}
      </SwipeableTabView>

      {/* Collapsing header - positioned above the lists */}
      <Animated.View style={[styles.headerContainer, headerAnimatedStyle]}>
        <View style={styles.header}>
          <VSpace size={20} />
          <Text type="title1">My Recipes</Text>
          <VSpace size={20} />
          <View style={styles.searchRow}>
            <View style={styles.searchBarWrapper}>
              <SearchBar
                placeholder={
                  activeTab === "recipes"
                    ? "Search recipes..."
                    : "Search collections..."
                }
                value={searchQuery}
                onChangeText={setSearchQuery}
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
          <VSpace size={16} />
          <UnderlineTabBar
            options={tabOptions}
            value={activeTab}
            onValueChange={handleTabChange}
            scrollProgress={scrollProgress}
            fullWidth
          />
          <VSpace size={16} />
        </View>
      </Animated.View>
    </SafeAreaView>
  );
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
    paddingTop: rt.insets.top,
    backgroundColor: theme.colors.background,
    zIndex: 10,
  },
  skeletonContainer: {
    flex: 1,
  },
  header: {
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
  deleteAction: {
    backgroundColor: theme.colors.destructive,
    justifyContent: "center",
    alignItems: "center",
    width: 80,
    height: "100%",
    marginVertical: 4,
    marginRight: 20,
    borderRadius: theme.borderRadius.medium,
  },
  separatorContainer: {
    paddingVertical: 8,
    paddingHorizontal: 20,
  },
  separator: {
    height: 1,
    backgroundColor: theme.colors.border,
  },
  collectionsGridContent: {
    paddingHorizontal: GRID_PADDING,
    paddingBottom: rt.insets.bottom + 48,
    flexGrow: 1,
  },
  collectionsRow: {
    gap: GRID_GAP,
    marginBottom: GRID_GAP,
  } satisfies ViewStyle,
}));
