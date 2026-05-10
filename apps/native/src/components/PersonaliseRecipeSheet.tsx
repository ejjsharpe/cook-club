import { TrueSheet } from "@lodev09/react-native-true-sheet";
import {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  ScrollView,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { StyleSheet } from "react-native-unistyles";

import { AppSheet } from "./AppSheet";
import { Text } from "./Text";

import type { PersonalizationGoal } from "@/api/recipe";
import { Ionicons } from "@/components/Ionicons";
import { BaseButton } from "@/components/buttons/BaseButton";

interface GoalOption {
  value: PersonalizationGoal;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const GOAL_OPTIONS: GoalOption[] = [
  { value: "vegetarian", label: "Vegetarian", icon: "leaf-outline" },
  { value: "vegan", label: "Vegan", icon: "flower-outline" },
  { value: "gluten_free", label: "Gluten-free", icon: "nutrition-outline" },
  { value: "dairy_free", label: "Dairy-free", icon: "water-outline" },
  { value: "low_carb", label: "Low-carb", icon: "trending-down-outline" },
  { value: "high_protein", label: "High-protein", icon: "barbell-outline" },
  { value: "budget", label: "Budget swaps", icon: "cash-outline" },
  { value: "healthier", label: "Healthier", icon: "heart-outline" },
  { value: "kid_friendly", label: "Kid-friendly", icon: "happy-outline" },
  { value: "batch_cook", label: "Batch cook", icon: "albums-outline" },
  { value: "meal_prep", label: "Meal prep", icon: "calendar-outline" },
];

export interface PersonaliseRecipeSheetRef {
  present: () => void;
  dismiss: () => void;
}

interface PersonaliseRecipeSheetProps {
  isSubmitting: boolean;
  onSubmit: (input: {
    goals: PersonalizationGoal[];
    allergyNotes?: string;
    customNotes?: string;
  }) => Promise<void> | void;
}

export const PersonaliseRecipeSheet = forwardRef<
  PersonaliseRecipeSheetRef,
  PersonaliseRecipeSheetProps
>(({ isSubmitting, onSubmit }, ref) => {
  const sheetRef = useRef<TrueSheet>(null);
  const [selectedGoals, setSelectedGoals] = useState<PersonalizationGoal[]>([]);
  const [allergyNotes, setAllergyNotes] = useState("");
  const [customNotes, setCustomNotes] = useState("");

  useImperativeHandle(ref, () => ({
    present: () => sheetRef.current?.present(),
    dismiss: () => sheetRef.current?.dismiss(),
  }));

  const canSubmit = useMemo(
    () =>
      selectedGoals.length > 0 ||
      allergyNotes.trim().length > 0 ||
      customNotes.trim().length > 0,
    [allergyNotes, customNotes, selectedGoals.length],
  );

  const toggleGoal = (goal: PersonalizationGoal) => {
    setSelectedGoals((current) =>
      current.includes(goal)
        ? current.filter((item) => item !== goal)
        : [...current, goal],
    );
  };

  const handleSubmit = async () => {
    if (!canSubmit || isSubmitting) return;

    await onSubmit({
      goals: selectedGoals,
      allergyNotes: allergyNotes.trim() || undefined,
      customNotes: customNotes.trim() || undefined,
    });
  };

  return (
    <AppSheet
      ref={sheetRef}
      title="Personalise Recipe"
      subtitle="Make it vegan, gluten-free, cheaper, healthier, or meal-prep friendly"
      detents={["auto"]}
      blurOptions={{ intensity: 84, interaction: true }}
      closeDisabled={isSubmitting}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.goalGrid}>
          {GOAL_OPTIONS.map((goal) => {
            const selected = selectedGoals.includes(goal.value);

            return (
              <TouchableOpacity
                key={goal.value}
                style={[styles.goalChip, selected && styles.goalChipSelected]}
                onPress={() => toggleGoal(goal.value)}
                activeOpacity={0.76}
                disabled={isSubmitting}
              >
                <Ionicons
                  name={goal.icon}
                  size={16}
                  style={[styles.goalIcon, selected && styles.goalIconSelected]}
                />
                <Text
                  style={[styles.goalText, selected && styles.goalTextSelected]}
                >
                  {goal.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.inputGroup}>
          <Text type="heading" style={styles.inputLabel}>
            Allergies or ingredients to avoid
          </Text>
          <TextInput
            value={allergyNotes}
            onChangeText={setAllergyNotes}
            placeholder="Peanuts, shellfish, mushrooms..."
            placeholderTextColor={styles.placeholderText.color}
            style={styles.textInput}
            multiline
            editable={!isSubmitting}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text type="heading" style={styles.inputLabel}>
            Extra notes
          </Text>
          <TextInput
            value={customNotes}
            onChangeText={setCustomNotes}
            placeholder="Make it spicy, use pantry ingredients, keep the same cuisine..."
            placeholderTextColor={styles.placeholderText.color}
            style={[styles.textInput, styles.notesInput]}
            multiline
            editable={!isSubmitting}
          />
        </View>

        <BaseButton
          onPress={handleSubmit}
          disabled={!canSubmit || isSubmitting}
          style={[
            styles.submitButton,
            (!canSubmit || isSubmitting) && styles.disabledButton,
          ]}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text style={styles.submitButtonText}>Personalise Recipe</Text>
          )}
        </BaseButton>
      </ScrollView>
    </AppSheet>
  );
});

const styles = StyleSheet.create((theme) => ({
  content: {
    paddingHorizontal: 20,
    gap: 18,
  },
  goalGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  goalChip: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: theme.colors.inputBackground,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  goalChipSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  goalIcon: {
    color: theme.colors.textSecondary,
  },
  goalIconSelected: {
    color: theme.colors.buttonText,
  },
  goalText: {
    color: theme.colors.text,
    fontSize: 14,
    fontFamily: theme.fonts.semiBold,
  },
  goalTextSelected: {
    color: theme.colors.buttonText,
  },
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    letterSpacing: 0,
  },
  textInput: {
    minHeight: 76,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 18,
    backgroundColor: theme.colors.inputBackground,
    color: theme.colors.text,
    fontSize: 16,
    lineHeight: 22,
    fontFamily: theme.fonts.regular,
    textAlignVertical: "top",
  },
  notesInput: {
    minHeight: 104,
  },
  placeholderText: {
    color: theme.colors.textSecondary,
  },
  disabledButton: {
    opacity: 0.62,
  },
  submitButton: {
    width: "100%",
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: theme.colors.primary,
  },
  submitButtonText: {
    fontSize: 17,
    fontFamily: theme.fonts.semiBold,
    color: theme.colors.buttonText,
  },
}));
