import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { View, TouchableOpacity } from "react-native";
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
  onLongPress?: () => void;
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

export const MealSlot = ({
  mealType,
  entry,
  onPress,
  onLongPress,
  disabled = false,
}: MealSlotProps) => {
  const { theme } = useUnistyles();

  if (entry) {
    return (
      <TouchableOpacity
        style={styles.filledSlot}
        onPress={onPress}
        onLongPress={onLongPress}
        disabled={disabled}
        activeOpacity={0.7}
      >
        {entry.recipeImageUrl ? (
          <Image
            source={{ uri: entry.recipeImageUrl }}
            style={styles.recipeImage}
            contentFit="cover"
          />
        ) : (
          <View style={styles.placeholderImage}>
            <Ionicons
              name="restaurant-outline"
              size={20}
              color={theme.colors.textTertiary}
            />
          </View>
        )}
        <View style={styles.recipeInfo}>
          <Text type="caption" style={styles.mealLabel}>
            {MEAL_LABELS[mealType]}
          </Text>
          <Text type="subheadline" numberOfLines={1} style={styles.recipeName}>
            {entry.recipeName}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={styles.emptySlot}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <Ionicons
        name={MEAL_ICONS[mealType]}
        size={18}
        color={theme.colors.textTertiary}
      />
      <Text type="caption" style={styles.emptyLabel}>
        {MEAL_LABELS[mealType]}
      </Text>
      <Ionicons
        name="add"
        size={18}
        color={theme.colors.textTertiary}
        style={styles.addIcon}
      />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create((theme) => ({
  filledSlot: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.inputBackground,
    borderRadius: theme.borderRadius.medium,
    padding: 10,
    gap: 12,
  },
  recipeImage: {
    width: 48,
    height: 48,
    borderRadius: theme.borderRadius.small,
  },
  placeholderImage: {
    width: 48,
    height: 48,
    borderRadius: theme.borderRadius.small,
    backgroundColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  recipeInfo: {
    flex: 1,
    gap: 2,
  },
  mealLabel: {
    color: theme.colors.textTertiary,
    textTransform: "uppercase",
    fontSize: 10,
    letterSpacing: 0.5,
  },
  recipeName: {
    color: theme.colors.text,
  },
  emptySlot: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderStyle: "dashed",
    borderRadius: theme.borderRadius.medium,
    padding: 14,
    gap: 8,
  },
  emptyLabel: {
    flex: 1,
    color: theme.colors.textTertiary,
  },
  addIcon: {
    marginLeft: "auto",
  },
}));
