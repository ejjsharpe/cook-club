import { Ionicons } from "@expo/vector-icons";
import { useIsFocused, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  FlashList,
  type FlashListRef,
  type ListRenderItemInfo,
} from "@shopify/flash-list";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, TouchableOpacity } from "react-native";
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
import { MealPlanSkeleton } from "@/components/Skeleton";
import { StackedAvatars } from "@/components/StackedAvatars";
import { Text } from "@/components/Text";
import { DayGroup, DayHeader } from "@/components/mealPlan";
import {
  MealPlanPickerSheet,
  type MealPlanPickerSheetRef,
} from "@/components/mealPlan/MealPlanPickerSheet";
import {
  MealPlanShareSheet,
  type MealPlanShareSheetRef,
} from "@/components/mealPlan/MealPlanShareSheet";
import {
  RecipePickerSheet,
  type RecipePickerSheetRef,
} from "@/components/mealPlan/RecipePickerSheet";
import {
  SharedUsersSheet,
  type SharedUsersSheetRef,
} from "@/components/mealPlan/SharedUsersSheet";
import {
  useMealPlanDates,
  type MealPlanListItem,
} from "@/hooks/useMealPlanDates";
import { useSelectedMealPlan } from "@/lib/mealPlanPreferences";

// Constants
const HEADER_HEIGHT = 52; // Height of the title row

