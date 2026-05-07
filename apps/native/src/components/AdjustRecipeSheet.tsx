import { Ionicons } from "@expo/vector-icons";
import { TrueSheet } from "@lodev09/react-native-true-sheet";
import { forwardRef, useImperativeHandle, useRef } from "react";
import { View } from "react-native";
import { StyleSheet, UnistylesRuntime } from "react-native-unistyles";

import { MeasurementToggle } from "./MeasurementToggle";
import { VSpace } from "./Space";
import { Text } from "./Text";
import { BaseButton } from "./buttons/BaseButton";
import { PrimaryButton } from "./buttons/PrimaryButton";

import { useUpdateProfile } from "@/api/user";
import type { MeasurementSystem } from "@/lib/measurementPreferences";

const QUICK_SERVINGS = [2, 4, 6, 8];

export interface AdjustRecipeSheetProps {
  servings: number;
  onServingsChange: (servings: number) => void;
  measurementSystem: MeasurementSystem;
  onMeasurementSystemChange: (system: MeasurementSystem) => void;
}

export interface AdjustRecipeSheetRef {
  present: () => void;
  dismiss: () => void;
}

export const AdjustRecipeSheet = forwardRef<
  AdjustRecipeSheetRef,
  AdjustRecipeSheetProps
>(
  (
    {
      servings,
      onServingsChange,
      measurementSystem,
      onMeasurementSystemChange,
    },
    ref,
  ) => {
    const theme = UnistylesRuntime.getTheme();
    const sheetRef = useRef<TrueSheet>(null);
    const updateProfileMutation = useUpdateProfile();

    useImperativeHandle(ref, () => ({
      present: () => sheetRef.current?.present(),
      dismiss: () => sheetRef.current?.dismiss(),
    }));

    const handleMeasurementChange = (system: MeasurementSystem) => {
      onMeasurementSystemChange(system);
      updateProfileMutation.mutate({ measurementPreference: system });
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

    const handleQuickServing = (value: number) => {
      onServingsChange?.(value);
    };

    const handleDismiss = () => {
      sheetRef.current?.dismiss();
    };

    return (
      <TrueSheet
        ref={sheetRef}
        detents={["auto"]}
        grabber={false}
        backgroundBlur="system-material"
        blurOptions={{ intensity: 84, interaction: true }}
        backgroundColor={theme.colors.background}
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <View style={styles.headerSpacer} />
            <Text type="headline">Adjust Recipe</Text>
            <BaseButton onPress={handleDismiss} style={styles.closeButton}>
              <View style={styles.closeButtonCircle}>
                <Ionicons name="close" size={16} style={styles.closeIcon} />
              </View>
            </BaseButton>
          </View>

          <View style={styles.content}>
            <View style={styles.servingsSection}>
              <View style={styles.sectionHeader}>
                <Text type="heading" style={styles.sectionLabel}>
                  Servings
                </Text>
              </View>
              <View style={styles.servingsStepper}>
                <BaseButton
                  style={[
                    styles.stepperButton,
                    (!servings || servings <= 1) &&
                      styles.stepperButtonDisabled,
                  ]}
                  onPress={handleDecrement}
                  disabled={!servings || servings <= 1}
                >
                  <Ionicons
                    name="remove"
                    size={26}
                    style={styles.stepperIcon}
                  />
                </BaseButton>
                <View style={styles.servingsDisplay}>
                  <Text style={styles.servingsNumber}>{servings || 1}</Text>
                  <Text type="caption1" style={styles.servingsCaption}>
                    servings
                  </Text>
                </View>
                <BaseButton
                  style={styles.stepperButton}
                  onPress={handleIncrement}
                >
                  <Ionicons name="add" size={26} style={styles.stepperIcon} />
                </BaseButton>
              </View>
              <View style={styles.quickRow}>
                {QUICK_SERVINGS.map((value) => {
                  const isSelected = value === servings;

                  return (
                    <BaseButton
                      key={value}
                      style={[
                        styles.quickButton,
                        isSelected && styles.quickButtonSelected,
                      ]}
                      onPress={() => handleQuickServing(value)}
                    >
                      <Text
                        type="footnote"
                        style={[
                          styles.quickButtonText,
                          isSelected && styles.quickButtonTextSelected,
                        ]}
                      >
                        {value}
                      </Text>
                    </BaseButton>
                  );
                })}
              </View>
            </View>

            <VSpace size={16} />

            <MeasurementToggle
              value={measurementSystem}
              onValueChange={handleMeasurementChange}
            />

            <VSpace size={18} />

            <PrimaryButton onPress={handleDismiss}>Done</PrimaryButton>
          </View>
        </View>
      </TrueSheet>
    );
  },
);

const styles = StyleSheet.create((theme) => ({
  container: {
    paddingBottom: 0,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 12,
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
  content: {
    paddingHorizontal: 20,
    paddingBottom: 0,
  },
  servingsSection: {
    backgroundColor: theme.colors.inputBackground,
    borderRadius: 24,
    padding: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionLabel: {
    letterSpacing: 0,
  },
  servingsStepper: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  stepperButton: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: theme.colors.background,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  stepperButtonDisabled: {
    opacity: 0.35,
  },
  stepperIcon: {
    color: theme.colors.primary,
  },
  servingsDisplay: {
    flex: 1,
    minHeight: 92,
    justifyContent: "center",
    alignItems: "center",
  },
  servingsNumber: {
    fontSize: 56,
    lineHeight: 62,
    fontFamily: theme.fonts.bold,
    color: theme.colors.text,
    letterSpacing: 0,
  },
  servingsCaption: {
    color: theme.colors.textSecondary,
    marginTop: -2,
  },
  quickRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 18,
  },
  quickButton: {
    flex: 1,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.background,
    justifyContent: "center",
    alignItems: "center",
  },
  quickButtonSelected: {
    backgroundColor: theme.colors.primary,
  },
  quickButtonText: {
    color: theme.colors.text,
    fontFamily: theme.fonts.semiBold,
  },
  quickButtonTextSelected: {
    color: theme.colors.buttonText,
  },
}));
