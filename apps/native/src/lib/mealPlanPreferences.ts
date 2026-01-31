import { useCallback, useMemo } from "react";
import { useMMKVNumber, useMMKVString } from "react-native-mmkv";

import { storage } from "./mmkv";

const SELECTED_MEAL_PLAN_ID_KEY = "selected_meal_plan_id";
const SELECTED_MEAL_PLAN_NAME_KEY = "selected_meal_plan_name";

export function getSelectedMealPlan(): { id: number; name: string } | null {
  const id = storage.getNumber(SELECTED_MEAL_PLAN_ID_KEY);
  const name = storage.getString(SELECTED_MEAL_PLAN_NAME_KEY);
  if (id === undefined || name === undefined) return null;
  return { id, name };
}

export function setSelectedMealPlan(planId: number, planName: string): void {
  storage.set(SELECTED_MEAL_PLAN_ID_KEY, planId);
  storage.set(SELECTED_MEAL_PLAN_NAME_KEY, planName);
}

export function clearSelectedMealPlan(): void {
  storage.delete(SELECTED_MEAL_PLAN_ID_KEY);
  storage.delete(SELECTED_MEAL_PLAN_NAME_KEY);
}

/** Reactive hook for selected meal plan - auto-updates when MMKV changes */
export function useSelectedMealPlan() {
  const [id, setId] = useMMKVNumber(SELECTED_MEAL_PLAN_ID_KEY, storage);
  const [name, setName] = useMMKVString(SELECTED_MEAL_PLAN_NAME_KEY, storage);

  const selectedPlan = useMemo(() => {
    if (id === undefined || name === undefined) return null;
    return { id, name };
  }, [id, name]);

  const setSelectedPlan = useCallback(
    (planId: number, planName: string) => {
      setId(planId);
      setName(planName);
    },
    [setId, setName],
  );

  const clearSelectedPlan = useCallback(() => {
    setId(undefined);
    setName(undefined);
  }, [setId, setName]);

  return { selectedPlan, setSelectedPlan, clearSelectedPlan };
}
