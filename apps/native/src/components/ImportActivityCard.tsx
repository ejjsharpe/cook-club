import { Ionicons } from "@expo/vector-icons";
import { formatDistanceToNow } from "date-fns";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as WebBrowser from "expo-web-browser";
import { memo, useMemo, useCallback } from "react";
import { View, TouchableOpacity, Alert } from "react-native";
import { SheetManager } from "react-native-actions-sheet";
import { StyleSheet } from "react-native-unistyles";

import { Text } from "./Text";

import type { RecipeImportFeedItem } from "@/api/activity";
import { useImportRecipe } from "@/api/recipe";

interface Props {
  activity: RecipeImportFeedItem;
  onPress?: () => void;
  onUserPress?: () => void;
  onLikePress?: () => void;
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
  ({ activity, onPress, onUserPress, onLikePress, onImportPress }: Props) => {
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
        onImportPress?.(activity.recipe.sourceUrl);
      } else {
        try {
          await importMutation.mutateAsync({ recipeId: activity.recipe.id });
          Alert.alert("Success", "Recipe added to your collection!");
        } catch (err: any) {
          Alert.alert("Error", err?.message || "Failed to import recipe");
        }
      }
    }, [activity.recipe, onImportPress, importMutation]);

    const handleComment = useCallback(() => {
      SheetManager.show("comments-sheet", {
        payload: { activityEventId: parseInt(activity.id, 10) },
      });
    }, [activity.id]);

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
              <Text type="footnote" style={styles.timeAgo}>
                {timeAgo}
              </Text>
            </View>
            <Text type="subheadline" style={styles.activityText}>
              imported from {getSourceDescription()}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Recipe Image with title overlay */}
        <TouchableOpacity
          style={styles.imageContainer}
          onPress={
            activity.recipe.sourceType === "url" ? handleViewSource : onPress
          }
          activeOpacity={0.9}
        >
          {activity.recipe.image && (
            <Image
              source={{ uri: activity.recipe.image }}
              style={styles.recipeImage}
              cachePolicy="memory-disk"
              transition={200}
            />
          )}
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.6)"]}
            style={styles.imageGradient}
          >
            <Text type="title3" numberOfLines={2} style={styles.recipeTitle}>
              {activity.recipe.name}
            </Text>
            {activity.recipe.sourceType === "url" && (
              <Text type="caption" style={styles.recipeSource}>
                {activity.recipe.sourceDomain}
              </Text>
            )}
          </LinearGradient>
        </TouchableOpacity>

        {/* Action buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.actionPill}
            activeOpacity={0.7}
            onPress={onLikePress}
          >
            <Ionicons
              name={activity.isLiked ? "heart" : "heart-outline"}
              size={18}
              style={[
                styles.actionIcon,
                activity.isLiked && styles.actionIconLiked,
              ]}
            />
            <Text type="subheadline" style={styles.actionText}>
              {activity.likeCount || "Like"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionPill}
            activeOpacity={0.7}
            onPress={handleComment}
          >
            <Ionicons
              name="chatbubble-outline"
              size={16}
              style={styles.actionIcon}
            />
            <Text type="subheadline" style={styles.actionText}>
              Comment
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionPillPrimary}
            onPress={handleImport}
            activeOpacity={0.7}
          >
            <Ionicons name="add" size={18} style={styles.actionIconPrimary} />
            <Text type="subheadline" style={styles.actionTextPrimary}>
              Import
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  },
);

const styles = StyleSheet.create((theme) => ({
  card: {
    backgroundColor: theme.colors.background,
    paddingVertical: 16,
    gap: 12,
  },
  userHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
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
    fontFamily: theme.fonts.semiBold,
  },
  userInfo: {
    flex: 1,
    gap: 2,
  },
  userNameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  userName: {},
  timeAgo: {
    color: theme.colors.textSecondary,
  },
  activityText: {
    color: theme.colors.textSecondary,
  },
  imageContainer: {
    marginHorizontal: 20,
    borderRadius: theme.borderRadius.large,
    overflow: "hidden",
  },
  recipeImage: {
    width: "100%",
    aspectRatio: 4 / 3,
  },
  imageGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 14,
    paddingTop: 40,
    gap: 2,
  },
  recipeTitle: {
    color: "#FFFFFF",
  },
  recipeSource: {
    color: "rgba(255,255,255,0.8)",
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 20,
  },
  actionPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 36,
    paddingHorizontal: 14,
    backgroundColor: theme.colors.inputBackground,
    borderRadius: theme.borderRadius.full,
  },
  actionIcon: {
    color: theme.colors.text,
  },
  actionIconLiked: {
    color: theme.colors.primary,
  },
  actionText: {
    color: theme.colors.text,
  },
  actionPillPrimary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 36,
    paddingHorizontal: 14,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.full,
  },
  actionIconPrimary: {
    color: theme.colors.buttonText,
  },
  actionTextPrimary: {
    color: theme.colors.buttonText,
  },
}));
