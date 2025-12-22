import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useState, useCallback, useMemo } from "react";
import {
  View,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet } from "react-native-unistyles";

import { useSearchPublicCollections } from "@/api/collection";
import { useSearchUsers } from "@/api/follows";
import { useSearchAllRecipes, useLikeRecipe, useAllTags } from "@/api/recipe";
import { CollectionCard } from "@/components/CollectionCard";
import { CollectionSheetManager } from "@/components/CollectionSelectorSheet";
import { SheetManager } from "@/components/FilterBottomSheet";
import { FullWidthRecipeCard } from "@/components/FullWidthRecipeCard";
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

interface HeaderProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  activeTab: SearchType;
  onTabChange: (tab: SearchType) => void;
  selectedTagIds: number[];
  maxTotalTime: string | undefined;
  onFilterPress: () => void;
}

const getSearchPlaceholder = (tab: SearchType): string => {
  switch (tab) {
    case "recipes":
      return "Search all recipes...";
    case "collections":
      return "Search collections...";
    case "users":
      return "Search users...";
  }
};

const Header = ({
  searchQuery,
  setSearchQuery,
  activeTab,
  onTabChange,
  selectedTagIds,
  maxTotalTime,
  onFilterPress,
}: HeaderProps) => {
  const showFilterButton = activeTab === "recipes";

  return (
    <>
      <VSpace size={20} />
      <View style={styles.searchContainer}>
        <Text type="title2">Discover</Text>
        <VSpace size={16} />
        <View style={styles.searchRow}>
          <View style={styles.searchBarWrapper}>
            <SearchBar
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={getSearchPlaceholder(activeTab)}
            />
          </View>
          {showFilterButton && (
            <TouchableOpacity
              style={styles.filterButton}
              onPress={onFilterPress}
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
          )}
        </View>
        <VSpace size={12} />
        <SearchTypeToggle value={activeTab} onValueChange={onTabChange} />
      </View>
      <VSpace size={16} />
    </>
  );
};

