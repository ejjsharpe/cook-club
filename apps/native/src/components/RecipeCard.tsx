import { View, TouchableOpacity } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Image } from 'expo-image';

import { Text } from './Text';
import { VSpace } from './Space';
import { TagChip } from './TagChip';

interface Tag {
  id: number;
  name: string;
  type: string;
}

interface User {
  id: string;
  name: string;
  image?: string | null;
}

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
  tags?: Tag[];
  uploadedBy?: User;
}

interface Props {
  recipe: Recipe;
  onPress?: () => void;
}

export const RecipeCard = ({ recipe, onPress }: Props) => {
  // Show max 3 tags
  const maxTags = 3;
  const visibleTags = recipe.tags?.slice(0, maxTags) || [];
  const remainingTagsCount = (recipe.tags?.length || 0) - maxTags;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      {/* Thumbnail on the left */}
      <View style={styles.thumbnail}>
        {recipe.coverImage ? (
          <Image source={{ uri: recipe.coverImage }} style={styles.thumbnailImage} />
        ) : (
          <View style={styles.thumbnailPlaceholder} />
        )}
      </View>

      {/* Content on the right */}
      <View style={styles.content}>
        {/* Recipe title */}
        <Text type="heading" numberOfLines={2} style={styles.title}>
          {recipe.name}
        </Text>

        <VSpace size={8} />

        {/* Tags */}
        {visibleTags.length > 0 && (
          <>
            <View style={styles.tagsContainer}>
              {visibleTags.map((tag) => (
                <TagChip key={tag.id} label={tag.name} size="small" />
              ))}
              {remainingTagsCount > 0 && <TagChip label={`+${remainingTagsCount}`} size="small" />}
            </View>
            <VSpace size={8} />
          </>
        )}

        {/* Cook time */}
        {recipe.totalTime && (
          <>
            <Text type="bodyFaded" style={styles.cookTime}>
              {recipe.totalTime}
            </Text>
            <VSpace size={12} />
          </>
        )}

        {/* Uploader info at bottom right */}
        {recipe.uploadedBy && (
          <View style={styles.uploaderContainer}>
            {recipe.uploadedBy.image ? (
              <Image source={{ uri: recipe.uploadedBy.image }} style={styles.uploaderAvatar} />
            ) : (
              <View style={styles.uploaderAvatarPlaceholder}>
                <Text style={styles.uploaderAvatarText}>
                  {recipe.uploadedBy.name?.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <Text type="bodyFaded" style={styles.uploaderName} numberOfLines={1}>
              {recipe.uploadedBy.name}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create((theme) => ({
  card: {
    flexDirection: 'row',
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.medium,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginVertical: 6,
    marginHorizontal: 20,
    overflow: 'hidden',
    minHeight: 120,
  },
  thumbnail: {
    width: 100,
    height: '100%',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
    backgroundColor: theme.colors.border,
  },
  thumbnailPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: theme.colors.border,
  },
  content: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 16,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  cookTime: {
    fontSize: 13,
  },
  uploaderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: 6,
  },
  uploaderAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  uploaderAvatarPlaceholder: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: theme.colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploaderAvatarText: {
    fontSize: 10,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  uploaderName: {
    fontSize: 12,
    maxWidth: 120,
  },
}));
