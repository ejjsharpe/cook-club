import { useState } from 'react';
import { View, FlatList, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';

import { Text } from '@/components/Text';
import { Input } from '@/components/Input';
import { VSpace } from '@/components/Space';
import { PopularRecipeCard } from '@/components/PopularRecipeCard';
import { usePopularRecipes } from '@/api/recipe';

interface PopularRecipe {
  id: number;
  name: string;
  description?: string | null;
  totalTime?: string | null;
  servings?: number | null;
  category?: string | null;
  saveCount: number;
}

export const SearchScreen = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const { data: popularRecipes, isLoading: isLoadingPopular } = usePopularRecipes();

  const renderPopularRecipe = ({ item }: { item: PopularRecipe }) => (
    <PopularRecipeCard
      recipe={item}
      onPress={() => {
        // TODO: Navigate to recipe detail screen
        console.log('Popular recipe pressed:', item.name);
      }}
    />
  );

  const renderPopularSection = () => {
    if (isLoadingPopular) {
      return (
        <View style={styles.carouselContainer}>
          <Text type="bodyFaded" style={styles.sectionTitle}>
            Loading popular recipes...
          </Text>
        </View>
      );
    }

    if (!popularRecipes || popularRecipes.length === 0) {
      return null;
    }

    return (
      <View style={styles.carouselContainer}>
        <Text type="heading" style={styles.sectionTitle}>
          Popular This Week
        </Text>
        <VSpace size={12} />
        <FlatList
          data={popularRecipes}
          renderItem={renderPopularRecipe}
          keyExtractor={(item) => item.id.toString()}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.carouselContent}
        />
      </View>
    );
  };

  const renderSearchResults = () => {
    if (!searchQuery.trim()) {
      return (
        <View style={styles.emptyState}>
          <Text type="bodyFaded">Start typing to search recipes...</Text>
        </View>
      );
    }

    // TODO: Implement actual search results
    return (
      <View style={styles.emptyState}>
        <Text type="bodyFaded">Search results for "{searchQuery}" coming soon...</Text>
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.container}>
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <VSpace size={28} />

          {/* Search Header */}
          <View style={styles.searchContainer}>
            <Text type="title2">Discover</Text>
            <VSpace size={16} />
            <Input
              placeholder="Search recipes, ingredients..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          <VSpace size={32} />
          {searchQuery ? renderSearchResults() : renderPopularSection()}
        </ScrollView>
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
  scrollView: {
    flex: 1,
  },
  searchContainer: {
    paddingHorizontal: 20,
  },
  carouselContainer: {
    marginBottom: 32,
  },
  sectionTitle: {
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  carouselContent: {
    paddingHorizontal: 20,
  },
  emptyState: {
    paddingHorizontal: 20,
    paddingVertical: 40,
    alignItems: 'center',
  },
}));
