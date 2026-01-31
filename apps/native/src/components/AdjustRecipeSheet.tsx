import { Ionicons } from "@expo/vector-icons";
import { TrueSheet } from "@lodev09/react-native-true-sheet";
import { forwardRef, useState, useImperativeHandle, useRef } from "react";
import { View, TouchableOpacity } from "react-native";
import { StyleSheet } from "react-native-unistyles";

import { MeasurementToggle } from "./MeasurementToggle";
import { VSpace } from "./Space";
import { Text } from "./Text";

import {
  getMeasurementPreference,
  setMeasurementPreference,
  MeasurementSystem,
} from "@/lib/measurementPreferences";

export interface AdjustRecipeSheetProps {
  servings: number;
  onServingsChange: (servings: number) => void;
}

export interface AdjustRecipeSheetRef {
  present: () => void;
  dismiss: () => void;
}

export const AdjustRecipeSheet = forwardRef<
  AdjustRecipeSheetRef,
  AdjustRecipeSheetProps
>(({ servings, onServingsChange }, ref) => {
  const sheetRef = useRef<TrueSheet>(null);
  const [measurementSystem, setMeasurementSystemState] =
    useState<MeasurementSystem>(getMeasurementPreference());

  useImperativeHandle(ref, () => ({
    present: () => sheetRef.current?.present(),
    dismiss: () => sheetRef.current?.dismiss(),
  }));

  const handleMeasurementChange = (system: MeasurementSystem) => {
    setMeasurementPreference(system);
    setMeasurementSystemState(system);
  };

  const handleDecrement = () => {
    if (servings && servings > 1) {
      onServingsChange?.(servings - 1);
    }
  };

  const handleIncrement = () => {
    if (servings) {
      onServingsChange?.(servings + 1);
    }
  };

  const handleDismiss = () => {
    sheetRef.current?.dismiss();
  };

  return (
    <TrueSheet ref={sheetRef} detents={["auto"]} grabber cornerRadius={20}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text type="title2">Adjust Recipe</Text>
          <TouchableOpacity onPress={handleDismiss}>
            <Ionicons name="close" size={28} style={styles.closeIcon} />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          {/* Servings Stepper */}
          <View style={styles.servingsSection}>
            <Text type="heading" style={styles.sectionLabel}>
              Servings
            </Text>
            <VSpace size={12} />
            <View style={styles.servingsStepper}>
              <TouchableOpacity
                style={styles.stepperButton}
                onPress={handleDecrement}
                disabled={!servings || servings <= 1}
              >
                <Ionicons
                  name="remove"
                  size={24}
                  style={[
                    styles.stepperIcon,
                    (!servings || servings <= 1) && styles.stepperIconDisabled,
                  ]}
                />
              </TouchableOpacity>
              <View style={styles.servingsDisplay}>
                <Text style={styles.servingsNumber}>{servings || 1}</Text>
              </View>
              <TouchableOpacity
                style={styles.stepperButton}
                onPress={handleIncrement}
              >
                <Ionicons name="add" size={24} style={styles.stepperIcon} />
              </TouchableOpacity>
            </View>
          </View>

          <VSpace size={24} />

          {/* Measurement Toggle */}
          <MeasurementToggle
            value={measurementSystem}
            onValueChange={handleMeasurementChange}
          />

          <VSpace size={24} />

          {/* Done Button */}
          <TouchableOpacity style={styles.doneButton} onPress={handleDismiss}>
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TrueSheet>
  );
});

const styles = StyleSheet.create((theme) => ({
  container: {
    paddingBottom: 20,
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
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  servingsSection: {},
  sectionLabel: {
    marginBottom: 4,
  },
  servingsStepper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.inputBackground,
    borderRadius: 28,
    overflow: "hidden",
  },
  stepperButton: {
    width: 60,
    height: 56,
    justifyContent: "center",
    alignItems: "center",
  },
  stepperIcon: {
    color: theme.colors.text,
  },
  stepperIconDisabled: {
    opacity: 0.3,
  },
  servingsDisplay: {
    flex: 1,
    height: 56,
    justifyContent: "center",
    alignItems: "center",
  },
  servingsNumber: {
    fontSize: 24,
    fontFamily: theme.fonts.bold,
    color: theme.colors.text,
  },
  doneButton: {
    height: 50,
    backgroundColor: theme.colors.primary,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
  },
  doneButtonText: {
    color: theme.colors.buttonText,
    fontSize: 17,
    fontFamily: theme.fonts.semiBold,
  },
}));
