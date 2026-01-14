import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useCallback } from "react";
import { View, TouchableOpacity } from "react-native";
import Swipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedReaction,
  interpolate,
  interpolateColor,
  Extrapolation,
  type SharedValue,
} from "react-native-reanimated";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { Text } from "@/components/Text";

interface MealSlotProps {
  mealType: "breakfast" | "lunch" | "dinner";
  entry?: {
    id: number;
    recipeId: number;
    recipeName: string;
    recipeImageUrl: string | null;
  };
  onPress: () => void;
  onDelete?: () => void;
  disabled?: boolean;
}

const MEAL_LABELS: Record<string, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
};

const MEAL_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  breakfast: "sunny-outline",
  lunch: "partly-sunny-outline",
  dinner: "moon-outline",
};

const ProgressSyncer = ({
  source,
  target,
}: {
  source: SharedValue<number>;
  target: SharedValue<number>;
}) => {
  useAnimatedReaction(
    () => source.value,
    (value) => {
      target.value = value;
    },
  );
  return null;
};

const DeleteAction = ({
  swipeProgress,
  onDelete,
}: {
  swipeProgress: SharedValue<number>;
  onDelete: () => void;
}) => {
  const deleteButtonStyle = useAnimatedStyle(() => {
    const scale = interpolate(swipeProgress.value, [0.5, 0.7, 1], [0, 0.8, 1], {
      extrapolateLeft: Extrapolation.CLAMP,
      extrapolateRight: Extrapolation.CLAMP,
    });
    return {
      transform: [{ scale }],
      opacity: interpolate(swipeProgress.value, [0.5, 0.6], [0, 1], {
        extrapolateLeft: Extrapolation.CLAMP,
        extrapolateRight: Extrapolation.CLAMP,
      }),
    };
  });

  return (
    <View style={styles.deleteActionContainer}>
      <Animated.View style={deleteButtonStyle}>
        <TouchableOpacity style={styles.deleteActionPill} onPress={onDelete}>
          <Ionicons name="trash" size={20} color="#fff" />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

const SlotContent = ({
  mealType,
  entry,
  onPress,
  swipeProgress,
  disabled,
}: {
  mealType: "breakfast" | "lunch" | "dinner";
  entry: MealSlotProps["entry"];
  onPress: () => void;
  swipeProgress: SharedValue<number>;
  disabled: boolean;
}) => {
  const { theme } = useUnistyles();

  const backgroundStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      swipeProgress.value,
      [0, 1],
      ["transparent", theme.colors.background],
    ),
  }));

  return (
    <TouchableOpacity
      style={styles.slot}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <Animated.View style={[styles.slotInner, backgroundStyle]}>
        {/* Left: Image or Icon container */}
        {entry ? (
          entry.recipeImageUrl ? (
            <Image
              source={{ uri: entry.recipeImageUrl }}
              style={styles.recipeImage}
              contentFit="cover"
            />
          ) : (
            <View style={styles.iconContainer}>
              <Ionicons
                name="restaurant-outline"
                size={20}
                color={theme.colors.textTertiary}
              />
            </View>
          )
        ) : (
          <View style={styles.iconContainer}>
            <Ionicons
              name={MEAL_ICONS[mealType]}
              size={20}
              color={theme.colors.primary}
            />
          </View>
        )}

        {/* Center: Text content */}
        <View style={styles.textContainer}>
          <Text type="caption" style={styles.mealLabel}>
            {MEAL_LABELS[mealType]}
          </Text>
          {entry ? (
            <Text type="body" numberOfLines={1}>
              {entry.recipeName}
            </Text>
          ) : (
            <Text type="bodyFaded">Add recipe</Text>
          )}
        </View>

        {/* Right: Chevron or Add icon */}
        {entry ? (
          <Ionicons
            name="chevron-forward"
            size={20}
            color={theme.colors.textTertiary}
          />
        ) : (
          <Ionicons name="add-circle" size={24} color={theme.colors.primary} />
        )}
      </Animated.View>
    </TouchableOpacity>
  );
};

export const MealSlot = ({
  mealType,
  entry,
  onPress,
  onDelete,
  disabled = false,
}: MealSlotProps) => {
  const swipeProgress = useSharedValue(0);

  const renderRightActions = useCallback(
    (progress: SharedValue<number>) => (
      <>
        <ProgressSyncer source={progress} target={swipeProgress} />
        <DeleteAction swipeProgress={progress} onDelete={() => onDelete?.()} />
      </>
    ),
    [onDelete, swipeProgress],
  );

  // Only make swipeable if there's an entry to delete and deletion is enabled
  if (!entry || !onDelete) {
    return (
      <SlotContent
        mealType={mealType}
        entry={entry}
        onPress={onPress}
        swipeProgress={swipeProgress}
        disabled={disabled}
      />
    );
  }

  return (
    <Swipeable
      renderRightActions={renderRightActions}
      overshootRight
      overshootLeft
      friction={2}
    >
      <SlotContent
        mealType={mealType}
        entry={entry}
        onPress={onPress}
        swipeProgress={swipeProgress}
        disabled={disabled}
      />
    </Swipeable>
  );
};

const styles = StyleSheet.create((theme) => ({
  slot: {
    minHeight: 72,
  },
  slotInner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 16,
  },
  recipeImage: {
    width: 40,
    height: 40,
    borderRadius: 10,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: theme.colors.primary + "15",
    justifyContent: "center",
    alignItems: "center",
  },
  textContainer: {
    flex: 1,
    gap: 2,
  },
  mealLabel: {
    color: theme.colors.textTertiary,
    textTransform: "uppercase",
    fontSize: 10,
    letterSpacing: 0.5,
  },
  deleteActionContainer: {
    justifyContent: "center",
    alignItems: "center",
    paddingRight: 16,
  },
  deleteActionPill: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.destructive,
    justifyContent: "center",
    alignItems: "center",
  },
}));
