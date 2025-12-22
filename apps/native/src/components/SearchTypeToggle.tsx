import { View, TouchableOpacity } from "react-native";
import { StyleSheet } from "react-native-unistyles";

import { Text } from "./Text";

export type SearchType = "recipes" | "collections" | "users";

interface SearchTypeToggleProps {
  value: SearchType;
  onValueChange: (type: SearchType) => void;
}

const options: { value: SearchType; label: string }[] = [
  { value: "recipes", label: "Recipes" },
  { value: "collections", label: "Collections" },
  { value: "users", label: "Users" },
];

export function SearchTypeToggle({
  value,
  onValueChange,
}: SearchTypeToggleProps) {
  return (
    <View style={styles.container}>
      {options.map((option) => (
        <TouchableOpacity
          key={option.value}
          style={[styles.button, value === option.value && styles.buttonActive]}
          onPress={() => onValueChange(option.value)}
        >
          <Text
            type="body"
            style={[styles.text, value === option.value && styles.textActive]}
          >
            {option.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  container: {
    flexDirection: "row",
    borderRadius: 8,
    backgroundColor: theme.colors.border,
    padding: 2,
  },
  button: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: "center",
  },
  buttonActive: {
    backgroundColor: theme.colors.primary,
  },
  text: {
    fontSize: 13,
    color: "#666",
  },
  textActive: {
    color: "#fff",
    fontWeight: "600",
  },
}));
