import { useState } from "react";
import { TextInput, TextInputProps, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";

import { Text } from "./Text";

interface Props extends TextInputProps {
  label?: string;
}

export const Input = ({ label, style, ...props }: Props) => {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={styles.container}>
      {!!label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        style={[styles.input, isFocused && styles.focused, style]}
        placeholderTextColor={styles.placeholder.color}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        {...props}
      />
    </View>
  );
};

const styles = StyleSheet.create((theme) => ({
  container: {
    width: "100%",
  },
  label: {
    marginBottom: 8,
    marginLeft: 16,
    fontSize: 15,
    color: theme.colors.textSecondary,
  },
  input: {
    width: "100%",
    height: 50,
    paddingHorizontal: 20,
    borderRadius: 25,
    backgroundColor: theme.colors.inputBackground,
    fontFamily: theme.fonts.albertRegular,
    fontSize: 17,
    color: theme.colors.text,
  },
  focused: {
    backgroundColor: theme.colors.inputBackgroundFocused,
  },
  placeholder: {
    color: theme.colors.textTertiary,
  },
}));
