import { View } from "react-native";
import { StyleSheet } from "react-native-unistyles";

import { MealSlot } from "./MealSlot";

import type { MealPlanEntry } from "@/api/mealPlan";

interface DayGroupProps {
  dateString: string;
  entries: Map<string, MealPlanEntry> | undefined;
  canEdit: boolean;
  onMealPress: (mealType: "breakfast" | "lunch" | "dinner") => void;
  onMealDelete: (mealType: "breakfast" | "lunch" | "dinner") => void;
}

export const DayGroup = ({
  entries,
  canEdit,
  onMealPress,
  onMealDelete,
}: DayGroupProps) => {
  return (
    <View style={styles.container}>
      <MealSlot
        mealType="breakfast"
        entry={entries?.get("breakfast")}
        onPress={() => onMealPress("breakfast")}
        onDelete={canEdit ? () => onMealDelete("breakfast") : undefined}
        disabled={!canEdit}
      />
      <View style={styles.separator} />
      <MealSlot
        mealType="lunch"
        entry={entries?.get("lunch")}
        onPress={() => onMealPress("lunch")}
        onDelete={canEdit ? () => onMealDelete("lunch") : undefined}
        disabled={!canEdit}
      />
      <View style={styles.separator} />
      <MealSlot
        mealType="dinner"
        entry={entries?.get("dinner")}
        onPress={() => onMealPress("dinner")}
        onDelete={canEdit ? () => onMealDelete("dinner") : undefined}
        disabled={!canEdit}
      />
    </View>
  );
};

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
