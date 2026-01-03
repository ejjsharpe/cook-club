import { Ionicons } from "@expo/vector-icons";
import { formatDistanceToNow } from "date-fns";
import { Image } from "expo-image";
import * as WebBrowser from "expo-web-browser";
import { memo, useMemo, useCallback } from "react";
import { View, TouchableOpacity, Alert } from "react-native";
import { StyleSheet } from "react-native-unistyles";

import { Text } from "./Text";

import type { RecipeImportFeedItem } from "@/api/activity";
import { useImportRecipe } from "@/api/recipe";

interface Props {
  activity: RecipeImportFeedItem;
  onPress?: () => void;
  onUserPress?: () => void;
  onImportPress?: (sourceUrl: string) => void;
  onViewSourcePress?: () => void;
}

const getInitials = (name: string): string => {
  const words = name
    .trim()
    .split(" ")
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

export const ImportActivityCard = memo(
  ({ activity, onPress, onUserPress, onImportPress }: Props) => {
    const importMutation = useImportRecipe();

    const timeAgo = useMemo(
      () =>
        formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true }),
      [activity.createdAt],
    );

    const userInitials = useMemo(
      () => getInitials(activity.actor.name),
      [activity.actor.name],
    );

    const handleViewSource = useCallback(async () => {
      if (activity.recipe.sourceType === "url") {
        await WebBrowser.openBrowserAsync(activity.recipe.sourceUrl);
      }
    }, [activity.recipe]);

    const handleImport = useCallback(async () => {
      if (activity.recipe.sourceType === "url") {
        // For URL recipes, use the import sheet flow
        onImportPress?.(activity.recipe.sourceUrl);
      } else {
        // For non-URL recipes, import directly
        try {
          await importMutation.mutateAsync({ recipeId: activity.recipe.id });
          Alert.alert("Success", "Recipe added to your collection!");
        } catch (err: any) {
          Alert.alert("Error", err?.message || "Failed to import recipe");
        }
      }
    }, [activity.recipe, onImportPress, importMutation]);

    const getSourceDescription = () => {
      if (activity.recipe.sourceType === "url") {
        return activity.recipe.sourceDomain;
      }
      switch (activity.recipe.sourceType) {
        case "text":
          return "text";
        case "image":
          return "an image";
        case "ai":
          return "AI";
        case "user":
          return "another user";
        case "manual":
          return "scratch";
        default:
          return "their collection";
      }
    };

    return (
      <View style={styles.card}>
        {/* User Header */}
        <TouchableOpacity
          style={styles.userHeader}
          onPress={onUserPress}
          activeOpacity={0.7}
        >
          <View style={styles.avatar}>
            {activity.actor.image ? (
              <Image
                source={{ uri: activity.actor.image }}
                style={styles.avatarImage}
                cachePolicy="memory-disk"
                transition={100}
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarInitials}>{userInitials}</Text>
              </View>
            )}
          </View>
          <View style={styles.userInfo}>
            <View style={styles.userNameRow}>
              <Text type="headline" style={styles.userName}>
                {activity.actor.name}
              </Text>
              <Text type="caption" style={styles.dot}>
                ·
              </Text>
              <Text type="caption">{timeAgo}</Text>
            </View>
            <Text type="subheadline" style={styles.activityText}>
              imported from {getSourceDescription()}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Recipe Preview Card */}
        <View style={styles.contentCard}>
          <View style={styles.recipeContainer}>
            <TouchableOpacity
              style={styles.recipePreview}
              onPress={activity.recipe.sourceType === "url" ? handleViewSource : onPress}
              activeOpacity={0.7}
            >
              {activity.recipe.image && (
                <Image
                  source={{ uri: activity.recipe.image }}
                  style={styles.recipeImage}
                  cachePolicy="memory-disk"
                  transition={200}
                />
              )}
              <View style={styles.recipeInfo}>
                <Text type="headline" numberOfLines={2} style={styles.recipeTitle}>
                  {activity.recipe.name}
                </Text>
                <Text type="caption" style={styles.recipeSource}>
                  {activity.recipe.sourceType === "url"
                    ? activity.recipe.sourceDomain
                    : "View recipe"}
                </Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.importButton}
              onPress={handleImport}
              activeOpacity={0.7}
            >
              <Ionicons
                name="add"
                size={16}
                style={styles.importIcon}
              />
              <Text type="footnote" style={styles.importText}>
                Import
              </Text>
            </TouchableOpacity>
          </View>
        </View>

      </View>
    );
  },
);

const styles = StyleSheet.create((theme) => ({
  card: {
    backgroundColor: theme.colors.background,
    paddingTop: 16,
    paddingBottom: 20,
    paddingHorizontal: 20,
    gap: 12,
  },
  userHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: "hidden",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  avatarPlaceholder: {
    width: "100%",
    height: "100%",
    backgroundColor: theme.colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarInitials: {
    color: theme.colors.buttonText,
    fontSize: 17,
    fontFamily: theme.fonts.albertSemiBold,
  },
  userInfo: {
    flex: 1,
    gap: 2,
  },
  userNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  userName: {},
  dot: {
    opacity: 0.5,
  },
  activityText: {
    color: theme.colors.textSecondary,
  },
  contentCard: {
    backgroundColor: theme.colors.inputBackground,
    borderRadius: theme.borderRadius.large,
    overflow: "hidden",
  },
  recipeContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    gap: 12,
  },
  recipePreview: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  recipeImage: {
    width: 64,
    height: 64,
    borderRadius: theme.borderRadius.small,
  },
  recipeInfo: {
    flex: 1,
    gap: 4,
  },
  recipeTitle: {},
  recipeSource: {
    color: theme.colors.textSecondary,
  },
  importButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: 32,
    paddingHorizontal: 12,
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.full,
  },
  importIcon: {
    color: theme.colors.primary,
  },
  importText: {
    fontFamily: theme.fonts.albertSemiBold,
    color: theme.colors.primary,
  },
}));
