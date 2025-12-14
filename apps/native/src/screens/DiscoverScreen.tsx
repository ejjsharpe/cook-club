import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useState, useCallback, useMemo } from 'react';
import {
  View,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';

import { useGetUserCollections, useToggleRecipeInCollection } from '@/api/collection';
import { useSearchAllRecipes, useLikeRecipe, useAllTags } from '@/api/recipe';
import { CollectionSheetManager } from '@/components/CollectionSelectorSheet';
import { SheetManager } from '@/components/FilterBottomSheet';
import { FullWidthRecipeCard } from '@/components/FullWidthRecipeCard';
import { SearchBar } from '@/components/SearchBar';
import { VSpace } from '@/components/Space';
import { Text } from '@/components/Text';
import { useDebounce } from '@/hooks/useDebounce';

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

interface HeaderProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedTagIds: number[];
  maxTotalTime: string | undefined;
  onFilterPress: () => void;
  onTagPress: (tagId: number) => void;
}

const Header = ({
  searchQuery,
  setSearchQuery,
  selectedTagIds,
  maxTotalTime,
  onFilterPress,
}: HeaderProps) => {
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
              placeholder="Search all recipes..."
            />
          </View>
          <TouchableOpacity style={styles.filterButton} onPress={onFilterPress} activeOpacity={0.7}>
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
        </View>
      </View>
      <VSpace size={16} />
    </>
  );
};

export const DiscoverScreen = () => {
  const navigation = useNavigation();

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [maxTotalTime, setMaxTotalTime] = useState<string | undefined>();
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Debounce search query
  const debouncedSearch = useDebounce(searchQuery, 300);

  // API hooks
  const { data: allTags = [] } = useAllTags();
  const { data: userCollections = [] } = useGetUserCollections();
  const likeRecipeMutation = useLikeRecipe();
  const toggleMutation = useToggleRecipeInCollection();

  // Determine if we should fetch recipes
  const shouldFetchRecipes =
    debouncedSearch.trim() !== '' || selectedTagIds.length > 0 || maxTotalTime !== undefined;

  const { data, isPending, isFetchingNextPage, hasNextPage, fetchNextPage, refetch, isFetching } =
    useSearchAllRecipes({
      search: debouncedSearch,
      tagIds: selectedTagIds.length > 0 ? selectedTagIds : undefined,
      maxTotalTime,
    });

  // Flatten paginated data
  const recipes: RecommendedRecipe[] = useMemo(() => {
    if (!shouldFetchRecipes) return [];
    return data?.pages.flatMap((page: any) => page?.items ?? []) ?? [];
  }, [data, shouldFetchRecipes]);

  // Handlers
  const handleRecipePress = (recipeId: number) => {
    navigation.navigate('RecipeDetail', { recipeId });
  };

  const handleLikePress = (recipeId: number) => {
    likeRecipeMutation.mutate({ recipeId });
  };

  const handleSavePress = (recipeId: number) => {
    // Check if user has multiple collections
    const hasMultipleCollections = (userCollections?.length ?? 0) > 1;

    if (hasMultipleCollections) {
      // User has multiple collections - show selector to choose
      CollectionSheetManager.show('collection-selector-sheet', {
        payload: { recipeId },
      });
    } else {
      // Single collection (or no collections) - quick save/unsave to default
      // When collectionId is undefined, backend will use default collection
      toggleMutation.mutate({ recipeId, collectionId: undefined });
    }
  };

  const handleUserPress = (userId: string) => {
    navigation.navigate('UserProfile', { userId });
  };

  const handleLoadMore = useCallback(() => {
    if (shouldFetchRecipes && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [shouldFetchRecipes, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const handleRefresh = useCallback(async () => {
    if (!shouldFetchRecipes) return;
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  }, [shouldFetchRecipes, refetch]);

  const handleFilterPress = () => {
    SheetManager.show('filter-sheet', {
      payload: {
        selectedTagIds,
        onTagsChange: setSelectedTagIds,
        maxTotalTime,
        onTimeChange: setMaxTotalTime,
        allTags,
      },
    });
  };

  const handleTagPress = (tagId: number) => {
    setSelectedTagIds((prev) => {
      if (prev.includes(tagId)) {
        // Remove tag if already selected
        return prev.filter((id) => id !== tagId);
      } else {
        // Add tag to selection
        return [...prev, tagId];
      }
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

  const renderEmpty = () => {
    // Show loading state
    if (isPending || isFetching) {
      return (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" />
          <VSpace size={16} />
          <Text type="bodyFaded">Searching recipes...</Text>
          <VSpace size={80} />
        </View>
      );
    }

    // Show prompt to search when no filters/search applied
    if (!shouldFetchRecipes) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="search-outline" size={64} style={styles.emptyIcon} />
          <VSpace size={16} />
          <Text type="heading">Start searching</Text>
          <VSpace size={8} />
          <Text type="bodyFaded" style={styles.emptyText}>
            Enter a search term or select a cuisine/category to discover recipes
          </Text>
          <VSpace size={80} />
        </View>
      );
    }

    // Show no results found
    return (
      <View style={styles.emptyState}>
        <Ionicons name="restaurant-outline" size={64} style={styles.emptyIcon} />
        <VSpace size={16} />
        <Text type="heading">No recipes found</Text>
        <VSpace size={8} />
        <Text type="bodyFaded" style={styles.emptyText}>
          Try adjusting your filters or search query
        </Text>
        <VSpace size={80} />
      </View>
    );
  };

  const renderFooter = () => {
    if (!isFetchingNextPage) return null;

    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="large" />
        <VSpace size={20} />
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top']}>
        <FlatList
          data={recipes}
          renderItem={renderRecipe}
          keyExtractor={(item) => item.id.toString()}
          ListHeaderComponent={
            <Header
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              selectedTagIds={selectedTagIds}
              maxTotalTime={maxTotalTime}
              onFilterPress={handleFilterPress}
              onTagPress={handleTagPress}
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
              enabled={shouldFetchRecipes}
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
    flexDirection: 'row',
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
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  filterIcon: {
    color: theme.colors.text,
  },
  filterIconActive: {
    color: theme.colors.primary,
  },
  shortcutTitle: {
    fontSize: 16,
  },
  shortcutList: {
    gap: 8,
    paddingRight: 20,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  emptyIcon: {
    color: theme.colors.border,
  },
  emptyText: {
    textAlign: 'center',
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
}));
