import { Ionicons } from "@expo/vector-icons";
import { LegendList } from "@legendapp/list";
import { useNavigation } from "@react-navigation/native";
import { useState, useMemo, useCallback } from "react";
import {
  View,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import { SheetManager } from "react-native-actions-sheet";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  FadeIn as ReanimatedFadeIn,
  useAnimatedScrollHandler,
  runOnJS,
} from "react-native-reanimated";
import { StyleSheet, UnistylesRuntime } from "react-native-unistyles";

import { useGetUserCollectionsWithMetadata } from "@/api/collection";
import { useGetUserRecipes, useAllTags } from "@/api/recipe";
import { useAddRecipeToShoppingList } from "@/api/shopping";
import { CollectionGridCard, GRID_GAP } from "@/components/CollectionGridCard";
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
import { BackButton } from "@/components/buttons/BackButton";
import { useAnimatedHeaderScroll } from "@/hooks/useAnimatedHeaderScroll";

const AnimatedLegendList = Animated.createAnimatedComponent(LegendList) as <T>(
  props: React.ComponentProps<typeof LegendList<T>> & { entering?: any },
) => React.ReactElement;

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Header height constants
const TITLE_SECTION_HEIGHT = 44 + 16; // Back button row + VSpace
const SEARCH_ROW_HEIGHT = 50;
const TABS_HEIGHT = 16 + 50 + 16;
const HEADER_HEIGHT = TITLE_SECTION_HEIGHT + SEARCH_ROW_HEIGHT + TABS_HEIGHT;

const animationConfig = {
  duration: 250,
  easing: Easing.bezier(0.4, 0, 0.2, 1),
};

type Recipe = NonNullable<
  ReturnType<typeof useGetUserRecipes>["data"]
>["pages"][number]["items"][number];

type CollectionWithMetadata = NonNullable<
  ReturnType<typeof useGetUserCollectionsWithMetadata>["data"]
>[number];

type TabType = "recipes" | "collections";

const tabOptions: TabOption<TabType>[] = [
  { value: "recipes", label: "Recipes" },
  { value: "collections", label: "Collections" },
];

export const AddRecipeToShoppingListScreen = () => {
  const navigation = useNavigation();
  const theme = UnistylesRuntime.getTheme();

  const [activeTab, setActiveTab] = useState<TabType>("recipes");
  const [searchQuery, setSearchQuery] = useState("");
  const scrollProgress = useSharedValue(0);

  const activeTabIndex = activeTab === "recipes" ? 0 : 1;

  const {
    headerAnimatedStyle,
    titleAnimatedStyle,
    createScrollCallback,
    handleTabSwitch,
  } = useAnimatedHeaderScroll({
    titleSectionHeight: TITLE_SECTION_HEIGHT,
    headerHeight: HEADER_HEIGHT,
    tabCount: 2,
    activeTabIndex,
  });

  // Create scroll callbacks for each tab
  const handleRecipesScrollCallback = createScrollCallback(0);
  const handleCollectionsScrollCallback = createScrollCallback(1);

  const recipesScrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      runOnJS(handleRecipesScrollCallback)(
        event.contentOffset.y,
        event.contentSize.height,
        event.layoutMeasurement.height,
      );
    },
  });

  const collectionsScrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      runOnJS(handleCollectionsScrollCallback)(
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
  const filterButtonProgress = useSharedValue(1);

  const filterButtonStyle = useAnimatedStyle(() => ({
    opacity: filterButtonProgress.value,
    transform: [{ scale: 0.8 + 0.2 * filterButtonProgress.value }],
    width: 50 * filterButtonProgress.value,
    marginLeft: 12 * filterButtonProgress.value,
  }));

  const addToShoppingListMutation = useAddRecipeToShoppingList();

  const switchTab = useCallback(
    (tab: TabType) => {
      const newTabIndex = tab === "recipes" ? 0 : 1;
      setActiveTab(tab);
      handleTabSwitch(newTabIndex);

      // Animate filter button visibility
      filterButtonProgress.value = withTiming(
        tab === "recipes" ? 1 : 0,
        animationConfig,
      );
    },
    [handleTabSwitch, filterButtonProgress],
  );

  const handleSwipeTabChange = useCallback(
    (index: number) => {
      switchTab(index === 0 ? "recipes" : "collections");
    },
    [switchTab],
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

  const recipes = useMemo(() => {
    return recipesData?.pages.flatMap((page) => page?.items ?? []) ?? [];
  }, [recipesData]);

  const collections = useMemo(() => {
    return collectionsData ?? [];
  }, [collectionsData]);

  const handleRecipeSelect = useCallback(
    (recipe: Recipe) => {
      Alert.alert(
        "Add to Shopping List",
        `Add ingredients from "${recipe.name}" to your shopping list?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Add",
            onPress: () => {
              addToShoppingListMutation.mutate(
                { recipeId: recipe.id },
                {
                  onSuccess: () => {
                    navigation.goBack();
                  },
                },
              );
            },
          },
        ],
      );
    },
    [addToShoppingListMutation, navigation],
  );

  const handleCollectionPress = useCallback(
    (collectionId: number) => {
      navigation.navigate("CollectionDetail", { collectionId });
    },
    [navigation],
  );

  const renderRecipe = ({ item }: { item: Recipe }) => (
    <RecipeCard recipe={item} onPress={() => handleRecipeSelect(item)} />
  );

  const RecipeSeparator = () => (
    <View style={styles.separatorContainer}>
      <View style={styles.separator} />
    </View>
  );

  const renderCollection = ({ item }: { item: CollectionWithMetadata }) => (
    <CollectionGridCard
      collection={item}
      onPress={() => handleCollectionPress(item.id)}
    />
  );

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
            : "No recipes in your library yet"}
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
      <Animated.View style={[styles.headerContainer, headerAnimatedStyle]}>
        <View style={styles.header}>
          <Animated.View style={titleAnimatedStyle}>
            <View style={styles.titleRow}>
              <BackButton />
              <Text type="title2" style={styles.headerTitle}>
                Add to Groceries
              </Text>
              <View style={styles.headerSpacer} />
            </View>
            <VSpace size={16} />
          </Animated.View>
          <View style={[styles.searchRow, styles.headerPadded]}>
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
          <View style={styles.headerPadded}>
            <UnderlineTabBar
              options={tabOptions}
              value={activeTab}
              onValueChange={(tab) => switchTab(tab)}
              scrollProgress={scrollProgress}
              fullWidth
            />
          </View>
          <VSpace size={16} />
        </View>
      </Animated.View>
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
            onScroll={recipesScrollHandler}
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
            onScroll={collectionsScrollHandler}
            scrollEventThrottle={16}
          />
        )}
      </SwipeableTabView>
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
  header: {},
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
  },
  headerSpacer: {
    width: 44,
  },
  headerPadded: {
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
    paddingBottom: rt.insets.bottom + 20,
    flexGrow: 1,
  },
  collectionsGridContent: {
    paddingHorizontal: 20,
    paddingBottom: rt.insets.bottom + 20,
  },
  collectionsRow: {
    gap: GRID_GAP,
    marginBottom: GRID_GAP,
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
  separatorContainer: {
    paddingVertical: 8,
    paddingHorizontal: 20,
  },
  separator: {
    height: 1,
    backgroundColor: theme.colors.border,
  },
}));
