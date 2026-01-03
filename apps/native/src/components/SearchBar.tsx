import { Ionicons } from "@expo/vector-icons";
import { useRef, useEffect } from "react";
import { View, TextInput, TouchableOpacity } from "react-native";
import { StyleSheet } from "react-native-unistyles";

export const SEARCH_BAR_HEIGHT = 50;

interface Props {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onFocus?: () => void;
  onBlur?: () => void;
  autoFocus?: boolean;
}

export const SearchBar = ({
  value,
  onChangeText,
  placeholder = "Search recipes, collections, users...",
  onFocus,
  onBlur,
  autoFocus = false,
}: Props) => {
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      // Small delay to ensure the component is fully mounted
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [autoFocus]);

  return (
    <View style={styles.container}>
      <Ionicons name="search" size={20} style={styles.searchIcon} />
      <TextInput
        ref={inputRef}
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={styles.placeholder.color}
        autoCapitalize="none"
        autoCorrect={false}
        onFocus={onFocus}
        onBlur={onBlur}
      />
      {value.length > 0 && (
        <TouchableOpacity
          onPress={() => onChangeText("")}
          style={styles.clearButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close-circle" size={18} style={styles.clearIcon} />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create((theme) => ({
  container: {
    flexDirection: "row",
    alignItems: "center",
    height: SEARCH_BAR_HEIGHT,
    backgroundColor: theme.colors.inputBackground,
    borderRadius: SEARCH_BAR_HEIGHT / 2,
    paddingHorizontal: 16,
  },
  searchIcon: {
    marginRight: 10,
    color: theme.colors.textTertiary,
  },
  input: {
    flex: 1,
    fontSize: 17,
    color: theme.colors.text,
    fontFamily: theme.fonts.albertRegular,
  },
  placeholder: {
    color: theme.colors.textTertiary,
  },
  clearButton: {
    marginLeft: 8,
  },
  clearIcon: {
    color: theme.colors.textTertiary,
  },
}));
