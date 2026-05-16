import { formatDistanceToNow } from "date-fns";
import { Image } from "expo-image";
import * as WebBrowser from "expo-web-browser";
import { memo, useMemo, useCallback } from "react";
import {
  ScrollView,
  View,
  TouchableOpacity,
  useWindowDimensions,
} from "react-native";
import { StyleSheet } from "react-native-unistyles";

import { Text } from "./Text";

import type { CookingReviewFeedItem } from "@/api/activity";
import { ActivityActionRow } from "@/components/ActivityActionRow";
import { Ionicons } from "@/components/Ionicons";
import { getImageUrl } from "@/utils/imageUrl";

interface Props {
  activity: CookingReviewFeedItem;
  onRecipePress?: (recipeId: number) => void;
  onUserPress?: (userId: string) => void;
  onLikePress?: (activityEventId: number) => void;
  onImportPress?: (sourceUrl: string) => void;
  onImportRecipePress?: (recipeId: number) => void;
  onCommentPress?: (activityEventId: number) => void;
  timeAgo?: string;
  userInitials?: string;
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

const ReviewImageCarousel = memo(
  ({ images, imageWidth }: { images: string[]; imageWidth: number }) => {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={imageWidth + 8}
        decelerationRate="fast"
        contentContainerStyle={styles.carouselContent}
      >
        {images.map((imageUrl, index) => (
          <View
            key={`${imageUrl}-${index}`}
            style={[
              styles.imageWrapper,
              { width: imageWidth },
              index < images.length - 1 && styles.imageItemGap,
            ]}
          >
            <Image
              source={{
                uri: getImageUrl(imageUrl, "feed-review") ?? imageUrl,
              }}
              style={styles.reviewImage}
              cachePolicy="memory-disk"
            />
          </View>
        ))}
      </ScrollView>
    );
  },
);

const ActivityUserHeader = memo(
  ({
    actor,
    timeAgo,
    userInitials,
    actionText,
    onPress,
  }: {
    actor: CookingReviewFeedItem["actor"];
    timeAgo: string;
    userInitials: string;
    actionText: string;
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
          {actionText}
        </Text>
      </View>
    </TouchableOpacity>
  ),
);

const ReviewContentCard = memo(
  ({
    review,
    recipe,
    onRecipePress,
    onViewSource,
  }: {
    review: CookingReviewFeedItem["review"];
    recipe: CookingReviewFeedItem["recipe"];
    onRecipePress: () => void;
    onViewSource: () => void;
  }) => (
    <View style={styles.contentCardWrapper}>
      <View style={styles.contentCard}>
        <View style={styles.reviewContent}>
          <View style={styles.ratingRow}>
            <StarRating rating={review.rating} />
            <Text type="footnote" style={styles.ratingText}>
              {review.rating}/5
            </Text>
          </View>

          {review.text && (
            <Text type="body" style={styles.reviewText}>
              {review.text}
            </Text>
          )}
        </View>

        <TouchableOpacity
          style={styles.recipePreview}
          onPress={recipe.sourceType === "url" ? onViewSource : onRecipePress}
          activeOpacity={0.7}
        >
          {recipe.image && (
            <Image
              source={{ uri: getImageUrl(recipe.image, "recipe-thumb") }}
              style={styles.recipeImage}
              cachePolicy="memory-disk"
            />
          )}
          <View style={styles.recipeInfo}>
            <Text type="headline" numberOfLines={2} style={styles.recipeTitle}>
              {recipe.name}
            </Text>
            <Text type="footnote" style={styles.recipeSource}>
              {recipe.sourceType === "url" ? recipe.sourceDomain : "View recipe"}
            </Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  ),
);

export const ReviewActivityCard = memo(
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
  }: Props) => {
    const { width: screenWidth } = useWindowDimensions();
    const imageWidth = screenWidth - 40; // 20px padding on each side
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

    const hasImages = activity.review.images.length > 0;

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

    return (
      <View style={styles.card}>
        <ActivityUserHeader
          actor={activity.actor}
          timeAgo={timeAgo}
          userInitials={userInitials}
          actionText={`cooked ${activity.recipe.name}`}
          onPress={handleUserPress}
        />

        {/* Review Images Carousel */}
        {hasImages && (
          <View style={styles.carouselContainer}>
            <ReviewImageCarousel
              images={activity.review.images}
              imageWidth={imageWidth}
            />
          </View>
        )}

        <ReviewContentCard
          review={activity.review}
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
  carouselContainer: {},
  carouselContent: {
    paddingHorizontal: 20,
  },
  imageWrapper: {
    borderRadius: theme.borderRadius.large,
    overflow: "hidden",
  },
  imageItemGap: {
    marginRight: 8,
  },
  reviewImage: {
    width: "100%",
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
}));