export const MealPlanScreen = () => {
  const { theme } = useUnistyles();
  const navigation =
    useNavigation<NativeStackNavigationProp<ReactNavigation.RootParamList>>();
  const insets = UnistylesRuntime.insets;

  // Refs
  const flashListRef = useRef<FlashListRef<MealPlanListItem>>(null);

  // Sheet refs
  const recipePickerSheetRef = useRef<RecipePickerSheetRef>(null);
  const shareSheetRef = useRef<MealPlanShareSheetRef>(null);
  const sharedUsersSheetRef = useRef<SharedUsersSheetRef>(null);
  const mealPlanPickerSheetRef = useRef<MealPlanPickerSheetRef>(null);

  // State for recipe picker props
  const [recipePickerProps, setRecipePickerProps] = useState<{
    mealPlanId?: number;
    date?: string;
    mealType?: "breakfast" | "lunch" | "dinner";
  }>({});

  // Reactive meal plan selection from MMKV
  const {
    selectedPlan: storedPlan,
    setSelectedPlan,
    clearSelectedPlan,
  } = useSelectedMealPlan();

  // Queries
  const { data: mealPlans, isLoading: isLoadingPlans } = useGetMealPlans();
  const activePlan = useMemo(() => {
    if (!mealPlans || mealPlans.length === 0) return null;

    // Check if stored plan is still valid
    if (storedPlan !== null) {
      const foundPlan = mealPlans.find((p) => p.id === storedPlan.id);
      if (foundPlan) {
        return foundPlan;
      }
      // Stored plan no longer valid (deleted/unshared), clear it
      clearSelectedPlan();
    }

    // Fall back to default plan or first plan
    const defaultPlan = mealPlans.find((p) => p.isDefault);
    return defaultPlan ?? mealPlans[0];
  }, [mealPlans, storedPlan, clearSelectedPlan]);

  // Date range management and infinite scroll
  const {
    startDateString,
    endDateString,
    loadMorePast,
    loadMoreFuture,
    flattenedData,
    todayHeaderIndex,
    DAY_HEADER_HEIGHT,
    DAY_CONTENT_HEIGHT,
    DAY_FOOTER_HEIGHT,
  } = useMealPlanDates();

  const { data: entries, isFetched: entriesFetched } = useGetMealPlanEntries({
    mealPlanId: activePlan?.id ?? 0,
    startDate: startDateString,
    endDate: endDateString,
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

  // Handlers - now stable since DayGroup handles dateString internally
  const handleMealSlotPress = useCallback(
    (dateString: string, mealType: "breakfast" | "lunch" | "dinner") => {
      const entry = entriesByDate.get(dateString)?.get(mealType);
      if (entry) {
        navigation.navigate("RecipeDetail", { recipeId: entry.recipeId });
      } else if (activePlan) {
        setRecipePickerProps({
          mealPlanId: activePlan.id,
          date: dateString,
          mealType,
        });
        recipePickerSheetRef.current?.present();
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

  // Build list of users who can edit (current user + all shared users)
  const editableUsers = useMemo(() => {
    const users: { id: string; name: string; image?: string | null }[] = [];

    if (currentUser) {
      users.push({
        id: currentUser.id,
        name: currentUser.name,
        image: currentUser.image,
      });
    }

    if (shareStatus) {
      shareStatus.forEach((status) => {
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

    if (!shareStatus || shareStatus.length === 0) {
      shareSheetRef.current?.present();
    } else {
      sharedUsersSheetRef.current?.present();
    }
  }, [activePlan, shareStatus]);

  const handleManageSharing = useCallback(() => {
    shareSheetRef.current?.present();
  }, []);

  const handleSelectMealPlan = useCallback(
    (planId: number) => {
      const plan = mealPlans?.find((p) => p.id === planId);
      if (plan) {
        setSelectedPlan(planId, plan.name);
      }
    },
    [mealPlans, setSelectedPlan],
  );

  const handleOpenMealPlanPicker = useCallback(() => {
    mealPlanPickerSheetRef.current?.present();
  }, []);

  // Render item based on type
  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<MealPlanListItem>) => {
      switch (item.type) {
        case "header":
          return <DayHeader date={item.date} isToday={item.isToday} />;

        case "content": {
          const dayEntries = entriesByDate.get(item.dateString);
          // All users with access can edit (owners and shared users)
          const canEdit = !!activePlan;

          return (
            <DayGroup
              dateString={item.dateString}
              entries={dayEntries}
              canEdit={canEdit}
              onMealPress={handleMealSlotPress}
              onMealDelete={handleMealSlotDelete}
            />
          );
        }

        case "footer":
          return <View style={styles.sectionFooter} />;
      }
    },
    [entriesByDate, activePlan, handleMealSlotPress, handleMealSlotDelete],
  );

  // Item type for FlashList recycling optimization
  const getItemType = useCallback((item: MealPlanListItem) => item.type, []);

  // Key extractor
  const keyExtractor = useCallback((item: MealPlanListItem) => item.id, []);

  // Override item layout for proper sizing
  const overrideItemLayout = useCallback(
    (layout: { size?: number; span?: number }, item: MealPlanListItem) => {
      switch (item.type) {
        case "header":
          layout.size = DAY_HEADER_HEIGHT;
          break;
        case "content":
          layout.size = DAY_CONTENT_HEIGHT;
          break;
        case "footer":
          layout.size = DAY_FOOTER_HEIGHT;
          break;
      }
    },
    [DAY_HEADER_HEIGHT, DAY_CONTENT_HEIGHT, DAY_FOOTER_HEIGHT],
  );

  // Bi-directional infinite scroll handlers
  const handleStartReached = useCallback(() => {
    loadMorePast();
  }, [loadMorePast]);

  const handleEndReached = useCallback(() => {
    loadMoreFuture();
  }, [loadMoreFuture]);

  // Scroll to today helper
  const scrollToToday = useCallback(
    (animated = true) => {
      if (todayHeaderIndex < 0) return;

      flashListRef.current?.scrollToIndex({
        index: todayHeaderIndex,
        animated,
        viewOffset: -(insets.top + HEADER_HEIGHT),
      });
    },
    [todayHeaderIndex, insets.top],
  );
  const isFocused = useIsFocused();

  useEffect(() => {
    //  @ts-expect-error navigation type
    const unsubscribe = navigation.addListener("tabPress", () => {
      if (isFocused) {
        scrollToToday(true);
      }
    });

    return unsubscribe;
  }, [navigation, scrollToToday, isFocused]);

  // List header component - includes safe area top + header height
  const ListHeaderComponent = useMemo(
    () => <View style={{ height: insets.top + HEADER_HEIGHT }} />,
    [insets.top],
  );

  if (isLoadingPlans) {
    return (
      <View style={styles.container}>
        <View style={styles.fixedHeader}>
          <LinearGradient
            colors={[theme.colors.background, `${theme.colors.background}00`]}
            style={styles.headerGradient}
            pointerEvents="none"
          />
          <View style={styles.headerRow}>
            <View style={styles.titleButton}>
              <Text type="screenTitle">{storedPlan?.name ?? "Meal Plan"}</Text>
              <Ionicons
                name="chevron-down"
                size={20}
                color={theme.colors.text}
                style={styles.titleChevron}
              />
            </View>
          </View>
        </View>
        <View style={{ paddingTop: insets.top + HEADER_HEIGHT }}>
          <MealPlanSkeleton />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Calendar */}
      <View style={styles.listContainer}>
        <FlashList
          ref={flashListRef}
          data={flattenedData}
          renderItem={renderItem}
          getItemType={getItemType}
          keyExtractor={keyExtractor}
          overrideItemLayout={overrideItemLayout}
          onStartReached={handleStartReached}
          onStartReachedThreshold={0.5}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.5}
          maintainVisibleContentPosition={{ disabled: false }}
          ListHeaderComponent={ListHeaderComponent}
          contentContainerStyle={styles.listContent}
          initialScrollIndexParams={{
            viewOffset: -(insets.top + HEADER_HEIGHT),
          }}
          initialScrollIndex={
            todayHeaderIndex >= 0 ? todayHeaderIndex : undefined
          }
        />
      </View>

      {/* Fixed Header with Gradient */}
      <View style={styles.fixedHeader}>
        <LinearGradient
          colors={[theme.colors.background, `${theme.colors.background}00`]}
          style={styles.headerGradient}
          pointerEvents="none"
        />
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.titleButton}
            onPress={handleOpenMealPlanPicker}
            activeOpacity={0.7}
          >
            <Text type="screenTitle">{activePlan?.name ?? "Meal Plan"}</Text>
            <Ionicons
              name="chevron-down"
              size={20}
              color={theme.colors.text}
              style={styles.titleChevron}
            />
          </TouchableOpacity>
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
        </View>
      </View>

      {/* Sheets */}
      <RecipePickerSheet
        ref={recipePickerSheetRef}
        mealPlanId={recipePickerProps.mealPlanId}
        date={recipePickerProps.date}
        mealType={recipePickerProps.mealType}
      />
      <MealPlanShareSheet
        ref={shareSheetRef}
        mealPlanId={activePlan?.id}
        planName={activePlan?.name}
      />
      <SharedUsersSheet
        ref={sharedUsersSheetRef}
        mealPlanId={activePlan?.id}
        planName={activePlan?.name}
        sharedUsers={shareStatus}
        isOwner={activePlan?.isOwner}
        onManageSharing={handleManageSharing}
      />
      <MealPlanPickerSheet
        ref={mealPlanPickerSheetRef}
        activePlanId={activePlan?.id}
        onSelectPlan={handleSelectMealPlan}
      />
    </View>
  );
};

const styles = StyleSheet.create((theme, rt) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  listContainer: {
    flex: 1,
  },
  fixedHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingTop: rt.insets.top,
    paddingHorizontal: 20,
  },
  headerGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: rt.insets.top + 72,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  titleButton: {
    flexDirection: "row",
    alignItems: "center",
  },
  titleChevron: {
    marginLeft: 4,
    marginTop: 2,
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
    paddingBottom: 100,
  },
  sectionFooter: {
    height: 16,
  },
}));
