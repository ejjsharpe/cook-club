import { useEffect } from "react";
import { View, ViewStyle, Dimensions } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  interpolate,
  FadeIn as ReanimatedFadeIn,
  FadeOut as ReanimatedFadeOut,
} from "react-native-reanimated";
import { StyleSheet } from "react-native-unistyles";

// ─── Fade In Component ───────────────────────────────────────────────────────

interface FadeInProps {
  children: React.ReactNode;
  duration?: number;
}

export const FadeIn = ({ children, duration = 300 }: FadeInProps) => {
  return (
    <Animated.View
      entering={ReanimatedFadeIn.duration(duration)}
      style={styles.fadeIn}
    >
      {children}
    </Animated.View>
  );
};

// ─── Skeleton Container Component ────────────────────────────────────────────

interface SkeletonContainerProps {
  isLoading: boolean;
  skeleton: React.ReactNode;
  children: React.ReactNode;
  duration?: number;
}

export const SkeletonContainer = ({
  isLoading,
  skeleton,
  children,
  duration = 300,
}: SkeletonContainerProps) => {
  return (
    <View style={styles.skeletonContainer}>
      {isLoading ? (
        <Animated.View
          key="skeleton"
          exiting={ReanimatedFadeOut.duration(duration)}
          style={styles.fadeIn}
        >
          {skeleton}
        </Animated.View>
      ) : (
        <Animated.View
          key="content"
          entering={ReanimatedFadeIn.duration(duration)}
          style={styles.fadeIn}
        >
          {children}
        </Animated.View>
      )}
    </View>
  );
};

interface SkeletonProps {
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export const Skeleton = ({
  width = "100%",
  height = 16,
  borderRadius = 4,
  style,
}: SkeletonProps) => {
  const shimmer = useSharedValue(0);

  useEffect(() => {
    shimmer.value = withRepeat(withTiming(1, { duration: 1200 }), -1, false);
  }, [shimmer]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(shimmer.value, [0, 0.5, 1], [0.3, 0.6, 0.3]),
  }));

  return (
    <Animated.View
      style={[
        styles.skeleton,
        { width, height, borderRadius },
        animatedStyle,
        style,
      ]}
    />
  );
};

// Shared user header skeleton for activity cards
const ActivityUserHeaderSkeleton = () => (
  <View style={styles.userHeader}>
    <Skeleton width={44} height={44} borderRadius={22} />
    <View style={styles.userInfo}>
      <View style={styles.userNameRow}>
        <Skeleton width={120} height={17} borderRadius={4} />
        <Skeleton width={50} height={13} borderRadius={4} />
      </View>
      <Skeleton width={160} height={15} borderRadius={4} />
    </View>
  </View>
);

// Shared action row skeleton
const ActivityActionRowSkeleton = () => (
  <View style={styles.actionRow}>
    <Skeleton width={70} height={36} borderRadius={18} />
    <Skeleton width={95} height={36} borderRadius={18} />
    <Skeleton width={80} height={36} borderRadius={18} />
  </View>
);

// Import Activity Card Skeleton (large image with overlay)
export const ImportActivityCardSkeleton = () => {
  return (
    <View style={styles.card}>
      <ActivityUserHeaderSkeleton />

      {/* Large recipe image */}
      <View style={styles.imageWrapper}>
        <Skeleton width="100%" height={260} borderRadius={16} />
      </View>

      <ActivityActionRowSkeleton />
    </View>
  );
};

// Review Activity Card Skeleton (carousel + content card)
export const ReviewActivityCardSkeleton = () => {
  return (
    <View style={styles.card}>
      <ActivityUserHeaderSkeleton />

      {/* Review image carousel */}
      <View style={styles.imageWrapper}>
        <Skeleton width="100%" height={260} borderRadius={16} />
      </View>

      {/* Content Card */}
      <View style={styles.contentCardWrapper}>
        <View style={styles.contentCard}>
          {/* Rating and review text */}
          <View style={styles.reviewContent}>
            <Skeleton width={100} height={14} borderRadius={4} />
            <Skeleton width="85%" height={17} borderRadius={4} />
          </View>

          {/* Recipe Preview */}
          <View style={styles.recipePreview}>
            <Skeleton width={56} height={56} borderRadius={12} />
            <View style={styles.recipeInfo}>
              <Skeleton width="65%" height={17} borderRadius={4} />
              <Skeleton width={80} height={13} borderRadius={4} />
            </View>
          </View>
        </View>
      </View>

      <ActivityActionRowSkeleton />
    </View>
  );
};

