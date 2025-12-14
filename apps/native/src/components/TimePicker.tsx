import React, { useState } from 'react';
import { View, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';

import { VSpace } from './Space';
import { Text } from './Text';
import { PrimaryButton } from './buttons/PrimaryButton';

import { TimeValue, formatTime } from '@/utils/timeUtils';

interface TimePickerProps {
  label: string;
  value: TimeValue;
  onValueChange: (time: TimeValue) => void;
  placeholder?: string;
}

export function TimePicker({
  label,
  value,
  onValueChange,
  placeholder = 'Tap to set',
}: TimePickerProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [tempHours, setTempHours] = useState(value.hours);
  const [tempMinutes, setTempMinutes] = useState(value.minutes);

  const displayText = formatTime(value) || placeholder;

  const handleOpen = () => {
    setTempHours(value.hours);
    setTempMinutes(value.minutes);
    setIsVisible(true);
  };

  const handleConfirm = () => {
    onValueChange({ hours: tempHours, minutes: tempMinutes });
    setIsVisible(false);
  };

  const handleCancel = () => {
    setTempHours(value.hours);
    setTempMinutes(value.minutes);
    setIsVisible(false);
  };

  // Generate hour options (0-23)
  const hourOptions = Array.from({ length: 24 }, (_, i) => i);

  // Generate minute options (0, 5, 10, 15, ..., 55)
  const minuteOptions = Array.from({ length: 12 }, (_, i) => i * 5);

  return (
    <View style={styles.container}>
      <Text type="heading" style={styles.label}>
        {label}
      </Text>
      <TouchableOpacity style={styles.picker} onPress={handleOpen}>
        <Text type="body" style={[styles.pickerText, !formatTime(value) && styles.placeholderText]}>
          {displayText}
        </Text>
        <Text style={styles.arrow}>⌄</Text>
      </TouchableOpacity>

      <Modal
        visible={isVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleCancel}>
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
                contentContainerStyle={styles.scrollContent}>
                {hourOptions.map((hour) => (
                  <TouchableOpacity
                    key={hour}
                    style={[styles.option, tempHours === hour && styles.selectedOption]}
                    onPress={() => setTempHours(hour)}>
                    <Text
                      type="body"
                      style={[styles.optionText, tempHours === hour && styles.selectedOptionText]}>
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
                contentContainerStyle={styles.scrollContent}>
                {minuteOptions.map((minute) => (
                  <TouchableOpacity
                    key={minute}
                    style={[styles.option, tempMinutes === minute && styles.selectedOption]}
                    onPress={() => setTempMinutes(minute)}>
                    <Text
                      type="body"
                      style={[
                        styles.optionText,
                        tempMinutes === minute && styles.selectedOptionText,
                      ]}>
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
              {formatTime({ hours: tempHours, minutes: tempMinutes }) || 'No time set'}
            </Text>
          </View>

          <VSpace size={20} />

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={styles.clearButton}
              onPress={() => {
                setTempHours(0);
                setTempMinutes(0);
              }}>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    color: '#999',
  },
  arrow: {
    fontSize: 16,
    color: '#666',
  },
  modal: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  pickerContainer: {
    flexDirection: 'row',
    flex: 1,
    paddingHorizontal: 20,
  },
  pickerColumn: {
    flex: 1,
    marginHorizontal: 10,
  },
  columnTitle: {
    textAlign: 'center',
    marginBottom: 16,
    color: '#666',
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
    alignItems: 'center',
  },
  selectedOption: {
    backgroundColor: theme.colors.primary,
  },
  optionText: {
    fontSize: 18,
    textAlign: 'center',
  },
  selectedOptionText: {
    color: '#fff',
    fontWeight: '600',
  },
  previewContainer: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  previewLabel: {
    color: '#666',
    marginBottom: 8,
  },
  previewText: {
    textAlign: 'center',
  },
  modalActions: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 12,
  },
  clearButton: {
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
  },
  clearButtonText: {
    color: '#666',
  },
}));
