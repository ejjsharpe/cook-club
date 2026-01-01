import { Ionicons } from "@expo/vector-icons";
import { formatDistanceToNow } from "date-fns";
import { Image } from "expo-image";
import * as WebBrowser from "expo-web-browser";
import { memo, useMemo, useCallback } from "react";
import { View, TouchableOpacity, ScrollView } from "react-native";
import { StyleSheet } from "react-native-unistyles";

import { Text } from "./Text";

import type { CookingReviewFeedItem } from "@/api/activity";

interface Props {
  activity: CookingReviewFeedItem;
  onPress?: () => void;
  onUserPress?: () => void;
  onImportPress?: (sourceUrl: string) => void;
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

const StarRating = ({ rating }: { rating: number }) => {
  return (
    <View style={starStyles.container}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Ionicons
          key={star}
          name={star <= rating ? "star" : "star-outline"}
          size={16}
          style={star <= rating ? starStyles.filled : starStyles.empty}
        />
      ))}
    </View>
  );
};

const starStyles = StyleSheet.create((theme) => ({
  container: {
    flexDirection: "row",
    gap: 2,
  },
  filled: {
    color: theme.colors.primary,
  },
  empty: {
    color: theme.colors.border,
  },
}));

export const ReviewActivityCard = memo(
  ({ activity, onPress, onUserPress, onImportPress }: Props) => {
    const timeAgo = useMemo(
      () =>
        formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true }),
      [activity.createdAt],
    );

    const userInitials = useMemo(
      () => getInitials(activity.actor.name),
      [activity.actor.name],
    );

    const hasImages = activity.review.images.length > 0;

    // Handle opening external source URL
    const handleViewSource = useCallback(async () => {
      if (activity.recipe.sourceType === "url") {
        await WebBrowser.openBrowserAsync(activity.recipe.sourceUrl);
      }
    }, [activity.recipe]);

    // Handle importing the recipe
    const handleImport = useCallback(() => {
      if (activity.recipe.sourceType === "url") {
        onImportPress?.(activity.recipe.sourceUrl);
      }
    }, [activity.recipe, onImportPress]);

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
              <Text type="body" style={styles.userName}>
                {activity.actor.name}
              </Text>
              <Text type="bodyFaded" style={styles.uploadTime}>
                {timeAgo}
              </Text>
            </View>
            <Text type="bodyFaded" style={styles.activityText}>
              cooked{" "}
              <Text style={styles.recipeName}>{activity.recipe.name}</Text>
            </Text>
          </View>
        </TouchableOpacity>

        {/* Rating */}
        <View style={styles.ratingRow}>
          <StarRating rating={activity.review.rating} />
        </View>

        {/* Review Text */}
        {activity.review.text && (
          <View style={styles.reviewTextContainer}>
            <Text type="body" style={styles.reviewText}>
              {activity.review.text}
            </Text>
          </View>
        )}

        {/* Review Images */}
        {hasImages && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.imagesContainer}
          >
            {activity.review.images.map((imageUrl, index) => (
              <Image
                key={index}
                source={{ uri: imageUrl }}
                style={styles.reviewImage}
                cachePolicy="memory-disk"
                transition={200}
              />
            ))}
          </ScrollView>
        )}

        {/* Recipe Preview */}
        {activity.recipe.sourceType === "url" ? (
          // For URL-sourced recipes, show non-tappable preview with action buttons
          <>
            <View style={styles.recipePreview}>
              {activity.recipe.image && (
                <Image
                  source={{ uri: activity.recipe.image }}
                  style={styles.recipeImage}
                  cachePolicy="memory-disk"
                  transition={200}
                />
              )}
              <View style={styles.recipeInfo}>
                <Text type="body" style={styles.recipeTitle} numberOfLines={2}>
                  {activity.recipe.name}
                </Text>
                <Text type="bodyFaded" style={styles.tapToView}>
                  from {activity.recipe.sourceDomain}
                </Text>
              </View>
            </View>
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.viewSourceButton}
                onPress={handleViewSource}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="open-outline"
                  size={16}
                  style={styles.viewSourceIcon}
                />
                <Text style={styles.viewSourceButtonText}>
                  View on {activity.recipe.sourceDomain}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.importButton}
                onPress={handleImport}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="add-circle-outline"
                  size={16}
                  style={styles.importIcon}
                />
                <Text style={styles.importButtonText}>Import</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          // For non-URL recipes, show tappable preview
          <TouchableOpacity
            style={styles.recipePreview}
            onPress={onPress}
            activeOpacity={0.8}
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
              <Text type="body" style={styles.recipeTitle} numberOfLines={2}>
                {activity.recipe.name}
              </Text>
              <Text type="bodyFaded" style={styles.tapToView}>
                Tap to view recipe
              </Text>
            </View>
          </TouchableOpacity>
        )}
      </View>
    );
  },
);

const styles = StyleSheet.create((theme) => ({
  card: {
    backgroundColor: theme.colors.background,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingVertical: 12,
    marginHorizontal: 20,
  },
  userHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
    fontSize: 16,
    fontWeight: "600",
  },
  userInfo: {
    flex: 1,
    gap: 2,
  },
  userNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  userName: {
    fontSize: 14,
    fontWeight: "600",
  },
  uploadTime: {
    fontSize: 12,
  },
  activityText: {
    fontSize: 14,
    lineHeight: 20,
  },
  recipeName: {
    fontWeight: "600",
    color: theme.colors.text,
  },
  ratingRow: {
    marginTop: 8,
    marginLeft: 52,
  },
  reviewTextContainer: {
    marginTop: 8,
    marginLeft: 52,
  },
  reviewText: {
    fontSize: 14,
    lineHeight: 20,
  },
  imagesContainer: {
    marginTop: 12,
    marginHorizontal: -20,
    paddingLeft: 72, // 20px card padding + 40px avatar + 12px gap
    paddingRight: 20,
    gap: 8,
  },
  reviewImage: {
    width: 160,
    height: 160,
    borderRadius: 12,
  },
  recipePreview: {
    flexDirection: "row",
    marginTop: 12,
    marginLeft: 52,
    backgroundColor: "#f5f5f5",
    borderRadius: 12,
    overflow: "hidden",
  },
  recipeImage: {
    width: 60,
    height: 60,
  },
  recipeInfo: {
    flex: 1,
    padding: 10,
    justifyContent: "center",
    gap: 2,
  },
  recipeTitle: {
    fontSize: 13,
    fontWeight: "500",
  },
  tapToView: {
    fontSize: 11,
  },
  actionRow: {
    marginTop: 8,
    marginLeft: 52,
    flexDirection: "row",
    gap: 8,
  },
  viewSourceButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 6,
  },
  viewSourceIcon: {
    color: theme.colors.text,
  },
  viewSourceButtonText: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: "500",
  },
  importButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: theme.colors.primary,
    borderRadius: 6,
  },
  importIcon: {
    color: theme.colors.buttonText,
  },
  importButtonText: {
    color: theme.colors.buttonText,
    fontSize: 12,
    fontWeight: "500",
  },
}));