// Legacy alias for backwards compatibility
export const ActivityCardSkeleton = ({
  showReviewImage = false,
}: { showReviewImage?: boolean } = {}) => {
  return showReviewImage ? (
    <ReviewActivityCardSkeleton />
  ) : (
    <ImportActivityCardSkeleton />
  );
};

export const HomeFeedSkeleton = () => {
  return (
    <View style={styles.feedSkeletonContainer}>
      <ImportActivityCardSkeleton />
      <View style={styles.feedSeparator} />
      <ReviewActivityCardSkeleton />
      <View style={styles.feedSeparator} />
      <ImportActivityCardSkeleton />
    </View>
  );
};

// ─── Recipe Card Skeleton ────────────────────────────────────────────────────

export const RecipeCardSkeleton = () => {
  return (
    <View style={styles.recipeCard}>
      <Skeleton width={100} height={100} borderRadius={12} />
      <View style={styles.recipeCardContent}>
        <Skeleton width="80%" height={17} borderRadius={4} />
        <View style={styles.recipeCardMeta}>
          <Skeleton width={70} height={14} borderRadius={4} />
          <Skeleton width={80} height={14} borderRadius={4} />
        </View>
      </View>
      <Skeleton width={20} height={20} borderRadius={4} />
    </View>
  );
};

export const MyRecipesListSkeleton = () => {
  return (
    <View>
      <RecipeCardSkeleton />
      <View style={styles.recipeSeparator}>
        <View style={styles.recipeSeparatorLine} />
      </View>
      <RecipeCardSkeleton />
      <View style={styles.recipeSeparator}>
        <View style={styles.recipeSeparatorLine} />
      </View>
      <RecipeCardSkeleton />
      <View style={styles.recipeSeparator}>
        <View style={styles.recipeSeparatorLine} />
      </View>
      <RecipeCardSkeleton />
    </View>
  );
};

// ─── Collection Card Skeleton ────────────────────────────────────────────────

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const GRID_PADDING = 20;
const GRID_GAP = 12;

export const CollectionGridCardSkeleton = () => {
  return (
    <View style={styles.collectionGridCard}>
      <Skeleton
        width="100%"
        height={100}
        borderRadius={12}
        style={styles.collectionGridImageSkeleton}
      />
      <View style={styles.collectionGridContent}>
        <Skeleton width="80%" height={17} borderRadius={4} />
        <Skeleton width={60} height={14} borderRadius={4} />
      </View>
    </View>
  );
};

export const CollectionsListSkeleton = () => {
  return (
    <View style={styles.collectionsGridContainer}>
      <View style={styles.collectionsGridRow}>
        <CollectionGridCardSkeleton />
        <CollectionGridCardSkeleton />
      </View>
      <View style={styles.collectionsGridRow}>
        <CollectionGridCardSkeleton />
        <CollectionGridCardSkeleton />
      </View>
    </View>
  );
};

// ─── Shopping List Skeleton ──────────────────────────────────────────────────

const ShoppingItemSkeleton = () => {
  return (
    <View style={styles.shoppingItemOuter}>
      <View style={styles.shoppingItemInner}>
        <View style={styles.shoppingCheckbox}>
          <Skeleton width={26} height={26} borderRadius={13} />
        </View>
        <View style={styles.shoppingItemContent}>
          <Skeleton width="70%" height={17} borderRadius={4} />
          <Skeleton width={120} height={13} borderRadius={4} />
        </View>
      </View>
    </View>
  );
};

