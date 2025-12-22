import { Ionicons } from "@expo/vector-icons";
import { memo } from "react";
import { ActivityIndicator } from "react-native";
import Animated, {
  useAnimatedStyle,
  type SharedValue,
} from "react-native-reanimated";
import { StyleSheet } from "react-native-unistyles";

import { VSpace } from "./Space";
import { Text } from "./Text";

type SearchType = "recipes" | "collections" | "users";

interface SearchEmptyStateProps {
  activeTab: SearchType;
  isFetching: boolean;
  shouldFetch: boolean;
  keyboardHeight: SharedValue<number>;
  fixedHeaderHeight: number;
}

export const SearchEmptyState = memo(
  ({
    activeTab,
    isFetching,
    shouldFetch,
    keyboardHeight,
    fixedHeaderHeight,
  }: SearchEmptyStateProps) => {
    const animatedStyle = useAnimatedStyle(() => {
      const keyboardPadding =
        keyboardHeight.value > 0 ? keyboardHeight.value / 2 : 0;
      return {
        paddingBottom: keyboardPadding + fixedHeaderHeight,
      };
    });

    if (isFetching && shouldFetch) {
      const loadingText =
        activeTab === "recipes"
          ? "Searching recipes..."
          : activeTab === "collections"
            ? "Searching collections..."
            : "Searching users...";

      return (
        <Animated.View style={[styles.emptyState, animatedStyle]}>
          <ActivityIndicator size="large" />
          <VSpace size={16} />
          <Text type="bodyFaded">{loadingText}</Text>
        </Animated.View>
      );
    }

    if (!shouldFetch) {
      let icon: "search-outline" | "albums-outline" | "people-outline" =
        "search-outline";
      let title = "Start searching";
      let subtitle = "";

      if (activeTab === "recipes") {
        icon = "search-outline";
        title = "Start searching";
        subtitle =
          "Enter a search term or select a cuisine/category to discover recipes";
      } else if (activeTab === "collections") {
        icon = "albums-outline";
        title = "Search collections";
        subtitle = "Find recipe collections from other users";
      } else {
        icon = "people-outline";
        title = "Search users";
        subtitle = "Find other cooks to follow";
      }

      return (
        <Animated.View style={[styles.emptyState, animatedStyle]}>
          <Ionicons name={icon} size={64} style={styles.emptyIcon} />
          <VSpace size={16} />
          <Text type="heading">{title}</Text>
          <VSpace size={8} />
          <Text type="bodyFaded" style={styles.emptyText}>
            {subtitle}
          </Text>
        </Animated.View>
      );
    }

    let icon: "restaurant-outline" | "albums-outline" | "people-outline" =
      "restaurant-outline";
    let title = "No results found";
    let subtitle = "Try a different search term";

    if (activeTab === "recipes") {
      icon = "restaurant-outline";
      title = "No recipes found";
      subtitle = "Try adjusting your filters or search query";
    } else if (activeTab === "collections") {
      icon = "albums-outline";
      title = "No collections found";
      subtitle = "Try a different search term";
    } else {
      icon = "people-outline";
      title = "No users found";
      subtitle = "Try a different search term";
    }

    return (
      <Animated.View style={[styles.emptyState, animatedStyle]}>
        <Ionicons name={icon} size={64} style={styles.emptyIcon} />
        <VSpace size={16} />
        <Text type="heading">{title}</Text>
        <VSpace size={8} />
        <Text type="bodyFaded" style={styles.emptyText}>
          {subtitle}
        </Text>
      </Animated.View>
    );
  },
);

const styles = StyleSheet.create((theme) => ({
  emptyState: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    alignItems: "center",
  },
  emptyIcon: {
    color: theme.colors.border,
  },
  emptyText: {
    textAlign: "center",
  },
}));
