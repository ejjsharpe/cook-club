import { View } from "react-native";
import { StyleSheet } from "react-native-unistyles";

import { Text } from "@/components/Text";

interface NotificationBadgeProps {
  count: number;
}

export const NotificationBadge = ({ count }: NotificationBadgeProps) => {
  if (count <= 0) {
    return null;
  }

  const displayCount = count > 99 ? "99+" : count.toString();

  return (
    <View style={styles.badge}>
      <Text type="caption" style={styles.badgeText}>
        {displayCount}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create((theme) => ({
  badge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: theme.colors.destructive,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "600",
  },
}));
