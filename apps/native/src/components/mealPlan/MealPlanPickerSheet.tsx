import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
  View,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from "react-native";
import ActionSheet, {
  SheetManager,
  SheetProps,
  ScrollView,
} from "react-native-actions-sheet";
import { StyleSheet } from "react-native-unistyles";

import {
  useGetMealPlans,
  useCreateMealPlan,
  useDeleteMealPlan,
  type MealPlan,
} from "../../api/mealPlan";
import { VSpace } from "../Space";
import { Text } from "../Text";

interface PlanItemProps {
  plan: MealPlan;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
  showDelete: boolean;
}

const PlanItem = ({
  plan,
  isActive,
  onSelect,
  onDelete,
  showDelete,
}: PlanItemProps) => {
  return (
    <TouchableOpacity style={styles.planRow} onPress={onSelect}>
      <View style={styles.planInfo}>
        <View style={styles.planNameRow}>
          <Text type="body">{plan.name}</Text>
          {plan.isDefault && (
            <View style={styles.defaultBadge}>
              <Text type="caption" style={styles.defaultBadgeText}>
                Default
              </Text>
            </View>
          )}
          {!plan.isOwner && (
            <View style={styles.sharedBadge}>
              <Ionicons name="people" size={12} style={styles.sharedIcon} />
              <Text type="caption" style={styles.sharedBadgeText}>
                {plan.owner.name}
              </Text>
            </View>
          )}
        </View>
        {!plan.canEdit && (
          <Text type="caption" style={styles.viewOnlyText}>
            View only
          </Text>
        )}
      </View>
      <View style={styles.planActions}>
        {showDelete && !plan.isDefault && plan.isOwner && (
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            style={styles.deleteButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons
              name="trash-outline"
              size={18}
              style={styles.deleteIcon}
            />
          </TouchableOpacity>
        )}
        {isActive && (
          <Ionicons
            name="checkmark-circle"
            size={24}
            style={styles.checkIcon}
          />
        )}
      </View>
    </TouchableOpacity>
  );
};

export const MealPlanPickerSheet = (
  props: SheetProps<"meal-plan-picker-sheet">,
) => {
  const { activePlanId, onSelectPlan } = props.payload || {};
  const [isCreating, setIsCreating] = useState(false);
  const [newPlanName, setNewPlanName] = useState("");
  const [planToDelete, setPlanToDelete] = useState<number | null>(null);

  const { data: mealPlans, isLoading } = useGetMealPlans();
  const createMutation = useCreateMealPlan();
  const deleteMutation = useDeleteMealPlan();

  const handleSelectPlan = (planId: number) => {
    onSelectPlan?.(planId);
    SheetManager.hide("meal-plan-picker-sheet");
  };

  const handleCreatePlan = async () => {
    if (!newPlanName.trim()) return;

    try {
      const newPlan = await createMutation.mutateAsync({
        name: newPlanName.trim(),
      });
      if (newPlan) {
        onSelectPlan?.(newPlan.id);
      }
      setNewPlanName("");
      setIsCreating(false);
      SheetManager.hide("meal-plan-picker-sheet");
    } catch {
      // Error handled by mutation
    }
  };

  const handleDeletePlan = async (planId: number) => {
    setPlanToDelete(planId);
    try {
      await deleteMutation.mutateAsync({ mealPlanId: planId });
      // If we deleted the active plan, switch to the default
      if (planId === activePlanId) {
        const defaultPlan = mealPlans?.find((p) => p.isDefault);
        if (defaultPlan) {
          onSelectPlan?.(defaultPlan.id);
        }
      }
    } catch {
      // Error handled by mutation
    } finally {
      setPlanToDelete(null);
    }
  };

  const ownedPlans = mealPlans?.filter((p) => p.isOwner) ?? [];
  const sharedPlans = mealPlans?.filter((p) => !p.isOwner) ?? [];

  return (
    <ActionSheet
      id={props.sheetId}
      snapPoints={[100]}
      initialSnapIndex={0}
      gestureEnabled
      enableGesturesInScrollView={false}
      indicatorStyle={styles.indicator}
    >
      <View>
        {/* Header */}
        <View style={styles.header}>
          <Text type="title2">Select Meal Plan</Text>
          <TouchableOpacity
            onPress={() => SheetManager.hide("meal-plan-picker-sheet")}
          >
            <Ionicons name="close" size={28} style={styles.closeIcon} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scrollView}>
          <View style={styles.scrollContent}>
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" />
              </View>
            ) : (
              <>
                {/* Your Plans */}
                {ownedPlans.length > 0 && (
                  <>
                    <Text type="heading" style={styles.sectionTitle}>
                      Your Plans
                    </Text>
                    <VSpace size={12} />
                    {ownedPlans.map((plan) => (
                      <PlanItem
                        key={plan.id}
                        plan={plan}
                        isActive={plan.id === activePlanId}
                        onSelect={() => handleSelectPlan(plan.id)}
                        onDelete={() => handleDeletePlan(plan.id)}
                        showDelete={planToDelete !== plan.id}
                      />
                    ))}
                    <VSpace size={20} />
                  </>
                )}

                {/* Shared Plans */}
                {sharedPlans.length > 0 && (
                  <>
                    <Text type="heading" style={styles.sectionTitle}>
                      Shared With You
                    </Text>
                    <VSpace size={12} />
                    {sharedPlans.map((plan) => (
                      <PlanItem
                        key={plan.id}
                        plan={plan}
                        isActive={plan.id === activePlanId}
                        onSelect={() => handleSelectPlan(plan.id)}
                        onDelete={() => {}}
                        showDelete={false}
                      />
                    ))}
                    <VSpace size={20} />
                  </>
                )}

                {/* Create New Plan */}
                {isCreating ? (
                  <>
                    <Text type="heading" style={styles.sectionTitle}>
                      New Plan Name
                    </Text>
                    <VSpace size={12} />
                    <TextInput
                      style={styles.input}
                      placeholder="e.g., Family Dinners"
                      placeholderTextColor="#999"
                      value={newPlanName}
                      onChangeText={setNewPlanName}
                      autoFocus
                    />
                    <VSpace size={12} />
                    <View style={styles.createActions}>
                      <TouchableOpacity
                        style={styles.cancelButton}
                        onPress={() => {
                          setNewPlanName("");
                          setIsCreating(false);
                        }}
                      >
                        <Text type="body">Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.saveButton,
                          (!newPlanName.trim() || createMutation.isPending) &&
                            styles.saveButtonDisabled,
                        ]}
                        onPress={handleCreatePlan}
                        disabled={
                          !newPlanName.trim() || createMutation.isPending
                        }
                      >
                        {createMutation.isPending ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Text type="highlight" style={styles.saveButtonText}>
                            Create
                          </Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </>
                ) : (
                  <TouchableOpacity
                    style={styles.createButton}
                    onPress={() => setIsCreating(true)}
                  >
                    <Ionicons
                      name="add-circle-outline"
                      size={24}
                      style={styles.createIcon}
                    />
                    <Text type="body" style={styles.createText}>
                      Create new plan
                    </Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        </ScrollView>
      </View>
    </ActionSheet>
  );
};

const styles = StyleSheet.create((theme) => ({
  indicator: {
    backgroundColor: theme.colors.border,
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
  scrollView: {
    maxHeight: 500,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
  },
  loadingContainer: {
    alignItems: "center",
    paddingVertical: 40,
  },
  sectionTitle: {
    marginBottom: 4,
  },
  planRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: theme.borderRadius.medium,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 8,
  },
  planInfo: {
    flex: 1,
    marginRight: 12,
  },
  planNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  defaultBadge: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.small,
  },
  defaultBadgeText: {
    color: theme.colors.buttonText,
    fontWeight: "600",
  },
  sharedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: theme.colors.inputBackground,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.small,
  },
  sharedIcon: {
    color: theme.colors.textSecondary,
  },
  sharedBadgeText: {
    color: theme.colors.textSecondary,
  },
  viewOnlyText: {
    color: theme.colors.textTertiary,
    marginTop: 2,
  },
  planActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  deleteButton: {
    padding: 4,
  },
  deleteIcon: {
    color: theme.colors.destructive,
  },
  checkIcon: {
    color: theme.colors.primary,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.medium,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: theme.colors.text,
    backgroundColor: theme.colors.background,
  },
  createActions: {
    flexDirection: "row",
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: theme.borderRadius.medium,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
  },
  saveButton: {
    flex: 1,
    backgroundColor: theme.colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: theme.borderRadius.medium,
    alignItems: "center",
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: theme.colors.buttonText,
  },
  createButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: theme.borderRadius.medium,
    borderWidth: 2,
    borderColor: theme.colors.border,
    borderStyle: "dashed",
  },
  createIcon: {
    color: theme.colors.text,
    opacity: 0.6,
    marginRight: 8,
  },
  createText: {
    color: theme.colors.text,
    opacity: 0.6,
  },
}));
