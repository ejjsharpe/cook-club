import { Ionicons } from "@expo/vector-icons";
import { memo } from "react";
import { View, TouchableOpacity } from "react-native";
import { StyleSheet } from "react-native-unistyles";

import { Text } from "./Text";

interface Props {
  onDiscoverPress?: () => void;
}

export const EmptyFeedState = memo(({ onDiscoverPress }: Props) => {
  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Ionicons name="people-outline" size={64} style={styles.icon} />
      </View>
      <Text type="title2" style={styles.title}>
        Your feed is empty
      </Text>
      <Text type="bodyFaded" style={styles.subtitle}>
        Follow friends to see their cooking activity and recipe discoveries
      </Text>
      {onDiscoverPress && (
        <TouchableOpacity
          style={styles.button}
          onPress={onDiscoverPress}
          activeOpacity={0.8}
        >
          <Ionicons name="search" size={20} style={styles.buttonIcon} />
          <Text style={styles.buttonText}>Find people to follow</Text>
        </TouchableOpacity>
      )}
    </View>
  );
});

const styles = StyleSheet.create((theme) => ({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingVertical: 64,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#f5f5f5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  icon: {
    color: theme.colors.border,
  },
  title: {
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
  },
  buttonIcon: {
    color: theme.colors.buttonText,
  },
  buttonText: {
    color: theme.colors.buttonText,
    fontSize: 16,
    fontWeight: "600",
  },
}));
