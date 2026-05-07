import React from "react";
import { View } from "react-native";
import { StyleSheet } from "react-native-unistyles";

import { Text } from "./Text";
import { BaseButton } from "./buttons/BaseButton";

import {
  MeasurementSystem,
  getMeasurementDisplayName,
} from "@/lib/measurementPreferences";

interface MeasurementToggleProps {
  value: MeasurementSystem;
  onValueChange: (system: MeasurementSystem) => void;
}

const options: MeasurementSystem[] = ["auto", "metric", "imperial"];

export function MeasurementToggle({
  value,
  onValueChange,
}: MeasurementToggleProps) {
  return (
    <View style={styles.container}>
      <Text type="heading" style={styles.label}>
        Measurements
      </Text>
      <View style={styles.toggleContainer}>
        {options.map((option) => (
          <BaseButton
            key={option}
            style={[
              styles.toggleButton,
              value === option && styles.toggleButtonActive,
            ]}
            onPress={() => onValueChange(option)}
          >
            <Text
              type="body"
              style={[
                styles.toggleText,
                value === option && styles.toggleTextActive,
              ]}
            >
              {getMeasurementDisplayName(option)}
            </Text>
          </BaseButton>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  container: {
    backgroundColor: theme.colors.inputBackground,
    borderRadius: 24,
    padding: 16,
  },
  label: {
    marginBottom: 12,
    letterSpacing: 0,
  },
  toggleContainer: {
    flexDirection: "row",
    borderRadius: 22,
    backgroundColor: theme.colors.background,
    padding: 4,
  },
  toggleButton: {
    flex: 1,
    minHeight: 40,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  toggleButtonActive: {
    backgroundColor: theme.colors.primary,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 1,
  },
  toggleText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.semiBold,
    letterSpacing: 0,
    textAlign: "center",
  },
  toggleTextActive: {
    color: theme.colors.buttonText,
  },
}));
