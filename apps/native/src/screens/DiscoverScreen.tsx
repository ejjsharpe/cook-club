import { useState, useCallback, useMemo } from 'react';
import { View, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';

import { Text } from '@/components/Text';
import { VSpace } from '@/components/Space';
import { SearchBar } from '@/components/SearchBar';
import { RecommendedRecipeCard } from '@/components/RecommendedRecipeCard';
import { SheetManager } from '@/components/FilterBottomSheet';
import {
  useRecommendedRecipes,
  useUserPreferences,
  useSaveRecipe,
  useLikeRecipe,
} from '@/api/recipe';
import { useUser } from '@/api/user';
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
  isSaved: boolean;
  isLiked: boolean;
  coverImage?: string | null;
  tags: Tag[];
  uploadedBy: User;
  createdAt: string;
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

interface HeaderProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  userProfile: UserProfile | undefined;
  onAvatarPress: () => void;
  selectedTagIds: number[];
  maxTotalTime: string | undefined;
  onFilterPress: () => void;
}

const Header = ({
  searchQuery,
  setSearchQuery,
  userProfile,
  onAvatarPress,
  selectedTagIds,
  maxTotalTime,
  onFilterPress,
}: HeaderProps) => {
  const renderAvatar = () => {
    if (!userProfile) return null;
    return (
      <TouchableOpacity style={styles.avatar} onPress={onAvatarPress} activeOpacity={0.7}>
        {userProfile.user.image ? (
          <Image source={{ uri: userProfile.user.image }} style={styles.avatarImage} />
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
    <>
      <VSpace size={20} />
      <View style={styles.searchContainer}>
        <View style={styles.headerRow}>
          <Text type="title2">Discover</Text>
          {renderAvatar()}
        </View>
        <VSpace size={16} />
        <View style={styles.searchRow}>
          <View style={styles.searchBarWrapper}>
            <SearchBar
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search recipes..."
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

  // Debounce search query
  const debouncedSearch = useDebounce(searchQuery, 300);

  // API hooks
  const { data: userProfile } = useUser();
  const { data: userPreferences = [] } = useUserPreferences();
  const saveRecipeMutation = useSaveRecipe();
  const likeRecipeMutation = useLikeRecipe();

  const {
    data,
    isPending,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
    isRefetching,
    isError,
  } = useRecommendedRecipes({
    search: debouncedSearch,
    tagIds: selectedTagIds.length > 0 ? selectedTagIds : undefined,
    maxTotalTime,
  });

  console.log({ isError });

  // Flatten paginated data
  const recipes = useMemo(() => data?.pages.flatMap((page) => page.items) ?? [], [data]);

  // Handlers
  const handleAvatarPress = () => {
    if (userProfile?.user?.id) {
      navigation.navigate('UserProfile', { userId: userProfile.user.id });
    }
  };

  const handleRecipePress = (recipeId: number) => {
    navigation.navigate('RecipeDetail', { recipeId });
  };

  const handleLikePress = (recipeId: number) => {
    likeRecipeMutation.mutate({ recipeId });
  };

  const handleSavePress = (recipeId: number) => {
    saveRecipeMutation.mutate({ recipeId });
  };

  const handleSharePress = (recipeId: number) => {
    // TODO: Implement share functionality
    console.log('Share recipe:', recipeId);
  };

  const handleUserPress = (userId: string) => {
    navigation.navigate('UserProfile', { userId });
  };

  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const handleFilterPress = () => {
    SheetManager.show('filter-sheet', {
      payload: {
        selectedTagIds,
        onTagsChange: setSelectedTagIds,
        maxTotalTime,
        onTimeChange: setMaxTotalTime,
        userPreferences,
      },
    });
  };

  // Render functions
  const renderRecipe = ({ item }: { item: RecommendedRecipe }) => (
    <RecommendedRecipeCard
      recipe={item}
      onPress={() => handleRecipePress(item.id)}
      onLikePress={() => handleLikePress(item.id)}
      onSavePress={() => handleSavePress(item.id)}
      onUserPress={() => handleUserPress(item.uploadedBy.id)}
    />
  );

  const renderEmpty = () => {
    if (isPending) return null;

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
      <SafeAreaView style={styles.container} edges={['top']}>
        <FlatList
          data={recipes}
          renderItem={renderRecipe}
          keyExtractor={(item) => item.id.toString()}
          ListHeaderComponent={
            <Header
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              userProfile={userProfile}
              onAvatarPress={handleAvatarPress}
              selectedTagIds={selectedTagIds}
              maxTotalTime={maxTotalTime}
              onFilterPress={handleFilterPress}
            />
          }
          ListEmptyComponent={renderEmpty}
          ListFooterComponent={renderFooter}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={handleRefresh} />}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.container}
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
  container: {
    flex: 1,
  },
  searchContainer: {
    paddingHorizontal: 20,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    backgroundColor: theme.colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 16,
    color: theme.colors.primary,
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
