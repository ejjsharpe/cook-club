import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, type RefObject } from "react";
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
  ref?: RefObject<TextInput | null>;
}

export function SearchBar({
  value,
  onChangeText,
  placeholder = "Search recipes, collections, users...",
  onFocus,
  onBlur,
  autoFocus = false,
  ref,
}: Props) {
  const internalRef = useRef<TextInput>(null);
  const inputRef = ref ?? internalRef;

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus, inputRef]);

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
}

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
    color: theme.colors.placeholderText,
  },
  clearButton: {
    marginLeft: 8,
  },
  clearIcon: {
    color: theme.colors.textTertiary,
  },
}));
