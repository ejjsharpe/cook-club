import { memo, useCallback } from "react";
import { View } from "react-native";
import { StyleSheet } from "react-native-unistyles";

import { MealSlot } from "./MealSlot";

import type { MealPlanEntry } from "@/api/mealPlan";

type MealType = "breakfast" | "lunch" | "dinner";

interface DayGroupProps {
  dateString: string;
  entries: Map<string, MealPlanEntry> | undefined;
  canEdit: boolean;
  onMealPress: (dateString: string, mealType: MealType) => void;
  onMealDelete: (dateString: string, mealType: MealType) => void;
}

export const DayGroup = memo(
  ({
    dateString,
    entries,
    canEdit,
    onMealPress,
    onMealDelete,
  }: DayGroupProps) => {
    const handleBreakfastPress = useCallback(
      () => onMealPress(dateString, "breakfast"),
      [dateString, onMealPress],
    );
    const handleLunchPress = useCallback(
      () => onMealPress(dateString, "lunch"),
      [dateString, onMealPress],
    );
    const handleDinnerPress = useCallback(
      () => onMealPress(dateString, "dinner"),
      [dateString, onMealPress],
    );
    const handleBreakfastDelete = useCallback(
      () => onMealDelete(dateString, "breakfast"),
      [dateString, onMealDelete],
    );
    const handleLunchDelete = useCallback(
      () => onMealDelete(dateString, "lunch"),
      [dateString, onMealDelete],
    );
    const handleDinnerDelete = useCallback(
      () => onMealDelete(dateString, "dinner"),
      [dateString, onMealDelete],
    );

    return (
      <View style={styles.container}>
        <MealSlot
          mealType="breakfast"
          entry={entries?.get("breakfast")}
          onPress={handleBreakfastPress}
          onDelete={canEdit ? handleBreakfastDelete : undefined}
          disabled={!canEdit}
        />
        <View style={styles.separator} />
        <MealSlot
          mealType="lunch"
          entry={entries?.get("lunch")}
          onPress={handleLunchPress}
          onDelete={canEdit ? handleLunchDelete : undefined}
          disabled={!canEdit}
        />
        <View style={styles.separator} />
        <MealSlot
          mealType="dinner"
          entry={entries?.get("dinner")}
          onPress={handleDinnerPress}
          onDelete={canEdit ? handleDinnerDelete : undefined}
          disabled={!canEdit}
        />
      </View>
    );
  },
);

const styles = StyleSheet.create((theme) => ({
  container: {
    backgroundColor: theme.colors.inputBackground,
    borderRadius: theme.borderRadius.large,
    overflow: "hidden",
    marginHorizontal: 20,
  },
  separator: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginLeft: 72,
  },
}));
