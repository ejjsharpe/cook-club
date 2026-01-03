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
import { useSharedValue } from "react-native-reanimated";
import { StyleSheet, UnistylesRuntime } from "react-native-unistyles";

import { useGetUserCollectionsWithMetadata } from "@/api/collection";
import { useGetUserRecipes, useAllTags } from "@/api/recipe";
import { useAddRecipeToShoppingList } from "@/api/shopping";
import { CollectionCard } from "@/components/CollectionCard";
import { SheetManager } from "@/components/FilterBottomSheet";
import { RecipeCard } from "@/components/RecipeCard";
import { SafeAreaView } from "@/components/SafeAreaView";
import { SearchBar } from "@/components/SearchBar";
import { VSpace } from "@/components/Space";
import { SwipeableTabView } from "@/components/SwipeableTabView";
import { Text } from "@/components/Text";
import { UnderlineTabBar, type TabOption } from "@/components/UnderlineTabBar";
import { BackButton } from "@/components/buttons/BackButton";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

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
  const insets = UnistylesRuntime.insets;

  const [activeTab, setActiveTab] = useState<TabType>("recipes");
  const [searchQuery, setSearchQuery] = useState("");
  const scrollProgress = useSharedValue(0);

  // Filter state
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [maxTotalTime, setMaxTotalTime] = useState<string | undefined>();
  const { data: allTags } = useAllTags();

  const addToShoppingListMutation = useAddRecipeToShoppingList();

  const activeTabIndex = activeTab === "recipes" ? 0 : 1;

  const handleTabChange = useCallback((tab: TabType) => {
    setActiveTab(tab);
  }, []);

  const handleSwipeTabChange = useCallback((index: number) => {
    const tab = index === 0 ? "recipes" : "collections";
    setActiveTab(tab);
  }, []);

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

  const handleRecipeSelect = (recipe: Recipe) => {
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
  };

  const handleCollectionPress = (collectionId: number) => {
    navigation.navigate("CollectionDetail", { collectionId });
  };

  const renderRecipe = ({ item }: { item: Recipe }) => (
    <RecipeCard recipe={item} onPress={() => handleRecipeSelect(item)} />
  );

  const RecipeSeparator = () => (
    <View style={styles.separatorContainer}>
      <View style={styles.separator} />
    </View>
  );

  const renderCollection = ({ item }: { item: CollectionWithMetadata }) => (
    <CollectionCard
      collection={item}
      onPress={() => handleCollectionPress(item.id)}
    />
  );

  const renderRecipesEmpty = () => {
    if (isLoadingRecipes) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator size="large" />
        </View>
      );
    }

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
    if (isLoadingCollections) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator size="large" />
        </View>
      );
    }

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

  return (
    <SafeAreaView edges={["top"]} style={styles.container}>
      <VSpace size={8} />
      <View style={styles.header}>
        <BackButton />
        <Text type="title2" style={styles.headerTitle}>
          Add to Groceries
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <VSpace size={20} />

      <View style={styles.searchSection}>
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
          {activeTab === "recipes" && (
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
          )}
        </View>
        <VSpace size={16} />
        <UnderlineTabBar
          options={tabOptions}
          value={activeTab}
          onValueChange={handleTabChange}
          scrollProgress={scrollProgress}
        />
      </View>

      <VSpace size={16} />

      <SwipeableTabView
        activeIndex={activeTabIndex}
        onIndexChange={handleSwipeTabChange}
        containerWidth={SCREEN_WIDTH}
        scrollProgress={scrollProgress}
      >
        <LegendList
          data={recipes}
          renderItem={renderRecipe}
          keyExtractor={(item) => item.id.toString()}
          onEndReached={handleLoadMoreRecipes}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderRecipesFooter}
          ListEmptyComponent={renderRecipesEmpty}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 20 },
          ]}
          ItemSeparatorComponent={RecipeSeparator}
        />
        <LegendList
          data={collections}
          renderItem={renderCollection}
          keyExtractor={(item) => item.id.toString()}
          ListEmptyComponent={renderCollectionsEmpty}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 20 },
          ]}
          ItemSeparatorComponent={() => <VSpace size={12} />}
        />
      </SwipeableTabView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
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
  searchSection: {
    paddingHorizontal: 20,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  searchBarWrapper: {
    flex: 1,
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
  separatorContainer: {
    paddingVertical: 8,
    paddingHorizontal: 20,
  },
  separator: {
    height: 1,
    backgroundColor: theme.colors.border,
  },
}));
