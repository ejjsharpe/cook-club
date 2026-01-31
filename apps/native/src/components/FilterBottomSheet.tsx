import { Ionicons } from "@expo/vector-icons";
import { TrueSheet } from "@lodev09/react-native-true-sheet";
import {
  forwardRef,
  useState,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import { View, TouchableOpacity, ScrollView } from "react-native";
import { StyleSheet, UnistylesRuntime } from "react-native-unistyles";

import { VSpace } from "./Space";
import { TagChip } from "./TagChip";
import { Text } from "./Text";

const TIME_OPTIONS = [
  { label: "15 min", value: "15" },
  { label: "30 min", value: "30" },
  { label: "1 hour", value: "60" },
  { label: "2+ hours", value: "120" },
];

interface Tag {
  id: number;
  name: string;
}

export interface FilterSheetProps {
  selectedTagIds?: number[];
  onTagsChange?: (tagIds: number[]) => void;
  maxTotalTime?: string;
  onTimeChange?: (time: string | undefined) => void;
  allTags?: Tag[];
}

export interface FilterSheetRef {
  present: () => void;
  dismiss: () => void;
}

export const FilterSheet = forwardRef<FilterSheetRef, FilterSheetProps>(
  (
    {
      selectedTagIds: initialSelectedTagIds = [],
      onTagsChange = () => {},
      maxTotalTime: initialMaxTotalTime,
      onTimeChange = () => {},
      allTags = [],
    },
    ref,
  ) => {
    const theme = UnistylesRuntime.getTheme();
    const sheetRef = useRef<TrueSheet>(null);

    // Local state for immediate UI updates
    const [selectedTagIds, setSelectedTagIds] = useState<number[]>(
      initialSelectedTagIds,
    );
    const [maxTotalTime, setMaxTotalTime] = useState<string | undefined>(
      initialMaxTotalTime,
    );

    useImperativeHandle(ref, () => ({
      present: () => sheetRef.current?.present(),
      dismiss: () => sheetRef.current?.dismiss(),
    }));

    // Sync local state with props when sheet opens
    useEffect(() => {
      setSelectedTagIds(initialSelectedTagIds);
      setMaxTotalTime(initialMaxTotalTime);
    }, [initialSelectedTagIds, initialMaxTotalTime]);

    const handleDismiss = () => {
      sheetRef.current?.dismiss();
    };

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
      handleDismiss();
    };

    return (
      <TrueSheet
        ref={sheetRef}
        detents={["auto"]}
        grabber={false}
        backgroundColor={theme.colors.background}
      >
        <View>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerSpacer} />
            <Text type="headline">Filters</Text>
            <TouchableOpacity onPress={handleDismiss} style={styles.closeButton}>
              <View style={styles.closeButtonCircle}>
                <Ionicons name="close" size={16} style={styles.closeIcon} />
              </View>
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
      </TrueSheet>
    );
  },
);

const styles = StyleSheet.create((theme) => ({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerSpacer: {
    width: 30,
  },
  closeButton: {
    padding: 4,
  },
  closeButtonCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: theme.colors.inputBackground,
    justifyContent: "center",
    alignItems: "center",
  },
  closeIcon: {
    color: theme.colors.textSecondary,
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
