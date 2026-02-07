import { TextInput, TextInputProps, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";

import { Text } from "./Text";

interface Props extends TextInputProps {
  label?: string;
  rightElement?: React.ReactNode;
}

export const Input = ({ label, style, rightElement, ...props }: Props) => {
  return (
    <View style={styles.container}>
      {!!label && <Text style={styles.label}>{label}</Text>}
      <View style={styles.inputRow}>
        <TextInput
          style={[styles.input, rightElement ? styles.inputWithRight : undefined, style]}
          placeholderTextColor={styles.placeholder.color}
          {...props}
        />
        {rightElement && (
          <View style={styles.rightElement}>{rightElement}</View>
        )}
      </View>
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
    color: theme.colors.text,
  },
  inputRow: {
    position: "relative",
    width: "100%",
  },
  input: {
    width: "100%",
    height: 50,
    paddingHorizontal: 20,
    borderRadius: 25,
    backgroundColor: theme.colors.inputBackground,
    fontFamily: theme.fonts.regular,
    fontSize: 17,
    color: theme.colors.text,
  },
  inputWithRight: {
    paddingRight: 48,
  },
  rightElement: {
    position: "absolute",
    right: 16,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  placeholder: {
    color: theme.colors.placeholderText,
  },
}));
