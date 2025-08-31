import { View, TouchableOpacity } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Image } from 'expo-image';

import { Text } from './Text';
import { VSpace } from './Space';

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
  coverImage?: string | null;
}

interface Props {
  recipe: Recipe;
  onPress?: () => void;
}

export const RecipeCard = ({ recipe, onPress }: Props) => {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      {recipe.coverImage && <Image source={{ uri: recipe.coverImage }} style={styles.coverImage} />}
      <View style={styles.content}>
        <Text type="heading" numberOfLines={2}>
          {recipe.name}
        </Text>
        {recipe.description && (
          <>
            <VSpace size={4} />
            <Text type="bodyFaded" numberOfLines={recipe.coverImage ? 2 : 3}>
              {recipe.description}
            </Text>
          </>
        )}
        <VSpace size={8} />
        <View style={styles.metadata}>
          {recipe.totalTime && (
            <Text type="bodyFaded" style={styles.metadataText}>
              {recipe.totalTime}
            </Text>
          )}
          {recipe.servings && (
            <Text type="bodyFaded" style={styles.metadataText}>
              {recipe.servings} servings
            </Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create((theme) => ({
  card: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.medium,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginVertical: 6,
    marginHorizontal: 20,
    overflow: 'hidden',
  },
  coverImage: {
    width: '100%',
    height: 160,
    backgroundColor: theme.colors.border,
  },
  content: {
    padding: 16,
  },
  metadata: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metadataText: {
    fontSize: 14,
  },
}));
