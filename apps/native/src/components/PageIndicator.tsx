import { View } from "react-native";
import { StyleSheet } from "react-native-unistyles";

import { Text } from "./Text";

interface PageIndicatorProps {
  currentPage: number;
  totalPages: number;
}

export const PageIndicator = ({
  currentPage,
  totalPages,
}: PageIndicatorProps) => {
  if (totalPages <= 1) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.text}>
        {currentPage} / {totalPages}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create(() => ({
  container: {
    position: "absolute",
    bottom: 16,
    right: 16,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  text: {
    color: "white",
    fontSize: 13,
    fontWeight: "500",
  },
}));
