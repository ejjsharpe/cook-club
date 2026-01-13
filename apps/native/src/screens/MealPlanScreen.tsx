import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, SectionList, TouchableOpacity, Alert } from "react-native";
import { SheetManager } from "react-native-actions-sheet";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import {
  useGetMealPlans,
  useGetMealPlanEntries,
  useRemoveFromMealPlan,
  type MealPlanEntry,
} from "@/api/mealPlan";
import { FLOATING_TAB_BAR_HEIGHT } from "@/components/FloatingTabBar";
import { VSpace } from "@/components/Space";
import { Text } from "@/components/Text";
import { DayGroup, DayHeader } from "@/components/mealPlan";
import { useTabBarScroll } from "@/lib/tabBarContext";

interface DaySection {
  date: Date;
  dateString: string;
  isToday: boolean;
  data: [{ date: Date; dateString: string; isToday: boolean }];
}

// Helper to format date as YYYY-MM-DD
const formatDateString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

// Helper to check if two dates are the same day
const isSameDay = (a: Date, b: Date): boolean => {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
};

// Generate array of dates for a given range
const generateDateRange = (startDate: Date, days: number): Date[] => {
  const dates: Date[] = [];
  for (let i = 0; i < days; i++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);
    dates.push(date);
  }
  return dates;
};

