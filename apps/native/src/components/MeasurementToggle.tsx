import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { Text } from './Text';

import { MeasurementSystem, getMeasurementDisplayName } from '@/lib/measurementPreferences';

interface MeasurementToggleProps {
  value: MeasurementSystem;
  onValueChange: (system: MeasurementSystem) => void;
}

const options: MeasurementSystem[] = ['auto', 'metric', 'imperial'];

export function MeasurementToggle({ value, onValueChange }: MeasurementToggleProps) {
  return (
    <View style={styles.container}>
      <Text type="heading" style={styles.label}>
        Measurements
      </Text>
      <View style={styles.toggleContainer}>
        {options.map((option) => (
          <TouchableOpacity
            key={option}
            style={[styles.toggleButton, value === option && styles.toggleButtonActive]}
            onPress={() => onValueChange(option)}>
            <Text
              type="body"
              style={[styles.toggleText, value === option && styles.toggleTextActive]}>
              {getMeasurementDisplayName(option)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
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
  toggleContainer: {
    flexDirection: 'row',
    borderRadius: 8,
    backgroundColor: theme.colors.border,
    padding: 2,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  toggleButtonActive: {
    backgroundColor: theme.colors.primary,
  },
  toggleText: {
    fontSize: 12,
    color: '#666',
  },
  toggleTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
}));
