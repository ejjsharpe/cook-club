import { Ionicons } from "@expo/vector-icons";
import { TrueSheet } from "@lodev09/react-native-true-sheet";
import {
  forwardRef,
  useState,
  useImperativeHandle,
  useRef,
  useCallback,
  useMemo,
} from "react";
import {
  View,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { StyleSheet, UnistylesRuntime } from "react-native-unistyles";

import {
  MealPlanPickerSheet,
  type MealPlanPickerSheetRef,
} from "./MealPlanPickerSheet";

import { useGetMealPlans, useAddRecipeToMealPlan } from "@/api/mealPlan";
import { useSelectedMealPlan } from "@/lib/mealPlanPreferences";
import { Text } from "../Text";

type MealType = "breakfast" | "lunch" | "dinner";

const MEAL_TYPES: { value: MealType; label: string }[] = [
  { value: "breakfast", label: "Breakfast" },
  { value: "lunch", label: "Lunch" },
  { value: "dinner", label: "Dinner" },
];

function getDefaultMealType(): MealType {
  const hour = new Date().getHours();
  if (hour < 10) return "breakfast";
  if (hour < 14) return "lunch";
  return "dinner";
}

function getNext7Days(): { date: Date; label: string; dateStr: string }[] {
  const days: { date: Date; label: string; dateStr: string }[] = [];
  const dayAbbrevs = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);

    let label: string;
    if (i === 0) label = "Today";
    else if (i === 1) label = "Tmrw";
    else label = dayAbbrevs[d.getDay()]!;

    // Format as YYYY-MM-DD manually to avoid timezone issues
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const dateStr = `${yyyy}-${mm}-${dd}`;

    days.push({ date: d, label, dateStr });
  }

  return days;
}

export interface AddToMealPlanSheetProps {
  recipeId?: number;
  recipeName?: string;
}

export interface AddToMealPlanSheetRef {
  present: () => void;
  dismiss: () => void;
}

export const AddToMealPlanSheet = forwardRef<
  AddToMealPlanSheetRef,
  AddToMealPlanSheetProps
