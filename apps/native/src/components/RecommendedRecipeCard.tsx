import { View, TouchableOpacity, ScrollView } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { formatDistanceToNow } from 'date-fns';

import { Text } from './Text';
import { TagChip } from './TagChip';

interface Tag {
  id: number;
  name: string;
  type: string;
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

interface Props {
  recipe: RecommendedRecipe;
  onPress?: () => void;
  onLikePress?: () => void;
  onSavePress?: () => void;
  onUserPress?: () => void;
}

const getInitials = (name: string): string => {
  const words = name
    .trim()
    .split(' ')
    .filter((w) => w.length > 0);
  if (words.length >= 2) {
    const firstWord = words[0];
    const lastWord = words[words.length - 1];
    if (firstWord && lastWord && firstWord[0] && lastWord[0]) {
      return (firstWord[0] + lastWord[0]).toUpperCase();
    }
  }
  return name.substring(0, 2).toUpperCase();
};

export const RecommendedRecipeCard = ({
  recipe,
  onPress,
  onLikePress,
  onSavePress,
  onUserPress,
}: Props) => {
  const timeAgo = formatDistanceToNow(new Date(recipe.createdAt), { addSuffix: true });

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.9}>
      {/* User Header */}
      <TouchableOpacity style={styles.userHeader} onPress={onUserPress} activeOpacity={0.7}>
        <View style={styles.avatar}>
          {recipe.uploadedBy.image ? (
            <Image source={{ uri: recipe.uploadedBy.image }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarInitials}>{getInitials(recipe.uploadedBy.name)}</Text>
            </View>
          )}
        </View>
        <View style={styles.userInfo}>
          <Text type="body" style={styles.userName}>
            {recipe.uploadedBy.name}
          </Text>
          <Text type="bodyFaded" style={styles.uploadTime}>
            {timeAgo}
          </Text>
        </View>
      </TouchableOpacity>

      {/* Recipe Image with Gradient Overlay */}
      <View style={styles.imageContainer}>
        {recipe.coverImage ? (
          <Image source={{ uri: recipe.coverImage }} style={styles.coverImage} />
        ) : (
          <View style={[styles.coverImage, styles.placeholderImage]}>
            <Ionicons name="restaurant" size={64} style={styles.placeholderIcon} />
          </View>
        )}
        <LinearGradient colors={['transparent', 'rgba(0,0,0,0.7)']} style={styles.gradient} />
        <View style={styles.overlay}>
          <Text type="title2" style={styles.recipeName} numberOfLines={2}>
            {recipe.name}
          </Text>
          {(recipe.totalTime || recipe.servings) && (
            <View style={styles.overlayMetadata}>
              {recipe.totalTime && (
                <View style={styles.overlayMetadataItem}>
                  <Ionicons name="time-outline" size={14} style={styles.overlayMetadataIcon} />
                  <Text style={styles.overlayMetadataText}>{recipe.totalTime}</Text>
                </View>
              )}
              {recipe.servings && (
                <View style={styles.overlayMetadataItem}>
                  <Ionicons name="people-outline" size={14} style={styles.overlayMetadataIcon} />
                  <Text style={styles.overlayMetadataText}>{recipe.servings}</Text>
                </View>
              )}
            </View>
          )}
        </View>
      </View>

      {/* Interaction Buttons */}
      <View style={styles.interactionButtons}>
        <TouchableOpacity
          style={styles.interactionButton}
          onPress={onLikePress}
          activeOpacity={0.7}>
          <Ionicons
            name={recipe.isLiked ? 'heart' : 'heart-outline'}
            size={24}
            style={recipe.isLiked ? styles.iconLiked : styles.iconDefault}
          />
          {recipe.likeCount > 0 && (
            <Text style={styles.interactionButtonText}>{recipe.likeCount}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.interactionButton}
          onPress={onSavePress}
          activeOpacity={0.7}>
          <Ionicons
            name={recipe.isSaved ? 'bookmark' : 'bookmark-outline'}
            size={24}
            style={recipe.isSaved ? styles.iconSaved : styles.iconDefault}
          />
        </TouchableOpacity>
      </View>

      {/* Recipe Details */}
      <View style={styles.content}>
        {/* Description */}
        {recipe.description && (
          <Text type="bodyFaded" numberOfLines={2} style={styles.description}>
            {recipe.description}
          </Text>
        )}

        {/* Tags */}
        {recipe.tags.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.tagsContainer}
            contentContainerStyle={styles.tagsContent}>
            {recipe.tags.map((tag) => (
              <View key={tag.id} style={styles.tagWrapper}>
                <TagChip label={tag.name} selected={false} onPress={() => {}} />
              </View>
            ))}
          </ScrollView>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create((theme) => ({
  card: {
    backgroundColor: theme.colors.background,
    borderRadius: 0,
    marginVertical: 8,
    overflow: 'hidden',
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    paddingHorizontal: 16,
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: {
    color: theme.colors.buttonText,
    fontSize: 16,
    fontWeight: '600',
  },
  userInfo: {
    flex: 1,
    gap: 2,
  },
  userName: {
    fontSize: 14,
    fontWeight: '600',
  },
  uploadTime: {
    fontSize: 12,
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
    aspectRatio: 3 / 2,
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  placeholderImage: {
    backgroundColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '60%',
  },
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
  },
  recipeName: {
    color: theme.colors.buttonText,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  overlayMetadata: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  overlayMetadataItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  overlayMetadataIcon: {
    color: theme.colors.buttonText,
  },
  overlayMetadataText: {
    color: theme.colors.buttonText,
    fontSize: 13,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  placeholderIcon: {
    color: theme.colors.border,
  },
  interactionButtons: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  interactionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  interactionButtonText: {
    fontSize: 14,
    color: theme.colors.text,
  },
  iconDefault: {
    color: theme.colors.text,
  },
  iconLiked: {
    color: theme.colors.primary,
  },
  iconSaved: {
    color: theme.colors.primary,
  },
  content: {
    padding: 16,
  },
  description: {
    marginBottom: 12,
  },
  metadata: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 12,
  },
  metadataItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metadataIcon: {
    color: theme.colors.text,
  },
  flameIcon: {
    color: theme.colors.primary,
  },
  metadataText: {
    fontSize: 14,
  },
  saveCountText: {
    fontSize: 14,
  },
  tagsContainer: {
    marginTop: 4,
  },
  tagsContent: {
    gap: 8,
  },
  tagWrapper: {
    // Wrapper to apply gap between chips
  },
}));
