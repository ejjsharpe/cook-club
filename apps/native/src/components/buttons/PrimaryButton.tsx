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
      style={[styles.container, disabled && styles.disabled, style]}
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
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: theme.colors.primary,
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    fontSize: 17,
    fontFamily: theme.fonts.albertSemiBold,
    color: theme.colors.buttonText,
  },
}));