export const ShoppingListSkeleton = () => {
  return (
    <View>
      {/* Section header */}
      <View style={styles.shoppingSectionHeader}>
        <Skeleton width={100} height={20} borderRadius={4} />
      </View>

      {/* Items */}
      <ShoppingItemSkeleton />
      <ShoppingItemSkeleton />
      <ShoppingItemSkeleton />

      {/* Another section */}
      <View style={styles.shoppingSectionHeader}>
        <Skeleton width={80} height={20} borderRadius={4} />
      </View>

      <ShoppingItemSkeleton />
      <ShoppingItemSkeleton />

      {/* Third section */}
      <View style={styles.shoppingSectionHeader}>
        <Skeleton width={60} height={20} borderRadius={4} />
      </View>

      <ShoppingItemSkeleton />
      <ShoppingItemSkeleton />
      <ShoppingItemSkeleton />
    </View>
  );
};

// ─── User Profile Skeleton ───────────────────────────────────────────────────

export const UserProfileSkeleton = () => {
  return (
    <View style={styles.userProfileContainer}>
      {/* Profile Header */}
      <View style={styles.userProfileHeader}>
        {/* Avatar */}
        <Skeleton width={100} height={100} borderRadius={50} />

        <View style={styles.userProfileSpacer16} />

        {/* Name */}
        <Skeleton width={160} height={28} borderRadius={6} />

        <View style={styles.userProfileSpacer8} />

        {/* Email */}
        <Skeleton width={200} height={17} borderRadius={4} />

        <View style={styles.userProfileSpacer8} />

        {/* Join date */}
        <Skeleton width={120} height={14} borderRadius={4} />

        <View style={styles.userProfileSpacer20} />

        {/* Stats */}
        <View style={styles.userProfileStats}>
          <View style={styles.userProfileStatItem}>
            <Skeleton width={40} height={24} borderRadius={4} />
            <Skeleton width={70} height={14} borderRadius={4} />
          </View>
          <View style={styles.userProfileStatItem}>
            <Skeleton width={40} height={24} borderRadius={4} />
            <Skeleton width={70} height={14} borderRadius={4} />
          </View>
          <View style={styles.userProfileStatItem}>
            <Skeleton width={40} height={24} borderRadius={4} />
            <Skeleton width={60} height={14} borderRadius={4} />
          </View>
        </View>
      </View>

      <View style={styles.userProfileSpacer24} />

      {/* Action Buttons */}
      <View style={styles.userProfileActions}>
        <Skeleton width="48%" height={50} borderRadius={25} />
        <Skeleton width="48%" height={50} borderRadius={25} />
      </View>

      <View style={styles.userProfileSpacer24} />

      {/* Activity Section Header */}
      <View style={styles.userProfileSectionHeader}>
        <Skeleton width={80} height={22} borderRadius={4} />
      </View>

      <View style={styles.userProfileSpacer12} />

      {/* Activity Cards */}
      <ImportActivityCardSkeleton />
      <View style={styles.feedSeparator} />
      <ReviewActivityCardSkeleton />
    </View>
  );
};

// ─── Recipe Detail Skeleton ──────────────────────────────────────────────────

const IMAGE_HEIGHT = 400;

const IngredientItemSkeleton = () => (
  <View style={styles.ingredientItem}>
    <Skeleton width={8} height={8} borderRadius={4} />
    <View style={styles.ingredientContent}>
      <Skeleton width={60} height={15} borderRadius={4} />
      <Skeleton width="70%" height={17} borderRadius={4} />
    </View>
  </View>
);

