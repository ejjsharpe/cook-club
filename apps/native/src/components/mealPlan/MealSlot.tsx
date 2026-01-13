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

  return (
    <TouchableOpacity
      style={styles.slot}
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
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
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create((theme) => ({
  slot: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 16,
    minHeight: 72,
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
}));
