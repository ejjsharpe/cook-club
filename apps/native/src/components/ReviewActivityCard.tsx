import { Ionicons } from "@expo/vector-icons";
import { formatDistanceToNow } from "date-fns";
import { Image } from "expo-image";
import * as WebBrowser from "expo-web-browser";
import { memo, useMemo, useCallback } from "react";
import {
  View,
  TouchableOpacity,
  Alert,
  useWindowDimensions,
} from "react-native";
import { SheetManager } from "react-native-actions-sheet";
import Animated from "react-native-reanimated";
import { StyleSheet } from "react-native-unistyles";

import { Text } from "./Text";

import type { CookingReviewFeedItem } from "@/api/activity";
import { useImportRecipe } from "@/api/recipe";

interface Props {
  activity: CookingReviewFeedItem;
  onPress?: () => void;
  onUserPress?: () => void;
  onLikePress?: () => void;
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
          size={14}
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

const AnimatedFlatList = Animated.FlatList;

export const ReviewActivityCard = memo(
  ({ activity, onPress, onUserPress, onLikePress, onImportPress }: Props) => {
    const { width: screenWidth } = useWindowDimensions();
    const imageWidth = screenWidth - 40; // 20px padding on each side
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

    const hasImages = activity.review.images.length > 0;

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
              cooked {activity.recipe.name}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Review Images Carousel */}
        {hasImages && (
          <View style={styles.carouselContainer}>
            <AnimatedFlatList
              data={activity.review.images}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(_, index) => index.toString()}
              snapToInterval={imageWidth + 8}
              decelerationRate="fast"
              contentContainerStyle={styles.carouselContent}
              ItemSeparatorComponent={() => (
                <View style={styles.imageSeparator} />
              )}
              renderItem={({ item: imageUrl }) => (
                <View style={styles.imageWrapper}>
                  <Image
                    source={{ uri: imageUrl }}
                    style={[styles.reviewImage, { width: imageWidth }]}
                    cachePolicy="memory-disk"
                    transition={200}
                  />
                </View>
              )}
            />
          </View>
        )}

        {/* Review Content Card */}
        <View style={styles.contentCardWrapper}>
          <View style={styles.contentCard}>
            {/* Rating and Review Text */}
            <View style={styles.reviewContent}>
              <View style={styles.ratingRow}>
                <StarRating rating={activity.review.rating} />
                <Text type="footnote" style={styles.ratingText}>
                  {activity.review.rating}/5
                </Text>
              </View>

              {activity.review.text && (
                <Text type="body" style={styles.reviewText}>
                  {activity.review.text}
                </Text>
              )}
            </View>

            {/* Recipe Preview */}
            <TouchableOpacity
              style={styles.recipePreview}
              onPress={
                activity.recipe.sourceType === "url"
                  ? handleViewSource
                  : onPress
              }
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
                <Text
                  type="headline"
                  numberOfLines={2}
                  style={styles.recipeTitle}
                >
                  {activity.recipe.name}
                </Text>
                <Text type="footnote" style={styles.recipeSource}>
                  {activity.recipe.sourceType === "url"
                    ? activity.recipe.sourceDomain
                    : "View recipe"}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

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
    gap: 14,
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
    fontFamily: theme.fonts.albertSemiBold,
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
  carouselContainer: {},
  carouselContent: {
    paddingHorizontal: 20,
  },
  imageSeparator: {
    width: 8,
  },
  imageWrapper: {
    borderRadius: theme.borderRadius.large,
    overflow: "hidden",
  },
  reviewImage: {
    aspectRatio: 4 / 3,
  },
  contentCardWrapper: {
    paddingHorizontal: 20,
  },
  contentCard: {
    backgroundColor: theme.colors.inputBackground,
    borderRadius: theme.borderRadius.large,
    overflow: "hidden",
  },
  reviewContent: {
    padding: 16,
    gap: 8,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  ratingText: {
    color: theme.colors.textSecondary,
  },
  reviewText: {},
  recipePreview: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    gap: 12,
  },
  recipeImage: {
    width: 56,
    height: 56,
    borderRadius: theme.borderRadius.medium,
  },
  recipeInfo: {
    flex: 1,
    gap: 2,
  },
  recipeTitle: {},
  recipeSource: {
    color: theme.colors.textSecondary,
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
