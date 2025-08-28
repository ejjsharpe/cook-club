import { useState, useMemo } from 'react';
import { View, FlatList, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';
import { useNavigation } from '@react-navigation/native';

import { Text } from '@/components/Text';
import { Input } from '@/components/Input';
import { VSpace } from '@/components/Space';
import { RecipeCard } from '@/components/RecipeCard';
import { useGetUserRecipes } from '@/api/recipe';

interface Recipe {
  id: number;
  name: string;
  description?: string | null;
  prepTime?: string | null;
  cookTime?: string | null;
  totalTime?: string | null;
  servings?: number | null;
  category?: string | null;
  cuisine?: string | null;
  addedAt: string;
}

export const MyRecipesScreen = () => {
  const navigation = useNavigation();
  const [searchQuery, setSearchQuery] = useState('');

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, error } =
    useGetUserRecipes({
      search: searchQuery,
    });

  const recipes = useMemo(() => {
    return data?.pages.flatMap((page) => page?.items ?? []) ?? [];
  }, [data]);

  const renderRecipe = ({ item }: { item: Recipe }) => (
    <RecipeCard
      recipe={item}
      onPress={() => navigation.navigate('RecipeDetail', { recipeId: item.id })}
    />
  );

  const renderFooter = () => {
    if (!isFetchingNextPage) return null;
    return (
      <View style={styles.footer}>
        <ActivityIndicator />
      </View>
    );
  };

  const renderEmpty = () => {
    if (isLoading) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator size="large" />
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.centered}>
          <Text type="bodyFaded">Failed to load recipes</Text>
        </View>
      );
    }

    return (
      <View style={styles.centered}>
        <Text type="bodyFaded">
          {searchQuery ? 'No recipes found for your search' : 'No recipes yet'}
        </Text>
      </View>
    );
  };

  const handleLoadMore = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.container}>
        <VSpace size={28} />
        <View style={styles.header}>
          <Text type="title2">My Recipes</Text>
          <VSpace size={20} />
          <Input
            placeholder="Search recipes..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
        <VSpace size={16} />
        <FlatList
          data={recipes}
          renderItem={renderRecipe}
          keyExtractor={(item) => item.id.toString()}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={renderEmpty}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.listContent,
            recipes.length === 0 && styles.emptyListContent,
          ]}
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
  header: {
    paddingHorizontal: 20,
  },
  listContent: {
    paddingBottom: 20,
  },
  emptyListContent: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  footer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
}));
