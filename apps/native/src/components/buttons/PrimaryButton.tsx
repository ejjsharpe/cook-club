import { ViewStyle } from "react-native";
import { StyleSheet } from "react-native-unistyles";

import { BaseButton } from "./BaseButton";
import { Text } from "../Text";

export interface ButtonProps {
  children: string;
  onPress: () => void;
  disabled?: boolean;
  style?: ViewStyle | ViewStyle[];
}

export function PrimaryButton({
  children,
  onPress,
  disabled,
  style,
}: ButtonProps) {
  return (
    <BaseButton
      style={[styles.container, style]}
      disabled={disabled}
      onPress={onPress}
    >
      <Text style={styles.text}>{children}</Text>
    </BaseButton>
  );
}

const styles = StyleSheet.create((theme) => ({
  container: {
    width: "100%",
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
    backgroundColor: theme.colors.primary,
  },
  text: {
    fontSize: 16,
    color: theme.colors.buttonText,
  },
}));
