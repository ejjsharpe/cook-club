import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  View,
  SectionList,
  TouchableOpacity,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { SheetManager } from "react-native-actions-sheet";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import {
  StyleSheet,
  useUnistyles,
  UnistylesRuntime,
} from "react-native-unistyles";

import {
  useGetMealPlans,
  useGetMealPlanEntries,
  useRemoveFromMealPlan,
  useGetShareStatus,
  type MealPlanEntry,
} from "@/api/mealPlan";
import { useUser } from "@/api/user";
import { FLOATING_TAB_BAR_HEIGHT } from "@/components/FloatingTabBar";
import { StackedAvatars } from "@/components/StackedAvatars";
import { Text } from "@/components/Text";
import { DayGroup, DayHeader } from "@/components/mealPlan";
import { useTabBarScroll } from "@/lib/tabBarContext";

interface DaySection {
  date: Date;
  dateString: string;
  isToday: boolean;
  data: [{ date: Date; dateString: string; isToday: boolean }];
}

// Constants
const HEADER_HEIGHT = 52; // Height of the title row

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

  // Scroll tracking for header fade
  const titleOpacity = useSharedValue(1);
  const headerButtonsOpacity = useSharedValue(1);

  // Animated styles for header fade
  const titleAnimatedStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
  }));

  const headerButtonsAnimatedStyle = useAnimatedStyle(() => ({
    opacity: headerButtonsOpacity.value,
  }));

  // Scroll handler with header fade
  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = event.nativeEvent.contentOffset.y;

      // Fade out when scrolling past the header
      const titleShouldHide = y > 5;
      titleOpacity.value = withTiming(titleShouldHide ? 0 : 1, {
        duration: 150,
      });

      const buttonsShouldHide = y > 10;
      headerButtonsOpacity.value = withTiming(buttonsShouldHide ? 0 : 1, {
        duration: 150,
      });

      // Also handle tab bar visibility
      onTabBarScroll(event);
    },
    [titleOpacity, headerButtonsOpacity, onTabBarScroll],
  );

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
    // Default to first plan (should be the default plan)
    return mealPlans[0];
  }, [mealPlans]);

  const { data: entries } = useGetMealPlanEntries({
    mealPlanId: activePlan?.id ?? 0,
    startDate: formatDateString(startDate),
    endDate: formatDateString(endDate),
    enabled: !!activePlan,
  });

  const { data: shareStatus } = useGetShareStatus({
    mealPlanId: activePlan?.id ?? 0,
    enabled: !!activePlan,
  });

  const { data: userData } = useUser();
  const currentUser = userData?.user;

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

  const handleMealSlotDelete = useCallback(
    (dateString: string, mealType: "breakfast" | "lunch" | "dinner") => {
      const entry = entriesByDate.get(dateString)?.get(mealType);
      if (entry) {
        removeEntry.mutate({ entryId: entry.id });
      }
    },
    [entriesByDate, removeEntry],
  );

  // Build list of users who can edit (current user + shared users with edit permission)
  const editableUsers = useMemo(() => {
    const users: { id: string; name: string; image?: string | null }[] = [];

    // Add current user first
    if (currentUser) {
      users.push({
        id: currentUser.id,
        name: currentUser.name,
        image: currentUser.image,
      });
    }

    // Add shared users who can edit
    if (shareStatus) {
      shareStatus
        .filter((status) => status.canEdit)
        .forEach((status) => {
          users.push({
            id: status.userId,
            name: status.userName,
            image: status.userImage,
          });
        });
    }

    return users;
  }, [currentUser, shareStatus]);

  const handleOpenSharedUsers = useCallback(() => {
    if (!activePlan) return;

    // If no one is shared yet, open the share sheet directly
    if (!shareStatus || shareStatus.length === 0) {
      SheetManager.show("meal-plan-share-sheet", {
        payload: {
          mealPlanId: activePlan.id,
          planName: activePlan.name,
        },
      });
    } else {
      // Otherwise show the shared users sheet
      SheetManager.show("shared-users-sheet", {
        payload: {
          mealPlanId: activePlan.id,
          planName: activePlan.name,
          sharedUsers: shareStatus,
          isOwner: activePlan.isOwner,
        },
      });
    }
  }, [activePlan, shareStatus]);

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
          onMealDelete={(mealType) =>
            handleMealSlotDelete(item.dateString, mealType)
          }
        />
      );
    },
    [entriesByDate, activePlan, handleMealSlotPress, handleMealSlotDelete],
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

  const insets = UnistylesRuntime.insets;

  if (isLoadingPlans) {
    return (
      <View style={styles.container}>
        <View style={styles.fixedHeader}>
          <Text type="screenTitle">Meal Plan</Text>
        </View>
        <View
          style={[
            styles.loadingContainer,
            { paddingTop: insets.top + HEADER_HEIGHT },
          ]}
        >
          <Text type="bodyFaded">Loading...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Calendar - wrapped with top padding so sticky headers stop 8px below safe area */}
      <View style={{ flex: 1, paddingTop: insets.top - 8 }}>
        <SectionList
          ref={sectionListRef}
          sections={sections}
          keyExtractor={(item) => item.dateString}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          renderSectionFooter={renderSectionFooter}
          ListHeaderComponent={<View style={{ height: HEADER_HEIGHT }} />}
          stickySectionHeadersEnabled
          contentContainerStyle={styles.listContent}
          onScroll={handleScroll}
          scrollEventThrottle={16}
        />
      </View>

      {/* Fixed Header */}
      <View style={styles.fixedHeader}>
        <View style={styles.headerRow}>
          <Animated.View style={titleAnimatedStyle}>
            <Text type="screenTitle">Meal Plan</Text>
          </Animated.View>
          <Animated.View style={headerButtonsAnimatedStyle}>
            <View style={styles.headerButtons}>
              {editableUsers.length > 0 && (
                <TouchableOpacity
                  style={styles.inviteStack}
                  activeOpacity={0.7}
                  onPress={handleOpenSharedUsers}
                >
                  <View style={styles.inviteIconWrapper}>
                    <Ionicons
                      name="people"
                      size={20}
                      color={theme.colors.textSecondary}
                    />
                  </View>
                  <View style={styles.stackedAvatarsWrapper}>
                    <StackedAvatars
                      users={editableUsers}
                      maxVisible={3}
                      size={44}
                    />
                  </View>
                </TouchableOpacity>
              )}
            </View>
          </Animated.View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create((theme, rt) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  fixedHeader: {
    position: "absolute",
    top: rt.insets.top,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
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
  inviteStack: {
    flexDirection: "row",
    alignItems: "center",
    height: 44,
  },
  inviteIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: theme.colors.background,
    backgroundColor: theme.colors.inputBackground,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  stackedAvatarsWrapper: {
    marginLeft: -22,
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