export const DiscoverScreen = () => {
  const navigation = useNavigation();

  // State
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<SearchType>("recipes");
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [maxTotalTime, setMaxTotalTime] = useState<string | undefined>();
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Debounce search query
  const debouncedSearch = useDebounce(searchQuery, 300);

  // API hooks
  const { data: allTags = [] } = useAllTags();
  const likeRecipeMutation = useLikeRecipe();

  // Determine if we should fetch for each tab
  const shouldFetchRecipes =
    activeTab === "recipes" &&
    (debouncedSearch.trim() !== "" ||
      selectedTagIds.length > 0 ||
      maxTotalTime !== undefined);

  const shouldFetchCollections =
    activeTab === "collections" && debouncedSearch.length >= 2;

  const shouldFetchUsers = activeTab === "users" && debouncedSearch.length >= 2;

  // Recipe search
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

  // Collection search
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

  // User search
  const {
    data: usersData,
    isPending: usersPending,
    refetch: usersRefetch,
    isFetching: usersFetching,
  } = useSearchUsers({
    query: debouncedSearch,
  });

  // Flatten paginated data
  const recipes: RecommendedRecipe[] = useMemo(() => {
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

  // Handlers
  const handleRecipePress = (recipeId: number) => {
    navigation.navigate("RecipeDetail", { recipeId });
  };

  const handleLikePress = (recipeId: number) => {
    likeRecipeMutation.mutate({ recipeId });
  };

  const handleSavePress = (recipeId: number) => {
    CollectionSheetManager.show("collection-selector-sheet", {
      payload: { recipeId },
    });
  };

  const handleUserPress = (userId: string) => {
    navigation.navigate("UserProfile", { userId });
  };

  const handleTabChange = (tab: SearchType) => {
    setActiveTab(tab);
    // Clear recipe-specific filters when switching away from recipes
    if (tab !== "recipes") {
      setSelectedTagIds([]);
      setMaxTotalTime(undefined);
    }
  };

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
    // Users don't have pagination in the current API
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
    if (activeTab === "recipes" && shouldFetchRecipes) {
      await recipesRefetch();
    } else if (activeTab === "collections" && shouldFetchCollections) {
      await collectionsRefetch();
    } else if (activeTab === "users" && shouldFetchUsers) {
      await usersRefetch();
    }
    setIsRefreshing(false);
  }, [
    activeTab,
    shouldFetchRecipes,
    recipesRefetch,
    shouldFetchCollections,
    collectionsRefetch,
    shouldFetchUsers,
    usersRefetch,
  ]);

  const handleFilterPress = () => {
    SheetManager.show("filter-sheet", {
      payload: {
        selectedTagIds,
        onTagsChange: setSelectedTagIds,
        maxTotalTime,
        onTimeChange: setMaxTotalTime,
        allTags,
      },
    });
  };

  // Render functions
  const renderRecipe = ({ item }: { item: RecommendedRecipe }) => (
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

  const renderEmpty = () => {
    const isFetching =
      (activeTab === "recipes" && (recipesPending || recipesFetching)) ||
      (activeTab === "collections" &&
        (collectionsPending || collectionsFetching)) ||
      (activeTab === "users" && (usersPending || usersFetching));

    const shouldFetch =
      (activeTab === "recipes" && shouldFetchRecipes) ||
      (activeTab === "collections" && shouldFetchCollections) ||
      (activeTab === "users" && shouldFetchUsers);

    // Show loading state
    if (isFetching && shouldFetch) {
      const loadingText =
        activeTab === "recipes"
          ? "Searching recipes..."
          : activeTab === "collections"
            ? "Searching collections..."
            : "Searching users...";

      return (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" />
          <VSpace size={16} />
          <Text type="bodyFaded">{loadingText}</Text>
          <VSpace size={80} />
        </View>
      );
    }

    // Show prompt to search when no query
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
        <View style={styles.emptyState}>
          <Ionicons name={icon} size={64} style={styles.emptyIcon} />
          <VSpace size={16} />
          <Text type="heading">{title}</Text>
          <VSpace size={8} />
          <Text type="bodyFaded" style={styles.emptyText}>
            {subtitle}
          </Text>
          <VSpace size={80} />
        </View>
      );
    }

    // Show no results found
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
      <View style={styles.emptyState}>
        <Ionicons name={icon} size={64} style={styles.emptyIcon} />
        <VSpace size={16} />
        <Text type="heading">{title}</Text>
        <VSpace size={8} />
        <Text type="bodyFaded" style={styles.emptyText}>
          {subtitle}
        </Text>
        <VSpace size={80} />
      </View>
    );
  };

  const renderFooter = () => {
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

  // Determine data and render function based on active tab
  const listData =
    activeTab === "recipes"
      ? recipes
      : activeTab === "collections"
        ? collections
        : users;

  const renderItem =
    activeTab === "recipes"
      ? renderRecipe
      : activeTab === "collections"
        ? renderCollection
        : renderUser;

  const keyExtractor = (item: any) =>
    activeTab === "recipes"
      ? item.id.toString()
      : activeTab === "collections"
        ? `collection-${item.id}`
        : item.id;

  const canRefresh =
    (activeTab === "recipes" && shouldFetchRecipes) ||
    (activeTab === "collections" && shouldFetchCollections) ||
    (activeTab === "users" && shouldFetchUsers);

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={["top"]}>
        <FlatList
          data={listData}
          renderItem={renderItem as any}
          keyExtractor={keyExtractor}
          ListHeaderComponent={
            <Header
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              activeTab={activeTab}
              onTabChange={handleTabChange}
              selectedTagIds={selectedTagIds}
              maxTotalTime={maxTotalTime}
              onFilterPress={handleFilterPress}
            />
          }
          ListEmptyComponent={renderEmpty}
          ListFooterComponent={renderFooter}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              enabled={canRefresh}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create((theme) => ({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },

  searchContainer: {
    paddingHorizontal: 20,
  },
  searchRow: {
    flexDirection: "row",
    gap: 12,
  },
  searchBarWrapper: {
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
