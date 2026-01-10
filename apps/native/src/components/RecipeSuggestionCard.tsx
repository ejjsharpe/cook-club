import { Ionicons } from "@expo/vector-icons";
import { View, TouchableOpacity } from "react-native";
import { StyleSheet } from "react-native-unistyles";

import { Text } from "./Text";

import type { RecipeSuggestion } from "@/api/fridgeSnap";

interface Props {
  suggestion: RecipeSuggestion;
  onSelect: () => void;
  selected?: boolean;
}

const difficultyConfig = {
  easy: { label: "Easy", color: "#22c55e" },
  medium: { label: "Medium", color: "#f59e0b" },
  hard: { label: "Hard", color: "#ef4444" },
};

export const RecipeSuggestionCard = ({
  suggestion,
  onSelect,
  selected = false,
}: Props) => {
  const difficulty = difficultyConfig[suggestion.difficulty];

  return (
    <TouchableOpacity
      style={[styles.card, selected && styles.cardSelected]}
      onPress={onSelect}
      activeOpacity={0.7}
    >
      <View style={styles.header}>
        <Text type="headline" style={styles.name} numberOfLines={2}>
          {suggestion.name}
        </Text>
        {selected && (
          <Ionicons
            name="checkmark-circle"
            size={24}
            style={styles.checkIcon}
          />
        )}
      </View>

      <Text type="subheadline" style={styles.description} numberOfLines={2}>
        {suggestion.description}
      </Text>

      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <Ionicons name="time-outline" size={14} style={styles.metaIcon} />
          <Text type="caption" style={styles.metaText}>
            {suggestion.estimatedTime} min
          </Text>
        </View>

        <View
          style={[
            styles.difficultyBadge,
            { backgroundColor: difficulty.color },
          ]}
        >
          <Text type="caption" style={styles.difficultyText}>
            {difficulty.label}
          </Text>
        </View>
      </View>

      <View style={styles.ingredientSection}>
        <Text type="caption" style={styles.ingredientLabel}>
          Uses:
        </Text>
        <Text type="caption" style={styles.ingredientList} numberOfLines={1}>
          {suggestion.matchedIngredients.join(", ")}
        </Text>
      </View>

      {suggestion.additionalIngredients.length > 0 && (
        <View style={styles.ingredientSection}>
          <Text type="caption" style={styles.ingredientLabelSecondary}>
            Also needs:
          </Text>
          <Text
            type="caption"
            style={styles.ingredientListSecondary}
            numberOfLines={1}
          >
            {suggestion.additionalIngredients.join(", ")}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create((theme) => ({
  card: {
    backgroundColor: theme.colors.inputBackground,
    borderRadius: theme.borderRadius.large,
    padding: 16,
    gap: 8,
    borderWidth: 2,
    borderColor: "transparent",
  },
  cardSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary + "10",
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  name: {
    flex: 1,
  },
  checkIcon: {
    color: theme.colors.primary,
  },
  description: {
    color: theme.colors.textSecondary,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 4,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaIcon: {
    color: theme.colors.textSecondary,
  },
  metaText: {
    color: theme.colors.textSecondary,
  },
  difficultyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.full,
  },
  difficultyText: {
    color: "white",
    fontWeight: "600",
  },
  ingredientSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  ingredientLabel: {
    color: theme.colors.primary,
    fontWeight: "600",
  },
  ingredientList: {
    flex: 1,
    color: theme.colors.text,
  },
  ingredientLabelSecondary: {
    color: theme.colors.textTertiary,
    fontWeight: "600",
  },
  ingredientListSecondary: {
    flex: 1,
    color: theme.colors.textSecondary,
  },
}));
