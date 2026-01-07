import { Ionicons } from "@expo/vector-icons";
import { useState, useEffect } from "react";
import { View, TouchableOpacity } from "react-native";
import ActionSheet, {
  SheetManager,
  SheetProps,
  ScrollView,
} from "react-native-actions-sheet";
import { StyleSheet } from "react-native-unistyles";

import { VSpace } from "./Space";
import { TagChip } from "./TagChip";
import { Text } from "./Text";

interface Tag {
  id: number;
  name: string;
  type: string;
  count?: number;
}

interface FilterSheetPayload {
  selectedTagIds: number[];
  onTagsChange: (tagIds: number[]) => void;
  maxTotalTime?: string;
  onTimeChange: (time: string | undefined) => void;
  allTags?: Tag[];
}

const TIME_OPTIONS = [
  { label: "15 min", value: "15" },
  { label: "30 min", value: "30" },
  { label: "1 hour", value: "60" },
  { label: "2+ hours", value: "120" },
];

export const FilterSheet = (props: SheetProps<"filter-sheet">) => {
  const {
    selectedTagIds: initialSelectedTagIds = [],
    onTagsChange = () => {},
    maxTotalTime: initialMaxTotalTime,
    onTimeChange = () => {},
    allTags = [],
  } = props.payload || {};

  // Local state for immediate UI updates
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>(
    initialSelectedTagIds,
  );
  const [maxTotalTime, setMaxTotalTime] = useState<string | undefined>(
    initialMaxTotalTime,
  );

  // Sync local state with props when sheet opens
  useEffect(() => {
    setSelectedTagIds(initialSelectedTagIds);
    setMaxTotalTime(initialMaxTotalTime);
  }, [initialSelectedTagIds, initialMaxTotalTime]);

  const handleTagToggle = (tagId: number) => {
    if (selectedTagIds.includes(tagId)) {
      setSelectedTagIds(selectedTagIds.filter((id) => id !== tagId));
    } else {
      setSelectedTagIds([...selectedTagIds, tagId]);
    }
  };

  const handleTimeToggle = (time: string) => {
    setMaxTotalTime(maxTotalTime === time ? undefined : time);
  };

  const handleClear = () => {
    setSelectedTagIds([]);
    setMaxTotalTime(undefined);
  };

  const handleApply = () => {
    onTagsChange(selectedTagIds);
    onTimeChange(maxTotalTime);
    SheetManager.hide("filter-sheet");
  };

  return (
    <ActionSheet
      id={props.sheetId}
      snapPoints={[100]}
      initialSnapIndex={0}
      gestureEnabled
      enableGesturesInScrollView={false}
      indicatorStyle={styles.indicator}
    >
      <View>
        {/* Header */}
        <View style={styles.header}>
          <Text type="title2">Filters</Text>
          <TouchableOpacity onPress={() => SheetManager.hide("filter-sheet")}>
            <Ionicons name="close" size={28} style={styles.closeIcon} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scrollView}>
          <View style={styles.scrollContent}>
            {/* Time Filter Section */}
            <Text type="heading" style={styles.sectionTitle}>
              Max cooking time
            </Text>
            <VSpace size={12} />
            <View style={styles.chipGrid}>
              {TIME_OPTIONS.map((option) => (
                <TagChip
                  key={option.value}
                  label={option.label}
                  selected={maxTotalTime === option.value}
                  onPress={() => handleTimeToggle(option.value)}
                  size="medium"
                />
              ))}
            </View>
            <VSpace size={24} />

            {/* All Tags Section (if provided) */}
            {allTags.length > 0 && (
              <>
                <Text type="heading" style={styles.sectionTitle}>
                  All categories
                </Text>
                <VSpace size={12} />
                <View style={styles.chipGrid}>
                  {allTags.map((tag) => (
                    <TagChip
                      key={tag.id}
                      label={tag.name}
                      selected={selectedTagIds.includes(tag.id)}
                      onPress={() => handleTagToggle(tag.id)}
                      size="medium"
                    />
                  ))}
                </View>
                <VSpace size={24} />
              </>
            )}
          </View>
        </ScrollView>

        {/* Action Buttons */}
        <View style={styles.footer}>
          <TouchableOpacity style={styles.clearButton} onPress={handleClear}>
            <Text type="bodyFaded">Clear all</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.applyButton} onPress={handleApply}>
            <Text type="highlight" style={styles.applyButtonText}>
              Apply filters
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </ActionSheet>
  );
};

const styles = StyleSheet.create((theme) => ({
  indicator: {
    backgroundColor: theme.colors.border,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  closeIcon: {
    color: theme.colors.text,
  },
  scrollView: {
    maxHeight: 500,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
  },
  sectionTitle: {
    marginBottom: 4,
  },
  chipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  clearButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  applyButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: theme.borderRadius.medium,
  },
  applyButtonText: {
    color: theme.colors.buttonText,
  },
}));
