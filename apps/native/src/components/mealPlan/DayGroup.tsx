import { View } from "react-native";
import { StyleSheet } from "react-native-unistyles";

import { MealSlot } from "./MealSlot";

import type { MealPlanEntry } from "@/api/mealPlan";

interface DayGroupProps {
  dateString: string;
  entries: Map<string, MealPlanEntry> | undefined;
  canEdit: boolean;
  onMealPress: (mealType: "breakfast" | "lunch" | "dinner") => void;
  onMealLongPress: (mealType: "breakfast" | "lunch" | "dinner") => void;
}

export const DayGroup = ({
  entries,
  canEdit,
  onMealPress,
  onMealLongPress,
}: DayGroupProps) => {
  return (
    <View style={styles.container}>
      <MealSlot
        mealType="breakfast"
        entry={entries?.get("breakfast")}
        onPress={() => onMealPress("breakfast")}
        onLongPress={() => onMealLongPress("breakfast")}
        disabled={!canEdit}
      />
      <View style={styles.separator} />
      <MealSlot
        mealType="lunch"
        entry={entries?.get("lunch")}
        onPress={() => onMealPress("lunch")}
        onLongPress={() => onMealLongPress("lunch")}
        disabled={!canEdit}
      />
      <View style={styles.separator} />
      <MealSlot
        mealType="dinner"
        entry={entries?.get("dinner")}
        onPress={() => onMealPress("dinner")}
        onLongPress={() => onMealLongPress("dinner")}
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
