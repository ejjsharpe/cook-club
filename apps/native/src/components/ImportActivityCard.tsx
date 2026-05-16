import { formatDistanceToNow } from "date-fns";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as WebBrowser from "expo-web-browser";
import { memo, useMemo, useCallback } from "react";
import { View, TouchableOpacity } from "react-native";
import { StyleSheet } from "react-native-unistyles";

import { Text } from "./Text";

import type { RecipeImportFeedItem } from "@/api/activity";
import { ActivityActionRow } from "@/components/ActivityActionRow";
import { getImageUrl } from "@/utils/imageUrl";

interface Props {
  activity: RecipeImportFeedItem;
  onRecipePress?: (recipeId: number) => void;
  onUserPress?: (userId: string) => void;
  onLikePress?: (activityEventId: number) => void;
  onImportPress?: (sourceUrl: string) => void;
  onImportRecipePress?: (recipeId: number) => void;
  onViewSourcePress?: () => void;
  onCommentPress?: (activityEventId: number) => void;
  timeAgo?: string;
  userInitials?: string;
  sourceDescription?: string;
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

const ImportUserHeader = memo(
  ({
    actor,
    timeAgo,
    userInitials,
    sourceDescription,
    onPress,
  }: {
    actor: RecipeImportFeedItem["actor"];
    timeAgo: string;
    userInitials: string;
    sourceDescription: string;
    onPress: () => void;
  }) => (
    <TouchableOpacity
      style={styles.userHeader}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.avatar}>
        {actor.image ? (
          <Image
            source={{ uri: getImageUrl(actor.image, "avatar-sm") }}
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
          <View style={styles.nameGroup}>
            <Text type="headline" style={styles.userName}>
              {actor.name}
            </Text>
            {actor.username && (
              <Text type="footnote" style={styles.username}>
                @{actor.username}
              </Text>
            )}
          </View>
          <Text type="footnote" style={styles.timeAgo}>
            {timeAgo}
          </Text>
        </View>
        <Text type="subheadline" style={styles.activityText}>
          imported from {sourceDescription}
        </Text>
      </View>
    </TouchableOpacity>
  ),
);

const ImportRecipeHero = memo(
  ({
    recipe,
    onRecipePress,
    onViewSource,
  }: {
    recipe: RecipeImportFeedItem["recipe"];
    onRecipePress: () => void;
    onViewSource: () => void;
  }) => (
    <TouchableOpacity
      style={styles.imageContainer}
      onPress={recipe.sourceType === "url" ? onViewSource : onRecipePress}
      activeOpacity={0.9}
    >
      {recipe.image && (
        <Image
          source={{ uri: getImageUrl(recipe.image, "recipe-card") }}
          style={styles.recipeImage}
          cachePolicy="memory-disk"
        />
      )}
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.6)"]}
        style={styles.imageGradient}
      >
        <Text type="title3" numberOfLines={2} style={styles.recipeTitle}>
          {recipe.name}
        </Text>
        {recipe.sourceType === "url" && (
          <Text type="caption" style={styles.recipeSource}>
            {recipe.sourceDomain}
          </Text>
        )}
      </LinearGradient>
    </TouchableOpacity>
  ),
);

export const ImportActivityCard = memo(
  ({
    activity,
    onRecipePress,
    onUserPress,
    onLikePress,
    onImportPress,
    onImportRecipePress,
    onCommentPress,
    timeAgo: providedTimeAgo,
    userInitials: providedUserInitials,
    sourceDescription: providedSourceDescription,
  }: Props) => {
    const activityId = useMemo(() => parseInt(activity.id, 10), [activity.id]);

    const timeAgo = useMemo(
      () =>
        providedTimeAgo ??
        formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true }),
      [activity.createdAt, providedTimeAgo],
    );

    const userInitials = useMemo(
      () => providedUserInitials ?? getInitials(activity.actor.name),
      [activity.actor.name, providedUserInitials],
    );

    const handleViewSource = useCallback(async () => {
      if (activity.recipe.sourceType === "url") {
        await WebBrowser.openBrowserAsync(activity.recipe.sourceUrl);
      }
    }, [activity.recipe]);

    const handleRecipePress = useCallback(() => {
      onRecipePress?.(activity.recipe.id);
    }, [activity.recipe.id, onRecipePress]);

    const handleUserPress = useCallback(() => {
      onUserPress?.(activity.actor.id);
    }, [activity.actor.id, onUserPress]);

    const handleImport = useCallback(() => {
      if (activity.recipe.sourceType === "url") {
        onImportPress?.(activity.recipe.sourceUrl);
      } else {
        onImportRecipePress?.(activity.recipe.id);
      }
    }, [activity.recipe, onImportPress, onImportRecipePress]);

    const sourceDescription = useMemo(() => {
      if (providedSourceDescription) return providedSourceDescription;
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
    }, [activity.recipe, providedSourceDescription]);

    return (
      <View style={styles.card}>
        <ImportUserHeader
          actor={activity.actor}
          timeAgo={timeAgo}
          userInitials={userInitials}
          sourceDescription={sourceDescription}
          onPress={handleUserPress}
        />

        <ImportRecipeHero
          recipe={activity.recipe}
          onRecipePress={handleRecipePress}
          onViewSource={handleViewSource}
        />

        <ActivityActionRow
          activityId={activityId}
          isLiked={activity.isLiked}
          likeCount={activity.likeCount}
          onLikePress={onLikePress}
          onCommentPress={onCommentPress}
          onImportPress={handleImport}
        />
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
  nameGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  userName: {},
  username: {
    color: theme.colors.textSecondary,
  },
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
}));
