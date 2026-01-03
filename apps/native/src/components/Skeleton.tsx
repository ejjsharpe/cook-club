import { useEffect } from "react";
import { View, ViewStyle, Dimensions } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  interpolate,
} from "react-native-reanimated";
import { StyleSheet } from "react-native-unistyles";

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

interface ActivityCardSkeletonProps {
  showReviewImage?: boolean;
}

export const ActivityCardSkeleton = ({
  showReviewImage = false,
}: ActivityCardSkeletonProps = {}) => {
  return (
    <View style={styles.card}>
      {/* User Header */}
      <View style={styles.userHeader}>
        <Skeleton width={44} height={44} borderRadius={22} />
        <View style={styles.userInfo}>
          <View style={styles.userNameRow}>
            <Skeleton width={100} height={17} borderRadius={4} />
            <Skeleton width={60} height={12} borderRadius={4} />
          </View>
          <Skeleton width={140} height={15} borderRadius={4} />
        </View>
      </View>

      {/* Content Card */}
      <View style={styles.contentCard}>
        {/* Optional review image */}
        {showReviewImage && (
          <Skeleton
            width="100%"
            height={200}
            borderRadius={0}
            style={styles.reviewImageSkeleton}
          />
        )}

        {/* Review content (for review cards) */}
        {showReviewImage && (
          <View style={styles.reviewContent}>
            <Skeleton width={90} height={14} borderRadius={4} />
            <Skeleton width="80%" height={16} borderRadius={4} />
          </View>
        )}

        {/* Recipe Preview */}
        <View style={styles.recipeContainer}>
          <View style={styles.recipePreview}>
            <Skeleton width={64} height={64} borderRadius={8} />
            <View style={styles.recipeInfo}>
              <Skeleton width="70%" height={17} borderRadius={4} />
              <Skeleton width={80} height={12} borderRadius={4} />
            </View>
          </View>
          <Skeleton width={72} height={32} borderRadius={16} />
        </View>
      </View>
    </View>
  );
};

export const HomeFeedSkeleton = () => {
  return (
    <View>
      <ActivityCardSkeleton />
      <ActivityCardSkeleton showReviewImage />
      <ActivityCardSkeleton />
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

export const CollectionCardSkeleton = () => {
  return (
    <View style={styles.recipeCard}>
      <Skeleton width={100} height={100} borderRadius={12} />
      <View style={styles.recipeCardContent}>
        <Skeleton width="70%" height={17} borderRadius={4} />
        <Skeleton width={80} height={15} borderRadius={4} />
      </View>
      <Skeleton width={20} height={20} borderRadius={4} />
    </View>
  );
};

export const CollectionsListSkeleton = () => {
  return (
    <View style={styles.collectionsContainer}>
      <CollectionCardSkeleton />
      <CollectionCardSkeleton />
      <CollectionCardSkeleton />
    </View>
  );
};

// ─── Shopping List Skeleton ──────────────────────────────────────────────────

const ShoppingItemSkeleton = () => {
  return (
    <View style={styles.shoppingItem}>
      <Skeleton width={26} height={26} borderRadius={13} />
      <View style={styles.shoppingItemContent}>
        <Skeleton width="60%" height={17} borderRadius={4} />
        <Skeleton width={100} height={13} borderRadius={4} />
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

// ─── Recipe Detail Skeleton ──────────────────────────────────────────────────

const { width: SCREEN_WIDTH } = Dimensions.get("window");
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
        <Skeleton
          width={SCREEN_WIDTH}
          height={IMAGE_HEIGHT}
          borderRadius={0}
        />
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
  skeleton: {
    backgroundColor: theme.colors.border,
  },
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
  userInfo: {
    flex: 1,
    gap: 6,
  },
  userNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  contentCard: {
    backgroundColor: theme.colors.inputBackground,
    borderRadius: theme.borderRadius.large,
    overflow: "hidden",
  },
  reviewImageSkeleton: {
    borderRadius: 0,
  },
  reviewContent: {
    padding: 16,
    gap: 8,
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
  recipeInfo: {
    flex: 1,
    gap: 8,
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
  },

  // Collections styles
  collectionsContainer: {
    gap: 12,
  },

  // Shopping List styles
  shoppingSectionHeader: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  shoppingItem: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 56,
    paddingVertical: 14,
    paddingHorizontal: 20,
    gap: 14,
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
}));
