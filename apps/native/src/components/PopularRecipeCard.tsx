import { View, TouchableOpacity } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { Text } from './Text';

interface PopularRecipe {
  id: number;
  name: string;
  description?: string | null;
  totalTime?: string | null;
  servings?: number | null;
  category?: string | null;
  saveCount: number;
}

interface Props {
  recipe: PopularRecipe;
  onPress?: () => void;
}

export const PopularRecipeCard = ({ recipe, onPress }: Props) => {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.content}>
        <Text type="heading" numberOfLines={2} style={styles.title}>
          {recipe.name}
        </Text>
        
        {recipe.description && (
          <Text type="bodyFaded" numberOfLines={2} style={styles.description}>
            {recipe.description}
          </Text>
        )}
        
        <View style={styles.footer}>
          <View style={styles.metadata}>
            {recipe.totalTime && (
              <Text type="bodyFaded" style={styles.metadataText}>
                {recipe.totalTime}
              </Text>
            )}
            {recipe.category && (
              <Text type="bodyFaded" style={styles.metadataText}>
                {recipe.category}
              </Text>
            )}
          </View>
          
          <View style={styles.popularityBadge}>
            <Text type="highlight" style={styles.saveCount}>
              {recipe.saveCount} saves
            </Text>
          </View>
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
    width: 280, // Fixed width for horizontal scrolling
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3, // Android shadow
  },
  content: {
    padding: 16,
    height: 140, // Fixed height for consistent carousel appearance
  },
  title: {
    marginBottom: 6,
  },
  description: {
    marginBottom: 12,
    flex: 1, // Takes available space
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  metadata: {
    flex: 1,
  },
  metadataText: {
    fontSize: 12,
    marginBottom: 2,
  },
  popularityBadge: {
    backgroundColor: theme.colors.primary + '15', // 15% opacity
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.small,
  },
  saveCount: {
    fontSize: 12,
  },
}));