>(({ recipeId, recipeName }, ref) => {
  const theme = UnistylesRuntime.getTheme();
  const sheetRef = useRef<TrueSheet>(null);
  const pickerSheetRef = useRef<MealPlanPickerSheetRef>(null);

  const days = useMemo(() => getNext7Days(), []);

  const [selectedDate, setSelectedDate] = useState(days[0]!.dateStr);
  const [selectedMealType, setSelectedMealType] = useState<MealType>(
    getDefaultMealType,
  );

  const { selectedPlan, setSelectedPlan } = useSelectedMealPlan();
  const { data: mealPlans } = useGetMealPlans();
  const addRecipeMutation = useAddRecipeToMealPlan();

  // Resolve the active meal plan: MMKV selection -> default plan -> first plan
  const activePlan = useMemo(() => {
    if (!mealPlans || mealPlans.length === 0) return null;
    if (selectedPlan) {
      const found = mealPlans.find((p) => p.id === selectedPlan.id);
      if (found) return found;
    }
    const defaultPlan = mealPlans.find((p) => p.isDefault);
    return defaultPlan ?? mealPlans[0]!;
  }, [mealPlans, selectedPlan]);

  const hasMultiplePlans = (mealPlans?.length ?? 0) > 1;

  useImperativeHandle(ref, () => ({
    present: () => {
      // Reset to defaults on each open
      setSelectedDate(getNext7Days()[0]!.dateStr);
      setSelectedMealType(getDefaultMealType());
      sheetRef.current?.present();
    },
    dismiss: () => sheetRef.current?.dismiss(),
  }));

  const handleDismiss = useCallback(() => {
    sheetRef.current?.dismiss();
  }, []);

  const handleChangePlan = () => {
    pickerSheetRef.current?.present();
  };

  const handlePlanSelected = (planId: number) => {
    const plan = mealPlans?.find((p) => p.id === planId);
    if (plan) {
      setSelectedPlan(plan.id, plan.name);
    }
  };

  const handleConfirm = async () => {
    if (!recipeId || !activePlan) return;

    try {
      await addRecipeMutation.mutateAsync({
        mealPlanId: activePlan.id,
        recipeId,
        date: selectedDate,
        mealType: selectedMealType,
      });
      handleDismiss();
    } catch {
      // Error handled in mutation
    }
  };

  const isConfirmDisabled = !activePlan || addRecipeMutation.isPending;

  return (
    <>
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
            <Text type="headline">Add to Meal Plan</Text>
            <TouchableOpacity
              onPress={handleDismiss}
              style={styles.closeButton}
            >
              <View style={styles.closeButtonCircle}>
                <Ionicons name="close" size={16} style={styles.closeIcon} />
              </View>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollView}>
            <View style={styles.scrollContent}>
              {/* Recipe name */}
              {recipeName && (
                <Text
                  type="body"
                  style={styles.recipeNameText}
                  numberOfLines={1}
                >
                  {recipeName}
                </Text>
              )}

              {/* Meal plan row - only if multiple plans */}
              {hasMultiplePlans && activePlan && (
                <>
                  <View style={styles.planRow}>
                    <View style={styles.planInfo}>
                      <Ionicons
                        name="calendar-outline"
                        size={18}
                        style={styles.planIcon}
                      />
                      <Text type="body" numberOfLines={1} style={styles.planName}>
                        {activePlan.name}
                      </Text>
                    </View>
                    <TouchableOpacity onPress={handleChangePlan}>
                      <Text type="body" style={styles.changeText}>
                        Change
                      </Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}

              {/* Date selector */}
              <Text type="heading" style={styles.sectionTitle}>
                Date
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.dateScroll}
                contentContainerStyle={styles.dateScrollContent}
              >
                {days.map((day) => {
                  const isSelected = selectedDate === day.dateStr;
                  return (
                    <TouchableOpacity
                      key={day.dateStr}
                      style={[
                        styles.dateChip,
                        isSelected && styles.dateChipSelected,
                      ]}
                      onPress={() => setSelectedDate(day.dateStr)}
                    >
                      <Text
                        style={[
                          styles.dateChipDay,
                          isSelected && styles.dateChipTextSelected,
                        ]}
                      >
                        {day.label}
                      </Text>
                      <Text
                        style={[
                          styles.dateChipNumber,
                          isSelected && styles.dateChipTextSelected,
                        ]}
                      >
                        {day.date.getDate()}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Meal type selector */}
              <Text type="heading" style={styles.sectionTitle}>
                Meal
              </Text>
              <View style={styles.mealTypeRow}>
                {MEAL_TYPES.map((mt) => {
                  const isSelected = selectedMealType === mt.value;
                  return (
                    <TouchableOpacity
                      key={mt.value}
                      style={[
                        styles.mealTypeChip,
                        isSelected && styles.mealTypeChipSelected,
                      ]}
                      onPress={() => setSelectedMealType(mt.value)}
                    >
                      <Text
                        style={[
                          styles.mealTypeText,
                          isSelected && styles.mealTypeTextSelected,
                        ]}
                      >
                        {mt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Confirm button */}
              <TouchableOpacity
                style={[
                  styles.confirmButton,
                  isConfirmDisabled && styles.confirmButtonDisabled,
                ]}
                onPress={handleConfirm}
                disabled={isConfirmDisabled}
              >
                {addRecipeMutation.isPending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons
                      name="calendar-outline"
                      size={20}
                      style={styles.confirmButtonIcon}
                    />
                    <Text style={styles.confirmButtonText}>Add to Plan</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </TrueSheet>

      {/* Nested plan picker sheet */}
      <MealPlanPickerSheet
        ref={pickerSheetRef}
        activePlanId={activePlan?.id}
        onSelectPlan={handlePlanSelected}
      />
    </>
  );
});

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
    paddingTop: 8,
    paddingBottom: 20,
  },
  recipeNameText: {
    color: theme.colors.textSecondary,
    marginBottom: 16,
  },

  // Plan row
  planRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: theme.borderRadius.medium,
    backgroundColor: theme.colors.inputBackground,
    marginBottom: 20,
  },
  planInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 8,
  },
  planIcon: {
    color: theme.colors.textSecondary,
  },
  planName: {
    flex: 1,
  },
  changeText: {
    color: theme.colors.primary,
    fontFamily: theme.fonts.semiBold,
  },

  // Section title
  sectionTitle: {
    marginBottom: 12,
  },

  // Date selector
  dateScroll: {
    marginBottom: 20,
    marginHorizontal: -20,
  },
  dateScrollContent: {
    paddingHorizontal: 20,
    gap: 8,
  },
  dateChip: {
    width: 56,
    height: 68,
    borderRadius: theme.borderRadius.medium,
    backgroundColor: theme.colors.inputBackground,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  dateChipSelected: {
    backgroundColor: theme.colors.primary,
  },
  dateChipDay: {
    fontSize: 13,
    fontFamily: theme.fonts.semiBold,
    color: theme.colors.textSecondary,
  },
  dateChipNumber: {
    fontSize: 20,
    fontFamily: theme.fonts.bold,
    color: theme.colors.text,
  },
  dateChipTextSelected: {
    color: theme.colors.buttonText,
  },

  // Meal type selector
  mealTypeRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 24,
  },
  mealTypeChip: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.inputBackground,
    alignItems: "center",
    justifyContent: "center",
  },
  mealTypeChipSelected: {
    backgroundColor: theme.colors.primary,
  },
  mealTypeText: {
    fontSize: 15,
    fontFamily: theme.fonts.semiBold,
    color: theme.colors.text,
  },
  mealTypeTextSelected: {
    color: theme.colors.buttonText,
  },

  // Confirm button
  confirmButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 50,
    backgroundColor: theme.colors.primary,
    borderRadius: 25,
  },
  confirmButtonDisabled: {
    opacity: 0.5,
  },
  confirmButtonIcon: {
    color: theme.colors.buttonText,
  },
  confirmButtonText: {
    color: theme.colors.buttonText,
    fontSize: 17,
    fontFamily: theme.fonts.semiBold,
  },
}));
