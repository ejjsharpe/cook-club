import { Ionicons } from "@expo/vector-icons";
import { View, TouchableOpacity } from "react-native";
import { StyleSheet } from "react-native-unistyles";

import { Text } from "./Text";

interface Props {
  onPress: () => void;
  disabled?: boolean;
  variant?: "list" | "grid";
  width?: number;
}

export const CreateCollectionCard = ({
  onPress,
  disabled,
  variant = "list",
  width,
}: Props) => {
  if (variant === "grid") {
    return (
      <TouchableOpacity
        style={[
          styles.gridCard,
          width != null ? { width } : { flex: 1 },
          disabled && styles.cardDisabled,
        ]}
        onPress={onPress}
        activeOpacity={0.7}
        disabled={disabled}
      >
        <View style={styles.gridIconContainer}>
          <View style={styles.gridAddIconCircle}>
            <Ionicons name="add" size={32} style={styles.addIcon} />
          </View>
        </View>
        <View style={styles.gridContent}>
          <Text type="headline" numberOfLines={1}>
            New Collection
          </Text>
          <Text type="caption" style={styles.subtitle}>
            Create new
          </Text>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.card, disabled && styles.cardDisabled]}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={disabled}
    >
      <View style={styles.iconGrid}>
        <View style={styles.addIconContainer}>
          <Ionicons name="add" size={40} style={styles.addIcon} />
        </View>
      </View>

      <View style={styles.content}>
        <Text type="headline">New Collection</Text>
        <Text type="subheadline" style={styles.subtitle}>
          Create a new collection
        </Text>
      </View>

      <Ionicons name="chevron-forward" size={20} style={styles.chevron} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create((theme) => ({
  // List variant styles
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.background,
    // paddingVertical: 12,
    // paddingHorizontal: 20,
    // gap: 14,
  },
  cardDisabled: {
    opacity: 0.5,
  },
  iconGrid: {
    width: 100,
    height: 100,
    borderRadius: theme.borderRadius.medium,
    backgroundColor: theme.colors.inputBackground,
    justifyContent: "center",
    alignItems: "center",
  },
  addIconContainer: {
    width: 60,
    height: 60,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.primary + "20",
    justifyContent: "center",
    alignItems: "center",
  },
  addIcon: {
    color: theme.colors.primary,
  },
  content: {
    flex: 1,
    gap: 4,
  },
  subtitle: {
    color: theme.colors.textSecondary,
  },
  chevron: {
    color: theme.colors.textTertiary,
  },

  // Grid variant styles
  gridCard: {},
  gridIconContainer: {
    aspectRatio: 1,
    borderRadius: theme.borderRadius.medium,
    backgroundColor: theme.colors.inputBackground,
    justifyContent: "center",
    alignItems: "center",
  },
  gridAddIconCircle: {
    width: 56,
    height: 56,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.primary + "20",
    justifyContent: "center",
    alignItems: "center",
  },
  gridContent: {
    paddingTop: 8,
    gap: 2,
  },
}));
