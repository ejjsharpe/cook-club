import { View } from "react-native";
import { StyleSheet } from "react-native-unistyles";

import { Text } from "@/components/Text";
import { BackButton } from "@/components/buttons/BackButton";

interface NavigationHeaderProps {
  title: string;
  rightElement?: React.ReactNode;
}

export const NavigationHeader = ({
  title,
  rightElement,
}: NavigationHeaderProps) => {
  return (
    <View style={styles.container}>
      <BackButton />
      <Text type="title2" style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      {rightElement ?? <View style={styles.spacer} />}
    </View>
  );
};

const styles = StyleSheet.create(() => ({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  title: {
    flex: 1,
    textAlign: "center",
    marginHorizontal: 12,
  },
  spacer: {
    width: 44, // Matches BackButton width for visual balance
  },
}));