export const RecipeDetailSkeleton = () => {
  return (
    <View style={styles.recipeDetailScreen}>
      {/* Cover Image */}
      <View style={styles.coverSection}>
        <Skeleton width={SCREEN_WIDTH} height={IMAGE_HEIGHT} borderRadius={0} />
      </View>

      {/* White Card */}
      <View style={styles.whiteCard}>
        {/* Title */}
        <Skeleton width="85%" height={28} borderRadius={6} />

        <View style={styles.spacer16} />

        {/* Times Row */}
        <View style={styles.timesRow}>
          <Skeleton width={100} height={18} borderRadius={4} />
          <Skeleton width={100} height={18} borderRadius={4} />
        </View>

        <View style={styles.spacer24} />

        {/* Servings Row */}
        <View style={styles.servingsRow}>
          <Skeleton width="48%" height={56} borderRadius={28} />
          <Skeleton width="48%" height={56} borderRadius={28} />
        </View>

        <View style={styles.spacer24} />

        {/* Tab Bar */}
        <View style={styles.tabBar}>
          <Skeleton width="45%" height={20} borderRadius={4} />
          <Skeleton width="45%" height={20} borderRadius={4} />
        </View>

        <View style={styles.spacer24} />

        {/* Ingredients List */}
        <IngredientItemSkeleton />
        <IngredientItemSkeleton />
        <IngredientItemSkeleton />
        <IngredientItemSkeleton />
        <IngredientItemSkeleton />
      </View>
    </View>
  );
};

const styles = StyleSheet.create((theme) => ({
  fadeIn: {
    flex: 1,
  },
  skeletonContainer: {
    flex: 1,
  },
  skeleton: {
    backgroundColor: theme.colors.border,
  },
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
  userInfo: {
    flex: 1,
    gap: 4,
  },
  userNameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 20,
  },
  imageWrapper: {
    paddingHorizontal: 20,
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
  recipePreview: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    gap: 12,
  },
  recipeInfo: {
    flex: 1,
    gap: 4,
  },
  feedSkeletonContainer: {},
  feedSeparator: {
    height: 16,
  },

  // Recipe Card styles
  recipeCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 20,
    gap: 14,
  },
  recipeCardContent: {
    flex: 1,
    gap: 8,
  },
  recipeCardMeta: {
    flexDirection: "row",
    gap: 12,
  },
  recipeSeparator: {
    paddingVertical: 8,
    paddingHorizontal: 20,
  },
  recipeSeparatorLine: {
    height: 1,
    backgroundColor: theme.colors.border,
    opacity: 0.5,
  },

  // Collections styles
  collectionGridCard: {
    flex: 1,
  },
  collectionGridImageSkeleton: {
    aspectRatio: 1,
    height: "auto",
  },
  collectionGridContent: {
    paddingTop: 8,
    gap: 4,
  },
  collectionsGridContainer: {
    paddingHorizontal: GRID_PADDING,
    gap: GRID_GAP,
  },
  collectionsGridRow: {
    flexDirection: "row",
    gap: GRID_GAP,
  },

  // Shopping List styles
  shoppingSectionHeader: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  shoppingItemOuter: {
    paddingHorizontal: 12,
    paddingVertical: 1,
  },
  shoppingItemInner: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 56,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  shoppingCheckbox: {
    marginRight: 14,
  },
  shoppingItemContent: {
    flex: 1,
    gap: 6,
  },

  // Recipe Detail styles
  recipeDetailScreen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  coverSection: {
    height: IMAGE_HEIGHT,
  },
  whiteCard: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -24,
    paddingTop: 28,
    paddingHorizontal: 20,
    minHeight: 400,
  },
  spacer16: {
    height: 16,
  },
  spacer24: {
    height: 24,
  },
  timesRow: {
    flexDirection: "row",
    gap: 16,
  },
  servingsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  tabBar: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  ingredientItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    gap: 12,
  },
  ingredientContent: {
    flex: 1,
    gap: 6,
  },

  // User Profile styles
  userProfileContainer: {
    paddingTop: 20,
  },
  userProfileHeader: {
    alignItems: "center",
    paddingHorizontal: 20,
  },
  userProfileSpacer8: {
    height: 8,
  },
  userProfileSpacer12: {
    height: 12,
  },
  userProfileSpacer16: {
    height: 16,
  },
  userProfileSpacer20: {
    height: 20,
  },
  userProfileSpacer24: {
    height: 24,
  },
  userProfileStats: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 40,
  },
  userProfileStatItem: {
    alignItems: "center",
    gap: 4,
  },
  userProfileActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
  },
  userProfileSectionHeader: {
    paddingHorizontal: 24,
  },
}));
