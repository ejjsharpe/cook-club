import { Ionicons } from "@expo/vector-icons";
import { memo } from "react";
import { View } from "react-native";
import { StyleSheet } from "react-native-unistyles";

import { SEARCH_BAR_HEIGHT } from "./SearchBar";
import { VSpace } from "./Space";
import { Text } from "./Text";
import { BaseButton } from "./buttons/BaseButton";

const TAB_BAR_HEIGHT = 80; // Approximate native tab bar height

// Header height: VSpace(8) + HeaderRow(44) + VSpace(20) + SearchBar + VSpace(16)
const HEADER_HEIGHT = 8 + 44 + 20 + SEARCH_BAR_HEIGHT + 16;

interface Props {
  onDiscoverPress?: () => void;
}

export const EmptyFeedState = memo(({ onDiscoverPress }: Props) => {
  return (
    <View style={styles.container}>
      <Ionicons name="people-outline" size={56} style={styles.icon} />
      <VSpace size={20} />
      <Text type="title2" style={styles.title}>
        Your feed is empty
      </Text>
      <VSpace size={8} />
      <Text type="bodyFaded" style={styles.subtitle}>
        Follow friends to see their cooking activity
      </Text>
      {onDiscoverPress && (
        <>
          <VSpace size={24} />
          <BaseButton onPress={onDiscoverPress} style={styles.button}>
            <Text style={styles.buttonText}>Find people to follow</Text>
          </BaseButton>
        </>
      )}
    </View>
  );
});

const styles = StyleSheet.create((theme, rt) => ({
  container: {
    // Use minHeight instead of flex: 1 to prevent layout jump on initial render
    minHeight:
      rt.screen.height -
      rt.insets.top -
      HEADER_HEIGHT -
      TAB_BAR_HEIGHT -
      rt.insets.bottom,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
  },
  icon: {
    color: theme.colors.border,
  },
  title: {
    textAlign: "center",
  },
  subtitle: {
    textAlign: "center",
    lineHeight: 24,
  },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    backgroundColor: theme.colors.primary,
    borderRadius: 100,
  },
  buttonText: {
    color: theme.colors.buttonText,
    fontSize: 16,
    fontWeight: "600",
  },
}));
