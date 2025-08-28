import { useState } from 'react';
import { View, FlatList, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';
import { useNavigation } from '@react-navigation/native';

import { Text } from '@/components/Text';
import { Input } from '@/components/Input';
import { VSpace } from '@/components/Space';
import { PopularRecipeCard } from '@/components/PopularRecipeCard';
import { usePopularRecipes } from '@/api/recipe';
import { useUser } from '@/api/user';
import { Image } from 'expo-image';

interface PopularRecipe {
  id: number;
  name: string;
  description?: string | null;
  totalTime?: string | null;
  servings?: number | null;
  category?: string | null;
  saveCount: number;
}

export const DiscoverScreen = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const { data: popularRecipes, isLoading: isLoadingPopular } = usePopularRecipes();
  const { data: userProfile } = useUser();

  const navigation = useNavigation();

  const handleAvatarPress = () => {
    if (userProfile?.user?.id) {
      navigation.navigate('UserProfile', { userId: userProfile.user.id });
    }
  };

  const renderAvatar = () => {
    if (!userProfile) return null;
    return (
      <TouchableOpacity style={styles.avatar} onPress={handleAvatarPress} activeOpacity={0.7}>
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

  const renderPopularRecipe = ({ item }: { item: PopularRecipe }) => (
    <PopularRecipeCard
      recipe={item}
      onPress={() => navigation.navigate('RecipeDetail', { recipeId: item.id })}
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
            <View style={styles.headerRow}>
              <Text type="title2">Discover</Text>
              {renderAvatar()}
            </View>
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
