import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  FlashList,
  type FlashListRef,
  type ListRenderItemInfo,
} from "@shopify/flash-list";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, TouchableOpacity } from "react-native";
import Animated from "react-native-reanimated";
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
import { StackedAvatars } from "@/components/StackedAvatars";
import { Text } from "@/components/Text";
import { DayGroup, DayHeader } from "@/components/mealPlan";
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
import { useMealPlanHeader } from "@/hooks/useMealPlanHeader";

// Constants
const HEADER_HEIGHT = 52; // Height of the title row

export const MealPlanScreen = () => {
  const { theme } = useUnistyles();
  const navigation =
    useNavigation<NativeStackNavigationProp<ReactNavigation.RootParamList>>();
  const insets = UnistylesRuntime.insets;

  // Refs
  const flashListRef = useRef<FlashListRef<MealPlanListItem>>(null);
  const hasScrolledToToday = useRef(false);

  // Sheet refs
  const recipePickerSheetRef = useRef<RecipePickerSheetRef>(null);
  const shareSheetRef = useRef<MealPlanShareSheetRef>(null);
  const sharedUsersSheetRef = useRef<SharedUsersSheetRef>(null);

  // State for recipe picker props
  const [recipePickerProps, setRecipePickerProps] = useState<{
    mealPlanId?: number;
    date?: string;
    mealType?: "breakfast" | "lunch" | "dinner";
  }>({});

  // Queries
  const { data: mealPlans, isLoading: isLoadingPlans } = useGetMealPlans();
  const activePlan = useMemo(() => {
    if (!mealPlans || mealPlans.length === 0) return null;
    return mealPlans[0];
  }, [mealPlans]);

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

  // Header animations
  const { titleAnimatedStyle, headerButtonsAnimatedStyle, handleScroll } =
    useMealPlanHeader();

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

  // Build list of users who can edit (current user + shared users with edit permission)
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

    if (!shareStatus || shareStatus.length === 0) {
      shareSheetRef.current?.present();
    } else {
      sharedUsersSheetRef.current?.present();
    }
  }, [activePlan, shareStatus]);

  const handleManageSharing = useCallback(() => {
    shareSheetRef.current?.present();
  }, []);

  // Render item based on type
  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<MealPlanListItem>) => {
      switch (item.type) {
        case "header":
          return <DayHeader date={item.date} isToday={item.isToday} />;

        case "content": {
          const dayEntries = entriesByDate.get(item.dateString);
          const canEdit = activePlan?.canEdit ?? false;

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
        viewOffset: HEADER_HEIGHT,
      });
    },
    [todayHeaderIndex],
  );

  // Scroll to today when screen is focused and data is loaded
  useFocusEffect(
    useCallback(() => {
      if (!entriesFetched || todayHeaderIndex < 0) return;

      if (!hasScrolledToToday.current) {
        // Small delay to ensure list is laid out, no animation for initial scroll
        const timer = setTimeout(() => {
          scrollToToday(false);
          hasScrolledToToday.current = true;
        }, 100);
        return () => clearTimeout(timer);
      }
    }, [entriesFetched, todayHeaderIndex, scrollToToday]),
  );

  useEffect(() => {
    //  @ts-expect-error navigation type
    const unsubscribe = navigation.addListener("tabPress", () => {
      scrollToToday(true);
    });

    return unsubscribe;
  }, [navigation, scrollToToday]);

  // List header component
  const ListHeaderComponent = useMemo(
    () => <View style={{ height: HEADER_HEIGHT }} />,
    [],
  );

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
      {/* Calendar */}
      <View style={{ flex: 1, paddingTop: insets.top - 8 }}>
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
    paddingBottom: rt.insets.bottom + 100,
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
