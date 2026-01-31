import type { Outputs } from "@repo/trpc/client";
import { useTRPC } from "@repo/trpc/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Alert } from "react-native";

// API Response Types
export type MealPlan = Outputs["mealPlan"]["getMealPlans"][number];
export type MealPlanEntry = Outputs["mealPlan"]["getEntries"][number];
export type ShareableUser = Outputs["mealPlan"]["getShareableUsers"][number];
export type ShareStatus = Outputs["mealPlan"]["getShareStatus"][number];

// Get all meal plans (owned + shared with user)
export const useGetMealPlans = () => {
  const trpc = useTRPC();
  return useQuery(trpc.mealPlan.getMealPlans.queryOptions());
};

// Create a new meal plan
export const useCreateMealPlan = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const mutationOptions = trpc.mealPlan.createMealPlan.mutationOptions({
    onSuccess: () => {
      const plansFilter = trpc.mealPlan.getMealPlans.pathFilter();
      queryClient.invalidateQueries(plansFilter);
    },
    onError: () => {
      Alert.alert("Error", "Failed to create meal plan. Please try again.");
    },
  });

  return useMutation(mutationOptions);
};

// Delete a meal plan
export const useDeleteMealPlan = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const mutationOptions = trpc.mealPlan.deleteMealPlan.mutationOptions({
    onSuccess: () => {
      const plansFilter = trpc.mealPlan.getMealPlans.pathFilter();
      queryClient.invalidateQueries(plansFilter);
    },
    onError: () => {
      Alert.alert("Error", "Failed to delete meal plan. Please try again.");
    },
  });

  return useMutation(mutationOptions);
};

// Get entries for a meal plan within a date range
interface UseGetMealPlanEntriesParams {
  mealPlanId: number;
  startDate: string;
  endDate: string;
  enabled?: boolean;
}

export const useGetMealPlanEntries = ({
  mealPlanId,
  startDate,
  endDate,
  enabled = true,
}: UseGetMealPlanEntriesParams) => {
  const trpc = useTRPC();

  return useQuery({
    ...trpc.mealPlan.getEntries.queryOptions(
      { mealPlanId, startDate, endDate },
      { enabled },
    ),
    // Keep previous data while loading new date range to prevent flash
    placeholderData: (previousData) => previousData,
  });
};

// Add a recipe to a meal slot
export const useAddRecipeToMealPlan = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const mutationOptions = trpc.mealPlan.addRecipe.mutationOptions({
    onSuccess: () => {
      const entriesFilter = trpc.mealPlan.getEntries.pathFilter();
      queryClient.invalidateQueries(entriesFilter);
    },
    onError: () => {
      Alert.alert(
        "Error",
        "Failed to add recipe to meal plan. Please try again.",
      );
    },
  });

  return useMutation(mutationOptions);
};

// Remove an entry from meal plan
export const useRemoveFromMealPlan = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const mutationOptions = trpc.mealPlan.removeEntry.mutationOptions({
    onMutate: async (variables) => {
      const entriesFilter = trpc.mealPlan.getEntries.pathFilter();
      await queryClient.cancelQueries(entriesFilter);

      // Snapshot all matching queries before mutation
      const previousDataMap = new Map<string, MealPlanEntry[]>();
      const cache = queryClient.getQueriesData<MealPlanEntry[]>(entriesFilter);
      cache.forEach(([queryKey, data]) => {
        if (data) {
          previousDataMap.set(JSON.stringify(queryKey), data);
        }
      });

      // Optimistically remove the entry from cache
      queryClient.setQueriesData<MealPlanEntry[]>(entriesFilter, (old) => {
        if (!old) return old;
        return old.filter((entry) => entry.id !== variables.entryId);
      });

      return { previousDataMap };
    },
    onError: (_err, _variables, context) => {
      // Rollback on error using the snapshot map
      if (context?.previousDataMap) {
        context.previousDataMap.forEach((data, queryKeyStr) => {
          const queryKey = JSON.parse(queryKeyStr);
          queryClient.setQueryData(queryKey, data);
        });
      }
      Alert.alert("Error", "Failed to remove entry. Please try again.");
    },
    onSettled: () => {
      const entriesFilter = trpc.mealPlan.getEntries.pathFilter();
      queryClient.invalidateQueries(entriesFilter);
    },
  });

  return useMutation(mutationOptions);
};

// Move an entry to a different slot
export const useMoveEntry = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const mutationOptions = trpc.mealPlan.moveEntry.mutationOptions({
    onSuccess: () => {
      const entriesFilter = trpc.mealPlan.getEntries.pathFilter();
      queryClient.invalidateQueries(entriesFilter);
    },
    onError: () => {
      Alert.alert("Error", "Failed to move entry. Please try again.");
    },
  });

  return useMutation(mutationOptions);
};

// Get shareable users (friends)
export const useGetShareableUsers = () => {
  const trpc = useTRPC();
  return useQuery(trpc.mealPlan.getShareableUsers.queryOptions());
};

// Share meal plan with a friend
export const useShareMealPlan = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const mutationOptions = trpc.mealPlan.shareMealPlan.mutationOptions({
    onSuccess: () => {
      const shareStatusFilter = trpc.mealPlan.getShareStatus.pathFilter();
      queryClient.invalidateQueries(shareStatusFilter);
    },
    onError: () => {
      Alert.alert("Error", "Failed to share meal plan. Please try again.");
    },
  });

  return useMutation(mutationOptions);
};

// Unshare meal plan
export const useUnshareMealPlan = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const mutationOptions = trpc.mealPlan.unshareMealPlan.mutationOptions({
    onSuccess: () => {
      const shareStatusFilter = trpc.mealPlan.getShareStatus.pathFilter();
      queryClient.invalidateQueries(shareStatusFilter);
    },
    onError: () => {
      Alert.alert("Error", "Failed to unshare meal plan. Please try again.");
    },
  });

  return useMutation(mutationOptions);
};

// Get share status for a meal plan
interface UseGetShareStatusParams {
  mealPlanId: number;
  enabled?: boolean;
}

export const useGetShareStatus = ({
  mealPlanId,
  enabled = true,
}: UseGetShareStatusParams) => {
  const trpc = useTRPC();

  return useQuery(
    trpc.mealPlan.getShareStatus.queryOptions({ mealPlanId }, { enabled }),
  );
};
