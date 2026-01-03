import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { View, TouchableOpacity } from "react-native";
import { StyleSheet } from "react-native-unistyles";

import { Text } from "./Text";

import { getImageUrl } from "@/utils/imageUrl";
import { formatMinutes } from "@/utils/timeUtils";

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
  prepTime?: number | null;
  cookTime?: number | null;
  totalTime?: number | null;
  servings?: number | null;
  coverImage?: string | null;
  tags?: Tag[];
  owner?: User;
}

interface Props {
  recipe: Recipe;
  onPress?: () => void;
}

export const RecipeCard = ({ recipe, onPress }: Props) => {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.thumbnail}>
        {recipe.coverImage ? (
          <Image
            source={{ uri: getImageUrl(recipe.coverImage, "recipe-thumb") }}
            style={styles.thumbnailImage}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        ) : (
          <View style={styles.thumbnailPlaceholder}>
            <Ionicons
              name="image-outline"
              size={32}
              style={styles.placeholderIcon}
            />
          </View>
        )}
      </View>

      <View style={styles.content}>
        <Text type="headline" numberOfLines={2}>
          {recipe.name}
        </Text>
        <View style={styles.metaRow}>
          {recipe.totalTime && (
            <View style={styles.metaItem}>
              <Ionicons name="time-outline" size={14} style={styles.metaIcon} />
              <Text type="subheadline" style={styles.metaText}>
                {formatMinutes(recipe.totalTime)}
              </Text>
            </View>
          )}
          {recipe.servings && (
            <View style={styles.metaItem}>
              <Ionicons
                name="people-outline"
                size={14}
                style={styles.metaIcon}
              />
              <Text type="subheadline" style={styles.metaText}>
                {recipe.servings}{" "}
                {recipe.servings === 1 ? "serving" : "servings"}
              </Text>
            </View>
          )}
        </View>
      </View>

      <Ionicons name="chevron-forward" size={20} style={styles.chevron} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create((theme) => ({
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.background,
    paddingVertical: 12,
    paddingHorizontal: 20,
    gap: 14,
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
    backgroundColor: theme.colors.inputBackground,
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderIcon: {
    color: theme.colors.textTertiary,
  },
  content: {
    flex: 1,
    gap: 4,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaIcon: {
    color: theme.colors.textSecondary,
  },
  metaText: {
    color: theme.colors.textSecondary,
  },
  chevron: {
    color: theme.colors.textTertiary,
  },
}));
