import { Ionicons } from '@expo/vector-icons';
import { LegendList } from '@legendapp/list';
import { useNavigation, useScrollToTop } from '@react-navigation/native';
import { Image } from 'expo-image';
import { useState, useCallback, useMemo, useRef, memo } from 'react';
import { View, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';

import { useGetUserCollections, useToggleRecipeInCollection } from '@/api/collection';
import { useRecommendedRecipes, useLikeRecipe } from '@/api/recipe';
import { useUser } from '@/api/user';
import { CollectionSheetManager } from '@/components/CollectionSelectorSheet';
import { FullWidthRecipeCard } from '@/components/FullWidthRecipeCard';
import { VSpace } from '@/components/Space';
import { Text } from '@/components/Text';

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
  userProfile: UserProfile | undefined;
  onAvatarPress: () => void;
}

const Header = memo(({ userProfile, onAvatarPress }: HeaderProps) => {
  const renderAvatar = () => {
    if (!userProfile) return null;
    return (
      <TouchableOpacity style={styles.avatar} onPress={onAvatarPress} activeOpacity={0.7}>
        {userProfile.user.image ? (
          <Image
            source={{ uri: userProfile.user.image }}
            style={styles.avatarImage}
            cachePolicy="memory-disk"
            transition={100}
          />
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
      <View style={styles.headerContainer}>
        <View style={styles.headerRow}>
          <Text type="title2">
            cook
            <Text type="title2" style={styles.clubText}>
              club
            </Text>
          </Text>
          {renderAvatar()}
        </View>
      </View>
      <VSpace size={16} />
    </>
  );
});

const Footer = ({ isFetchingNextPage }: { isFetchingNextPage: boolean }) => {
  if (!isFetchingNextPage) return null;

  return (
    <View style={styles.footerLoader}>
      <ActivityIndicator size="large" />
      <VSpace size={20} />
    </View>
  );
};

const Empty = ({ isPending }: { isPending: boolean }) => {
  if (isPending) return null;

  return (
    <View style={styles.emptyState}>
      <Ionicons name="restaurant-outline" size={64} style={styles.emptyIcon} />
      <VSpace size={16} />
      <Text type="heading">No recipes found</Text>
      <VSpace size={8} />
      <Text type="bodyFaded" style={styles.emptyText}>
        Check back soon for new recommended recipes
      </Text>
      <VSpace size={80} />
    </View>
  );
};

export const HomeScreen = () => {
  const listRef = useRef(null);
  useScrollToTop(listRef);
  const navigation = useNavigation();

  // State
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // API hooks
  const { data: userProfile } = useUser();
  const { data: userCollections = [] } = useGetUserCollections();
  const likeRecipeMutation = useLikeRecipe();
  const toggleMutation = useToggleRecipeInCollection();

  const { data, isPending, isFetchingNextPage, hasNextPage, fetchNextPage, refetch } =
    useRecommendedRecipes();

  // Flatten paginated data
  const recipes: RecommendedRecipe[] = useMemo(
    () => data?.pages.flatMap((page: any) => page?.items ?? []) ?? [],
    [data]
  );

  // Handlers
  const handleAvatarPress = useCallback(() => {
    if (userProfile?.user?.id) {
      navigation.navigate('UserProfile', { userId: userProfile.user.id });
    }
  }, [userProfile?.user?.id, navigation]);

  const handleRecipePress = useCallback(
    (recipeId: number) => {
      navigation.navigate('RecipeDetail', { recipeId });
    },
    [navigation]
  );

  const handleLikePress = useCallback(
    (recipeId: number) => {
      likeRecipeMutation.mutate({ recipeId });
    },
    [likeRecipeMutation]
  );

  const handleSavePress = useCallback(
    (recipeId: number) => {
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
    },
    [userCollections?.length, toggleMutation]
  );

  const handleUserPress = useCallback(
    (userId: string) => {
      navigation.navigate('UserProfile', { userId });
    },
    [navigation]
  );

  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  }, [refetch]);

  const renderRecipe = useCallback(
    ({ item }: { item: RecommendedRecipe }) => (
      <FullWidthRecipeCard
        recipe={item}
        onPress={() => handleRecipePress(item.id)}
        onLikePress={() => handleLikePress(item.id)}
        onSavePress={() => handleSavePress(item.id)}
        onUserPress={() => handleUserPress(item.uploadedBy.id)}
      />
    ),
    [handleRecipePress, handleLikePress, handleSavePress, handleUserPress]
  );

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.container} edges={['top']}>
        <LegendList
          ref={listRef}
          data={recipes}
          renderItem={renderRecipe}
          keyExtractor={(item) => item.id.toString()}
          ListHeaderComponent={
            <Header userProfile={userProfile} onAvatarPress={handleAvatarPress} />
          }
          ListEmptyComponent={<Empty isPending={isPending} />}
          ListFooterComponent={<Footer isFetchingNextPage={isFetchingNextPage} />}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
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
  headerContainer: {
    paddingHorizontal: 20,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    backgroundColor: theme.colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 16,
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
