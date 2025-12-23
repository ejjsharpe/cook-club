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
  label: { marginBottom: 8, marginLeft: 4 },
  input: {
    width: "100%",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: theme.borderRadius.extraLarge,
    backgroundColor: "#f5f5f5",
    justifyContent: "center",
    fontFamily: theme.fonts.albertRegular,
    fontSize: 16,
  },
  focused: {
    backgroundColor: "#efefef",
  },
}));