export const MealPlanScreen = () => {
  const { theme } = useUnistyles();
  const { onScroll: onTabBarScroll } = useTabBarScroll();
  const navigation =
    useNavigation<NativeStackNavigationProp<ReactNavigation.RootParamList>>();

  // Refs
  const sectionListRef =
    useRef<
      SectionList<
        { date: Date; dateString: string; isToday: boolean },
        DaySection
      >
    >(null);
  const hasScrolledToToday = useRef(false);

  // State
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);

  // Calculate date range (2 weeks: 1 week back, 1 week forward)
  const today = useMemo(() => new Date(), []);
  const startDate = useMemo(() => {
    const date = new Date(today);
    date.setDate(today.getDate() - 7);
    return date;
  }, [today]);
  const endDate = useMemo(() => {
    const date = new Date(today);
    date.setDate(today.getDate() + 7);
    return date;
  }, [today]);

  // Queries
  const { data: mealPlans, isLoading: isLoadingPlans } = useGetMealPlans();
  const activePlan = useMemo(() => {
    if (!mealPlans || mealPlans.length === 0) return null;
    if (selectedPlanId) {
      return mealPlans.find((p) => p.id === selectedPlanId) || mealPlans[0];
    }
    // Default to first plan (should be the default plan)
    return mealPlans[0];
  }, [mealPlans, selectedPlanId]);

  const { data: entries } = useGetMealPlanEntries({
    mealPlanId: activePlan?.id ?? 0,
    startDate: formatDateString(startDate),
    endDate: formatDateString(endDate),
    enabled: !!activePlan,
  });

  // Mutations
  const removeEntry = useRemoveFromMealPlan();

  // Build sections for SectionList
  const sections: DaySection[] = useMemo(() => {
    const dates = generateDateRange(startDate, 15); // 15 days
    return dates.map((date) => ({
      date,
      dateString: formatDateString(date),
      isToday: isSameDay(date, today),
      data: [
        {
          date,
          dateString: formatDateString(date),
          isToday: isSameDay(date, today),
        },
      ],
    }));
  }, [startDate, today]);

  // Group entries by date
  const entriesByDate = useMemo(() => {
    const map = new Map<string, Map<string, MealPlanEntry>>();
    entries?.forEach((entry) => {
      if (!map.has(entry.date)) {
        map.set(entry.date, new Map());
      }
      map.get(entry.date)!.set(entry.mealType, entry);
    });
    return map;
  }, [entries]);

  // Handlers
  const handleMealSlotPress = useCallback(
    (dateString: string, mealType: "breakfast" | "lunch" | "dinner") => {
      const entry = entriesByDate.get(dateString)?.get(mealType);
      if (entry) {
        // Navigate to recipe detail
        navigation.navigate("RecipeDetail", { recipeId: entry.recipeId });
      } else if (activePlan) {
        // Open recipe picker sheet
        SheetManager.show("recipe-picker-sheet", {
          payload: {
            mealPlanId: activePlan.id,
            date: dateString,
            mealType,
          },
        });
      }
    },
    [entriesByDate, activePlan, navigation],
  );

  const handleMealSlotLongPress = useCallback(
    (dateString: string, mealType: "breakfast" | "lunch" | "dinner") => {
      const entry = entriesByDate.get(dateString)?.get(mealType);
      if (entry) {
        Alert.alert("Remove Recipe", `Remove ${entry.recipeName}?`, [
          { text: "Cancel", style: "cancel" },
          {
            text: "Remove",
            style: "destructive",
            onPress: () => removeEntry.mutate({ entryId: entry.id }),
          },
        ]);
      }
    },
    [entriesByDate, removeEntry],
  );

  // Render section header
  const renderSectionHeader = useCallback(
    ({ section }: { section: DaySection }) => (
      <DayHeader date={section.date} isToday={section.isToday} />
    ),
    [],
  );

  // Render day content
  const renderItem = useCallback(
    ({
      item,
    }: {
      item: { date: Date; dateString: string; isToday: boolean };
    }) => {
      const dayEntries = entriesByDate.get(item.dateString);
      const canEdit = activePlan?.canEdit ?? false;

      return (
        <DayGroup
          dateString={item.dateString}
          entries={dayEntries}
          canEdit={canEdit}
          onMealPress={(mealType) =>
            handleMealSlotPress(item.dateString, mealType)
          }
          onMealLongPress={(mealType) =>
            handleMealSlotLongPress(item.dateString, mealType)
          }
        />
      );
    },
    [entriesByDate, activePlan, handleMealSlotPress, handleMealSlotLongPress],
  );

  // Render section footer for spacing
  const renderSectionFooter = useCallback(() => {
    return <View style={styles.sectionFooter} />;
  }, []);

  // Find index of today's section for initial scroll
  const todaySectionIndex = useMemo(() => {
    return sections.findIndex((s) => s.isToday);
  }, [sections]);

  // Scroll to today on initial mount
  useEffect(() => {
    if (hasScrolledToToday.current || todaySectionIndex < 0) return;

    // Small delay to ensure list is rendered
    const timer = setTimeout(() => {
      sectionListRef.current?.scrollToLocation({
        sectionIndex: todaySectionIndex,
        itemIndex: 0,
        animated: false,
        viewOffset: 0,
      });
      hasScrolledToToday.current = true;
    }, 100);

    return () => clearTimeout(timer);
  }, [todaySectionIndex]);

  if (isLoadingPlans) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text type="title1">Meal Plan</Text>
        </View>
        <View style={styles.loadingContainer}>
          <Text type="bodyFaded">Loading...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text type="title1">Meal Plan</Text>
          <View style={styles.headerButtons}>
            {activePlan?.isOwner && (
              <TouchableOpacity
                style={styles.headerButton}
                onPress={() =>
                  SheetManager.show("meal-plan-share-sheet", {
                    payload: {
                      mealPlanId: activePlan.id,
                      planName: activePlan.name,
                    },
                  })
                }
              >
                <Ionicons
                  name="share-outline"
                  size={22}
                  color={theme.colors.text}
                />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Plan selector */}
        {activePlan && (
          <TouchableOpacity
            style={styles.planSelector}
            onPress={() =>
              SheetManager.show("meal-plan-picker-sheet", {
                payload: {
                  activePlanId: activePlan.id,
                  onSelectPlan: setSelectedPlanId,
                },
              })
            }
          >
            <Text type="subheadline">{activePlan.name}</Text>
            <Ionicons
              name="chevron-down"
              size={16}
              color={theme.colors.textSecondary}
            />
          </TouchableOpacity>
        )}
      </View>

      <VSpace size={8} />

      {/* Calendar */}
      <SectionList
        ref={sectionListRef}
        sections={sections}
        keyExtractor={(item) => item.dateString}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        renderSectionFooter={renderSectionFooter}
        stickySectionHeadersEnabled
        contentContainerStyle={styles.listContent}
        onScroll={onTabBarScroll}
        scrollEventThrottle={16}
      />
    </View>
  );
};

const styles = StyleSheet.create((theme, rt) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingTop: rt.insets.top,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerButtons: {
    flexDirection: "row",
    gap: 12,
  },
  headerButton: {
    padding: 8,
  },
  planSelector: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 8,
    alignSelf: "flex-start",
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: theme.colors.inputBackground,
    borderRadius: theme.borderRadius.small,
  },
  listContent: {
    paddingBottom: FLOATING_TAB_BAR_HEIGHT + rt.insets.bottom + 20,
  },
  sectionFooter: {
    height: 16,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
}));
