import { useState, useMemo, useRef } from "react";
import { View, TextInput, TouchableOpacity } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { Ionicons } from "@expo/vector-icons";

import { Text } from "./Text";
import { VSpace } from "./Space";
import { useAllTags } from "@/api/recipe";

interface Tag {
  id: number;
  name: string;
  type: string;
}

interface Props {
  tagType: string;
  selectedIds: number[];
  onToggle: (tagId: number) => void;
  placeholder?: string;
  variant?: "default" | "like" | "dislike";
  excludeIds?: number[]; // IDs to exclude from dropdown (e.g., items already in opposite list)
}

export const AutocompleteTagSelector = ({
  tagType,
  selectedIds,
  onToggle,
  placeholder = "Search...",
  variant = "default",
  excludeIds = [],
}: Props) => {
  const [searchText, setSearchText] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const { data: allTags = [] } = useAllTags({ type: tagType });

  // Filter tags based on search text
  const filteredTags = useMemo(() => {
    if (!searchText.trim()) return [];
    const searchLower = searchText.toLowerCase();
    return allTags
      .filter(
        (tag) =>
          tag.name.toLowerCase().includes(searchLower) &&
          !selectedIds.includes(tag.id) &&
          !excludeIds.includes(tag.id)
      )
      .slice(0, 5); // Limit dropdown to 5 items
  }, [searchText, allTags, selectedIds, excludeIds]);

  // Get selected tags for display
  const selectedTags = useMemo(() => {
    return allTags.filter((tag) => selectedIds.includes(tag.id));
  }, [allTags, selectedIds]);

  const handleSelectTag = (tag: Tag) => {
    onToggle(tag.id);
    setSearchText("");
    // Keep focus on input so user can continue typing
    inputRef.current?.focus();
  };

  const handleRemoveTag = (tagId: number) => {
    onToggle(tagId);
  };

  const showDropdown = isFocused && filteredTags.length > 0;

  // Variant-specific colors
  const chipStyle =
    variant === "like"
      ? styles.chipLike
      : variant === "dislike"
        ? styles.chipDislike
        : styles.chipDefault;

  const chipTextStyle =
    variant === "like"
      ? styles.chipTextLike
      : variant === "dislike"
        ? styles.chipTextDislike
        : styles.chipTextDefault;

  return (
    <View style={styles.container}>
      {/* Search Input */}
      <View style={styles.inputWrapper}>
        <Ionicons
          name="search"
          size={18}
          color="#999"
          style={styles.searchIcon}
        />
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={searchText}
          onChangeText={setSearchText}
          placeholder={placeholder}
          placeholderTextColor="#999"
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 150)}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searchText.length > 0 && (
          <TouchableOpacity
            onPress={() => setSearchText("")}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close-circle" size={18} color="#999" />
          </TouchableOpacity>
        )}
      </View>

      {/* Dropdown */}
      {showDropdown && (
        <View style={styles.dropdown}>
          {filteredTags.map((tag) => (
            <TouchableOpacity
              key={tag.id}
              style={styles.dropdownItem}
              onPress={() => handleSelectTag(tag)}
              activeOpacity={0.7}
            >
              <Text style={styles.dropdownText}>{tag.name}</Text>
              <Ionicons name="add-circle-outline" size={20} color="#999" />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Selected Chips */}
      {selectedTags.length > 0 && (
        <>
          <VSpace size={12} />
          <View style={styles.chipsContainer}>
            {selectedTags.map((tag) => (
              <TouchableOpacity
                key={tag.id}
                style={[styles.chip, chipStyle]}
                onPress={() => handleRemoveTag(tag.id)}
                activeOpacity={0.7}
              >
                <Text style={[styles.chipText, chipTextStyle]}>{tag.name}</Text>
                <Ionicons
                  name="close"
                  size={14}
                  color={variant === "default" ? "#666" : "#fff"}
                  style={styles.chipIcon}
                />
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create((theme) => ({
  container: {
    width: "100%",
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    borderRadius: theme.borderRadius.extraLarge,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontFamily: theme.fonts.albertRegular,
    color: theme.colors.text,
  },
  dropdown: {
    marginTop: 4,
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.medium,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: "hidden",
  },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  dropdownText: {
    fontSize: 16,
    fontFamily: theme.fonts.albertRegular,
    color: theme.colors.text,
  },
  chipsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.full,
  },
  chipDefault: {
    backgroundColor: "#f0f0f0",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  chipLike: {
    backgroundColor: "#22c55e",
  },
  chipDislike: {
    backgroundColor: "#ef4444",
  },
  chipText: {
    fontSize: 14,
    fontFamily: theme.fonts.albertMedium,
  },
  chipTextDefault: {
    color: theme.colors.text,
  },
  chipTextLike: {
    color: "#fff",
  },
  chipTextDislike: {
    color: "#fff",
  },
  chipIcon: {
    marginLeft: 6,
  },
}));
