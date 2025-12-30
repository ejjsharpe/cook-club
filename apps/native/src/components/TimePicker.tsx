import React, { useState } from "react";
import { View, TouchableOpacity, Modal, ScrollView } from "react-native";
import { SafeAreaView } from "@/components/SafeAreaView";
import { StyleSheet } from "react-native-unistyles";

import { VSpace } from "./Space";
import { Text } from "./Text";
import { PrimaryButton } from "./buttons/PrimaryButton";

import {
  formatMinutes,
  fromTotalMinutes,
  getTotalMinutes,
} from "@/utils/timeUtils";

interface TimePickerProps {
  label: string;
  value: number | null; // minutes
  onValueChange: (minutes: number | null) => void;
  placeholder?: string;
}

export function TimePicker({
  label,
  value,
  onValueChange,
  placeholder = "Tap to set",
}: TimePickerProps) {
  const [isVisible, setIsVisible] = useState(false);
  const timeValue = value ? fromTotalMinutes(value) : { hours: 0, minutes: 0 };
  const [tempHours, setTempHours] = useState(timeValue.hours);
  const [tempMinutes, setTempMinutes] = useState(timeValue.minutes);

  const displayText = formatMinutes(value) || placeholder;

  const handleOpen = () => {
    const tv = value ? fromTotalMinutes(value) : { hours: 0, minutes: 0 };
    setTempHours(tv.hours);
    setTempMinutes(tv.minutes);
    setIsVisible(true);
  };

  const handleConfirm = () => {
    const totalMinutes = getTotalMinutes({
      hours: tempHours,
      minutes: tempMinutes,
    });
    onValueChange(totalMinutes > 0 ? totalMinutes : null);
    setIsVisible(false);
  };

  const handleCancel = () => {
    const tv = value ? fromTotalMinutes(value) : { hours: 0, minutes: 0 };
    setTempHours(tv.hours);
    setTempMinutes(tv.minutes);
    setIsVisible(false);
  };

  const handleClear = () => {
    setTempHours(0);
    setTempMinutes(0);
  };

  // Generate hour options (0-23)
  const hourOptions = Array.from({ length: 24 }, (_, i) => i);

  // Generate minute options (0, 5, 10, 15, ..., 55)
  const minuteOptions = Array.from({ length: 12 }, (_, i) => i * 5);

  const previewMinutes = getTotalMinutes({
    hours: tempHours,
    minutes: tempMinutes,
  });

  return (
    <View style={styles.container}>
      <Text type="heading" style={styles.label}>
        {label}
      </Text>
      <TouchableOpacity style={styles.picker} onPress={handleOpen}>
        <Text
          type="body"
          style={[styles.pickerText, !value && styles.placeholderText]}
        >
          {displayText}
        </Text>
        <Text style={styles.arrow}>⌄</Text>
      </TouchableOpacity>

      <Modal
        visible={isVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleCancel}
      >
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={handleCancel}>
              <Text type="highlight">Cancel</Text>
            </TouchableOpacity>
            <Text type="title2">{label}</Text>
            <TouchableOpacity onPress={handleConfirm}>
              <Text type="highlight">Done</Text>
            </TouchableOpacity>
          </View>

          <VSpace size={20} />

          <View style={styles.pickerContainer}>
            {/* Hours Column */}
            <View style={styles.pickerColumn}>
              <Text type="heading" style={styles.columnTitle}>
                Hours
              </Text>
              <ScrollView
                style={styles.scrollView}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
              >
                {hourOptions.map((hour) => (
                  <TouchableOpacity
                    key={hour}
                    style={[
                      styles.option,
                      tempHours === hour && styles.selectedOption,
                    ]}
                    onPress={() => setTempHours(hour)}
                  >
                    <Text
                      type="body"
                      style={[
                        styles.optionText,
                        tempHours === hour && styles.selectedOptionText,
                      ]}
                    >
                      {hour}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Minutes Column */}
            <View style={styles.pickerColumn}>
              <Text type="heading" style={styles.columnTitle}>
                Minutes
              </Text>
              <ScrollView
                style={styles.scrollView}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
              >
                {minuteOptions.map((minute) => (
                  <TouchableOpacity
                    key={minute}
                    style={[
                      styles.option,
                      tempMinutes === minute && styles.selectedOption,
                    ]}
                    onPress={() => setTempMinutes(minute)}
                  >
                    <Text
                      type="body"
                      style={[
                        styles.optionText,
                        tempMinutes === minute && styles.selectedOptionText,
                      ]}
                    >
                      {minute}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>

          <VSpace size={20} />

          <View style={styles.previewContainer}>
            <Text type="body" style={styles.previewLabel}>
              Preview:
            </Text>
            <Text type="title2" style={styles.previewText}>
              {formatMinutes(previewMinutes) || "No time set"}
            </Text>
          </View>

          <VSpace size={20} />

          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.clearButton} onPress={handleClear}>
              <Text type="body" style={styles.clearButtonText}>
                Clear
              </Text>
            </TouchableOpacity>
            <PrimaryButton onPress={handleConfirm}>Set Time</PrimaryButton>
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  container: {
    marginVertical: 8,
  },
  label: {
    marginBottom: 8,
  },
  picker: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 16,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    minHeight: 50,
  },
  pickerText: {
    flex: 1,
  },
  placeholderText: {
    color: "#999",
  },
  arrow: {
    fontSize: 16,
    color: "#666",
  },
  modal: {
    flex: 1,
    backgroundColor: "#fff",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  pickerContainer: {
    flexDirection: "row",
    flex: 1,
    paddingHorizontal: 20,
  },
  pickerColumn: {
    flex: 1,
    marginHorizontal: 10,
  },
  columnTitle: {
    textAlign: "center",
    marginBottom: 16,
    color: "#666",
  },
  scrollView: {
    flex: 1,
    maxHeight: 300,
  },
  scrollContent: {
    paddingVertical: 20,
  },
  option: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginVertical: 2,
    alignItems: "center",
  },
  selectedOption: {
    backgroundColor: theme.colors.primary,
  },
  optionText: {
    fontSize: 18,
    textAlign: "center",
  },
  selectedOptionText: {
    color: "#fff",
    fontWeight: "600",
  },
  previewContainer: {
    alignItems: "center",
    paddingHorizontal: 20,
  },
  previewLabel: {
    color: "#666",
    marginBottom: 8,
  },
  previewText: {
    textAlign: "center",
  },
  modalActions: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 12,
  },
  clearButton: {
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
  },
  clearButtonText: {
    color: "#666",
  },
}));
