import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { View, TouchableOpacity } from "react-native";
import { StyleSheet } from "react-native-unistyles";

import { VSpace } from "./Space";
import { TagChip } from "./TagChip";
import { Text } from "./Text";

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
          <Image
            source={{ uri: recipe.coverImage }}
            style={styles.thumbnailImage}
            contentFit="cover"
          />
        ) : (
          <View style={styles.thumbnailPlaceholder} />
        )}
      </View>

      {/* Content on the right */}
      <View style={styles.content}>
        {/* Recipe title */}
        <Text type="heading" numberOfLines={1} style={styles.title}>
          {recipe.name}
        </Text>
        {/* Cook time */}
        {recipe.totalTime && (
          <View style={styles.cookTimeContainer}>
            <Ionicons
              name="time-outline"
              size={13}
              style={styles.cookTimeIcon}
            />
            <Text type="bodyFaded" style={styles.cookTime}>
              {recipe.totalTime}
            </Text>
          </View>
        )}

        {/* Tags */}
        {visibleTags.length > 0 && (
          <View style={styles.tagsContainer}>
            {visibleTags.map((tag) => (
              <TagChip key={tag.id} label={tag.name} size="small" />
            ))}
            {remainingTagsCount > 0 && (
              <TagChip label={`+${remainingTagsCount}`} size="small" />
            )}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create((theme) => ({
  card: {
    flexDirection: "row",
    borderRadius: theme.borderRadius.medium,
    marginHorizontal: 20,
    alignItems: "center",
  },
  thumbnail: {
    width: 100,
    height: 100,
    borderRadius: theme.borderRadius.medium,
    overflow: "hidden",
  },
  thumbnailImage: {
    width: "100%",
    height: "100%",
  },
  thumbnailPlaceholder: {
    width: "100%",
    height: "100%",
    backgroundColor: theme.colors.border,
  },
  content: {
    flex: 1,
    height: "100%",
    justifyContent: "center",
    padding: 8,
    gap: 8,
    paddingHorizontal: 12,
  },
  title: {
    fontSize: 17,
  },
  tagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  cookTimeContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  cookTimeIcon: {
    color: theme.colors.primary,
  },
  cookTime: {
    fontSize: 13,
  },
}));
