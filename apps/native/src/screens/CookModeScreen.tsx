import { Ionicons } from "@expo/vector-icons";
import { TrueSheet } from "@lodev09/react-native-true-sheet";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import { Image } from "expo-image";
import { useKeepAwake } from "expo-keep-awake";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { Text } from "@/components/Text";
import { getImageUrl } from "@/utils/imageUrl";

interface Instruction {
  id: number;
  instruction: string;
  imageUrl?: string | null;
}

interface Ingredient {
  id: number;
  quantity: string | null;
  unit: string | null;
  name: string;
  preparation: string | null;
}

interface IngredientSection {
  id: number;
  name: string | null;
  ingredients: Ingredient[];
}

interface InstructionSection {
  id: number;
  name: string | null;
  instructions: Instruction[];
}

type CookModeScreenParams = {
  CookMode: {
    recipeName: string;
    ingredientSections: IngredientSection[];
    instructionSections: InstructionSection[];
  };
};

type CookModeScreenRouteProp = RouteProp<CookModeScreenParams, "CookMode">;

interface FlattenedInstruction {
  id: number;
  stepNumber: number;
  instruction: string;
  imageUrl?: string | null;
  sectionName?: string | null;
  isFirstInSection: boolean;
}

interface InstructionListItemProps {
  item: FlattenedInstruction;
  index: number;
  itemHeight: number;
  scrollY: SharedValue<number>;
}

interface CookingTimer {
  remainingSeconds: number;
  endsAt: number | null;
  isPaused: boolean;
}

const TIMER_HOURS = Array.from({ length: 24 }, (_, index) => index);
const TIMER_MINUTES = Array.from({ length: 60 }, (_, index) => index);
const QUICK_TIMER_SHORTCUTS = [1, 5, 10, 20, 30];
const TIMER_WHEEL_ITEM_HEIGHT = 46;
const TIMER_WHEEL_VISIBLE_ITEMS = 5;
const TIMER_WHEEL_HEIGHT = TIMER_WHEEL_ITEM_HEIGHT * TIMER_WHEEL_VISIBLE_ITEMS;
const TIMER_WHEEL_VERTICAL_PADDING =
  (TIMER_WHEEL_HEIGHT - TIMER_WHEEL_ITEM_HEIGHT) / 2;

const InstructionListItem = ({
  item,
  index,
  itemHeight,
  scrollY,
}: InstructionListItemProps) => {
  const animatedStyle = useAnimatedStyle(() => {
    const center = index * itemHeight;
    const opacity = interpolate(
      scrollY.value,
      [center - itemHeight, center, center + itemHeight],
      [0.18, 1, 0.18],
      Extrapolation.CLAMP,
    );

    return { opacity };
  });

  return (
    <Animated.View
      style={[styles.instructionItem, { height: itemHeight }, animatedStyle]}
    >
      {item.sectionName && item.isFirstInSection && (
        <Text style={styles.sectionName}>{item.sectionName}</Text>
      )}

      <View style={styles.stepHeader}>
        <Text style={styles.stepNumber}>{item.stepNumber}</Text>
      </View>

      <Text style={styles.instructionText}>{item.instruction}</Text>

      {item.imageUrl && (
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: getImageUrl(item.imageUrl, "step-full") }}
            style={styles.instructionImage}
            contentFit="cover"
          />
        </View>
      )}
    </Animated.View>
  );
};

const formatIngredient = (ingredient: Ingredient) => {
  const parts = [
    ingredient.quantity,
    ingredient.unit,
    ingredient.name,
    ingredient.preparation,
  ].filter(Boolean);

  return parts.join(" ");
};

const formatTimer = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${remainingSeconds
      .toString()
      .padStart(2, "0")}`;
  }

  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
};

interface TimerWheelItemProps {
  index: number;
  value: number;
  scrollY: SharedValue<number>;
}

const TimerWheelItem = ({ index, value, scrollY }: TimerWheelItemProps) => {
  const animatedStyle = useAnimatedStyle(() => {
    const itemCenter = index * TIMER_WHEEL_ITEM_HEIGHT;
    const distance = Math.abs(scrollY.value - itemCenter);
    const opacity = interpolate(
      distance,
      [0, TIMER_WHEEL_ITEM_HEIGHT, TIMER_WHEEL_ITEM_HEIGHT * 2],
      [1, 0.58, 0.26],
      Extrapolation.CLAMP,
    );
    const scale = interpolate(
      distance,
      [0, TIMER_WHEEL_ITEM_HEIGHT * 2],
      [1, 0.94],
      Extrapolation.CLAMP,
    );

    return {
      opacity,
      transform: [{ scale }],
    };
  });

  return (
    <View style={styles.timerWheelItem}>
      <Animated.Text style={[styles.timerWheelItemText, animatedStyle]}>
        {value.toString().padStart(2, "0")}
      </Animated.Text>
    </View>
  );
};

interface TimerWheelProps {
  label: string;
  value: number;
  values: number[];
  onValueChange: (value: number) => void;
}

const TimerWheel = ({
  label,
  value,
  values,
  onValueChange,
}: TimerWheelProps) => {
  const listRef = useRef<FlatList<number>>(null);
  const hasMountedRef = useRef(false);
  const lastSettledIndexRef = useRef(-1);
  const wheelScrollY = useSharedValue(value * TIMER_WHEEL_ITEM_HEIGHT);

  useEffect(() => {
    if (lastSettledIndexRef.current === value) {
      return;
    }

    const offset = value * TIMER_WHEEL_ITEM_HEIGHT;

    lastSettledIndexRef.current = value;
    wheelScrollY.value = offset;
    listRef.current?.scrollToOffset({
      offset,
      animated: hasMountedRef.current,
    });
    hasMountedRef.current = true;
  }, [value, wheelScrollY]);

  const wheelScrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      wheelScrollY.value = event.contentOffset.y;
    },
  });

  const settleWheel = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const nextIndex = Math.min(
      Math.max(
        Math.round(event.nativeEvent.contentOffset.y / TIMER_WHEEL_ITEM_HEIGHT),
        0,
      ),
      values.length - 1,
    );
    const nextValue = values[nextIndex];

    if (nextValue === undefined) {
      return;
    }

    const nextOffset = nextIndex * TIMER_WHEEL_ITEM_HEIGHT;
    const isBetweenItems =
      Math.abs(event.nativeEvent.contentOffset.y - nextOffset) > 0.5;

    if (isBetweenItems) {
      wheelScrollY.value = nextOffset;
      listRef.current?.scrollToOffset({
        offset: nextOffset,
        animated: false,
      });
    }

    if (lastSettledIndexRef.current !== nextIndex) {
      lastSettledIndexRef.current = nextIndex;
      onValueChange(nextValue);
    }
  };

  const handleScrollEndDrag = (
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ) => {
    const velocity = (
      event.nativeEvent as NativeScrollEvent & {
        velocity?: { y?: number };
      }
    ).velocity?.y;

    if (velocity === undefined) {
      return;
    }

    if (Math.abs(velocity) <= 0.05) {
      settleWheel(event);
    }
  };

  return (
    <View style={styles.timerWheelColumn}>
      <View style={styles.timerWheelSelection} />
      <Animated.FlatList
        ref={listRef}
        data={values}
        renderItem={({ item, index }) => (
          <TimerWheelItem index={index} value={item} scrollY={wheelScrollY} />
        )}
        keyExtractor={(item) => item.toString()}
        style={styles.timerWheelList}
        contentContainerStyle={styles.timerWheelListContent}
        showsVerticalScrollIndicator={false}
        snapToInterval={TIMER_WHEEL_ITEM_HEIGHT}
        decelerationRate="fast"
        onScroll={wheelScrollHandler}
        onMomentumScrollEnd={settleWheel}
        onScrollEndDrag={handleScrollEndDrag}
        scrollEventThrottle={16}
        getItemLayout={(_, index) => ({
          length: TIMER_WHEEL_ITEM_HEIGHT,
          offset: TIMER_WHEEL_ITEM_HEIGHT * index,
          index,
        })}
      />
      <Text style={styles.timerWheelLabel}>{label}</Text>
    </View>
  );
};

export const CookModeScreen = () => {
  useKeepAwake();

  const route = useRoute() as CookModeScreenRouteProp;
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { theme } = useUnistyles();
  const { height: windowHeight } = useWindowDimensions();
  const scrollY = useSharedValue(0);
  const timerSheetRef = useRef<TrueSheet>(null);

  const { recipeName, ingredientSections, instructionSections } = route.params;

  const flattenedInstructions = useMemo(() => {
    const instructions: FlattenedInstruction[] = [];
    let globalStepNumber = 0;

    instructionSections.forEach((section) => {
      section.instructions.forEach((instruction, idx) => {
        globalStepNumber++;
        instructions.push({
          id: instruction.id,
          stepNumber: globalStepNumber,
          instruction: instruction.instruction,
          imageUrl: instruction.imageUrl,
          sectionName: section.name,
          isFirstInSection: idx === 0,
        });
      });
    });

    return instructions;
  }, [instructionSections]);

  const totalSteps = flattenedInstructions.length;
  const [ingredientsVisible, setIngredientsVisible] = useState(false);
  const [timerHours, setTimerHours] = useState(0);
  const [timerMinutes, setTimerMinutes] = useState(10);
  const [timer, setTimer] = useState<CookingTimer | null>(null);
  const selectedTimerDurationSeconds = timerHours * 60 * 60 + timerMinutes * 60;

  const itemHeight = Math.max(Math.min(windowHeight * 0.36, 350), 240);
  const centeredItemInset = Math.max((windowHeight - itemHeight) / 2, 0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  useEffect(() => {
    if (!timer?.endsAt || timer.isPaused) {
      return;
    }

    const endsAt = timer.endsAt;

    const tick = () => {
      const nextRemainingSeconds = Math.max(
        Math.ceil((endsAt - Date.now()) / 1000),
        0,
      );

      if (nextRemainingSeconds <= 0) {
        setTimer(null);
        Alert.alert("Timer done", "Your cook mode timer has finished.");
        return;
      }

      setTimer((currentTimer) => {
        if (!currentTimer || currentTimer.endsAt !== endsAt) {
          return currentTimer;
        }

        return {
          ...currentTimer,
          remainingSeconds: nextRemainingSeconds,
        };
      });
    };

    tick();
    const interval = setInterval(tick, 1000);

    return () => clearInterval(interval);
  }, [timer?.endsAt, timer?.isPaused]);

  const handleStartTimer = () => {
    const hours = timerHours;
    const minutes = timerMinutes;
    const durationSeconds = hours * 60 * 60 + minutes * 60;

    if (durationSeconds <= 0) {
      return;
    }

    setTimer({
      remainingSeconds: durationSeconds,
      endsAt: Date.now() + durationSeconds * 1000,
      isPaused: false,
    });
    setTimerHours(hours);
    setTimerMinutes(minutes);
    timerSheetRef.current?.dismiss();
  };

  const handleShortcutPress = (totalMinutes: number) => {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    setTimerHours(hours);
    setTimerMinutes(minutes);
  };

  const handlePauseTimer = () => {
    setTimer((currentTimer) => {
      if (!currentTimer?.endsAt) {
        return currentTimer;
      }

      return {
        ...currentTimer,
        remainingSeconds: Math.max(
          Math.ceil((currentTimer.endsAt - Date.now()) / 1000),
          0,
        ),
        endsAt: null,
        isPaused: true,
      };
    });
  };

  const handleResumeTimer = () => {
    setTimer((currentTimer) => {
      if (!currentTimer || !currentTimer.isPaused) {
        return currentTimer;
      }

      return {
        ...currentTimer,
        endsAt: Date.now() + currentTimer.remainingSeconds * 1000,
        isPaused: false,
      };
    });
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="close" size={28} style={styles.closeIcon} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text type="headline" numberOfLines={1} style={styles.headerTitle}>
            {recipeName}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.headerIconButton}
          onPress={() => timerSheetRef.current?.present()}
          accessibilityLabel="Set timer"
        >
          <Ionicons name="timer-outline" size={22} style={styles.closeIcon} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.ingredientsButton}
          onPress={() => setIngredientsVisible(true)}
        >
          <Ionicons
            name="list"
            size={18}
            style={styles.ingredientsButtonIcon}
          />
          <Text style={styles.ingredientsButtonText}>Ingredients</Text>
        </TouchableOpacity>
      </View>

      {totalSteps > 0 ? (
        <Animated.FlatList
          data={flattenedInstructions}
          renderItem={({ item, index }) => (
            <InstructionListItem
              item={item}
              index={index}
              itemHeight={itemHeight}
              scrollY={scrollY}
            />
          )}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{
            paddingTop: centeredItemInset,
            paddingBottom: centeredItemInset,
          }}
          showsVerticalScrollIndicator={false}
          snapToInterval={itemHeight}
          decelerationRate="fast"
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          getItemLayout={(_, index) => ({
            length: itemHeight,
            offset: itemHeight * index,
            index,
          })}
        />
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.instructionText}>No instructions available.</Text>
        </View>
      )}

      {timer && (
        <View style={[styles.timerPanel, { bottom: insets.bottom + 16 }]}>
          <View style={styles.timerStatus}>
            <Ionicons name="timer-outline" size={18} style={styles.timerIcon} />
            <Text style={styles.timerText}>
              {formatTimer(timer.remainingSeconds)}
            </Text>
          </View>
          <View style={styles.timerControls}>
            <TouchableOpacity
              style={styles.timerControlButton}
              onPress={timer.isPaused ? handleResumeTimer : handlePauseTimer}
              accessibilityLabel={
                timer.isPaused ? "Resume timer" : "Pause timer"
              }
            >
              <Ionicons
                name={timer.isPaused ? "play" : "pause"}
                size={16}
                style={styles.timerControlIcon}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.timerControlButton}
              onPress={() => setTimer(null)}
              accessibilityLabel="Clear timer"
            >
              <Ionicons
                name="close"
                size={18}
                style={styles.timerControlIcon}
              />
            </TouchableOpacity>
          </View>
        </View>
      )}

      <TrueSheet
        ref={timerSheetRef}
        detents={["auto"]}
        grabber={false}
        backgroundColor={theme.colors.background}
        footer={
          <View
            style={[
              styles.timerSheetFooter,
              { paddingBottom: Math.max(insets.bottom, 12) },
            ]}
          >
            <TouchableOpacity
              style={[
                styles.startTimerButton,
                selectedTimerDurationSeconds <= 0 &&
                  styles.startTimerButtonDisabled,
              ]}
              onPress={handleStartTimer}
              disabled={selectedTimerDurationSeconds <= 0}
              activeOpacity={0.82}
            >
              <Ionicons name="timer" size={20} style={styles.startTimerIcon} />
              <Text style={styles.startTimerText}>Start timer</Text>
            </TouchableOpacity>
          </View>
        }
      >
        <View style={styles.timerSheetContent}>
          <View style={styles.timerSheetHeader}>
            <Text type="headline" style={styles.ingredientsSheetTitle}>
              Timer
            </Text>
            <TouchableOpacity
              style={styles.sheetCloseButton}
              onPress={() => timerSheetRef.current?.dismiss()}
            >
              <Ionicons name="close" size={24} style={styles.closeIcon} />
            </TouchableOpacity>
          </View>
          <View style={styles.timerSheetBody}>
            <View style={styles.timerControlGroup}>
              <View style={styles.timerPicker}>
                <TimerWheel
                  label="hours"
                  value={timerHours}
                  values={TIMER_HOURS}
                  onValueChange={setTimerHours}
                />
                <TimerWheel
                  label="min"
                  value={timerMinutes}
                  values={TIMER_MINUTES}
                  onValueChange={setTimerMinutes}
                />
              </View>
            </View>

            <View style={styles.timerShortcuts}>
              {QUICK_TIMER_SHORTCUTS.map((minutes) => {
                const hoursValue = Math.floor(minutes / 60);
                const minutesValue = minutes % 60;
                const isSelected =
                  timerHours === hoursValue && timerMinutes === minutesValue;

                return (
                  <TouchableOpacity
                    key={minutes}
                    style={[
                      styles.timerShortcutButton,
                      isSelected && styles.timerShortcutButtonSelected,
                    ]}
                    onPress={() => handleShortcutPress(minutes)}
                  >
                    <Text
                      style={[
                        styles.timerShortcutText,
                        isSelected && styles.timerShortcutTextSelected,
                      ]}
                    >
                      {minutes}m
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </TrueSheet>

      <Modal
        visible={ingredientsVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIngredientsVisible(false)}
      >
        <View style={styles.ingredientsSheet}>
          <View
            style={[
              styles.ingredientsSheetHeader,
              { paddingTop: insets.top + 8 },
            ]}
          >
            <Text type="headline" style={styles.ingredientsSheetTitle}>
              Ingredients
            </Text>
            <TouchableOpacity
              style={styles.sheetCloseButton}
              onPress={() => setIngredientsVisible(false)}
            >
              <Ionicons name="close" size={24} style={styles.closeIcon} />
            </TouchableOpacity>
          </View>
          <ScrollView
            contentInsetAdjustmentBehavior="automatic"
            contentContainerStyle={[
              styles.ingredientsList,
              { paddingBottom: insets.bottom + 24 },
            ]}
          >
            {ingredientSections.map((section) => (
              <View key={section.id} style={styles.ingredientsSection}>
                {section.name && (
                  <Text style={styles.ingredientsSectionTitle}>
                    {section.name}
                  </Text>
                )}
                {section.ingredients.map((ingredient) => (
                  <View key={ingredient.id} style={styles.ingredientRow}>
                    <View style={styles.ingredientBullet} />
                    <Text style={styles.ingredientText}>
                      {formatIngredient(ingredient)}
                    </Text>
                  </View>
                ))}
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create((theme) => ({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: "transparent",
  },
  closeButton: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  closeIcon: {
    color: theme.colors.text,
  },
  headerTitleContainer: {
    flex: 1,
    paddingHorizontal: 8,
  },
  headerTitle: {
    textAlign: "left",
  },
  ingredientsButton: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.inputBackground,
  },
  ingredientsButtonIcon: {
    color: theme.colors.text,
  },
  ingredientsButtonText: {
    fontSize: 13,
    fontFamily: theme.fonts.semiBold,
    color: theme.colors.text,
  },
  headerIconButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.inputBackground,
    marginRight: 8,
  },
  instructionItem: {
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 18,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  sectionName: {
    fontSize: 14,
    textTransform: "uppercase",
    color: theme.colors.textSecondary,
    letterSpacing: 0,
    fontFamily: theme.fonts.semiBold,
  },
  stepHeader: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
  },
  stepNumber: {
    fontSize: 42,
    lineHeight: 46,
    fontFamily: theme.fonts.bold,
    color: theme.colors.primary,
  },
  instructionText: {
    fontSize: 24,
    lineHeight: 34,
    color: theme.colors.text,
    fontFamily: theme.fonts.medium,
  },
  imageContainer: {
    width: "100%",
    aspectRatio: 1.55,
    overflow: "hidden",
    borderRadius: 8,
    borderCurve: "continuous",
    backgroundColor: theme.colors.inputBackground,
  },
  instructionImage: {
    width: "100%",
    height: "100%",
  },
  timerPanel: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 20,
    minHeight: 64,
    borderRadius: theme.borderRadius.extraLarge,
    borderCurve: "continuous",
    backgroundColor: theme.colors.text,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    boxShadow: "0 8px 28px rgba(0, 0, 0, 0.14)",
  },
  timerStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  timerIcon: {
    color: theme.colors.background,
  },
  timerText: {
    color: theme.colors.background,
    fontSize: 22,
    lineHeight: 28,
    fontFamily: theme.fonts.bold,
    fontVariant: ["tabular-nums"],
  },
  timerControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  timerControlButton: {
    width: 36,
    height: 36,
    borderRadius: theme.borderRadius.full,
    backgroundColor: "rgba(255, 255, 255, 0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  timerControlIcon: {
    color: theme.colors.background,
  },
  timerSheetHeader: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  ingredientsSheet: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  ingredientsSheetHeader: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  ingredientsSheetTitle: {
    flex: 1,
  },
  sheetCloseButton: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.inputBackground,
  },
  ingredientsList: {
    paddingHorizontal: 24,
    paddingTop: 24,
    gap: 28,
  },
  timerSheetContent: {
    paddingHorizontal: 24,
    paddingTop: 18,
    backgroundColor: theme.colors.background,
  },
  timerSheetBody: {
    gap: 18,
    paddingBottom: 80,
  },
  timerSheetFooter: {
    paddingHorizontal: 24,
  },
  timerControlGroup: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 18,
    borderRadius: theme.borderRadius.extraLarge,
    borderCurve: "continuous",
    backgroundColor: theme.colors.background,
  },
  timerPicker: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 18,
  },
  timerWheelColumn: {
    width: 126,
    height: TIMER_WHEEL_HEIGHT + 28,
    alignItems: "center",
  },
  timerWheelSelection: {
    position: "absolute",
    top: TIMER_WHEEL_VERTICAL_PADDING,
    left: 0,
    right: 0,
    height: TIMER_WHEEL_ITEM_HEIGHT,
    borderRadius: theme.borderRadius.medium,
    borderCurve: "continuous",
    backgroundColor: theme.colors.inputBackground,
  },
  timerWheelList: {
    width: "100%",
    height: TIMER_WHEEL_HEIGHT,
  },
  timerWheelListContent: {
    paddingVertical: TIMER_WHEEL_VERTICAL_PADDING,
  },
  timerWheelItem: {
    height: TIMER_WHEEL_ITEM_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  timerWheelItemText: {
    color: theme.colors.text,
    fontSize: 32,
    lineHeight: 38,
    fontFamily: theme.fonts.medium,
    fontVariant: ["tabular-nums"],
  },
  timerWheelLabel: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: theme.fonts.semiBold,
    textTransform: "uppercase",
    letterSpacing: 0,
    marginTop: 10,
  },
  timerShortcuts: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 10,
  },
  timerShortcutButton: {
    minHeight: 42,
    minWidth: 68,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.inputBackground,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  timerShortcutButtonSelected: {
    backgroundColor: theme.colors.primary,
  },
  timerShortcutText: {
    color: theme.colors.text,
    fontSize: 15,
    lineHeight: 20,
    fontFamily: theme.fonts.semiBold,
  },
  timerShortcutTextSelected: {
    color: theme.colors.buttonText,
  },
  startTimerButton: {
    minHeight: 54,
    borderRadius: theme.borderRadius.full,
    borderCurve: "continuous",
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  startTimerButtonDisabled: {
    opacity: 0.45,
  },
  startTimerIcon: {
    color: theme.colors.buttonText,
  },
  startTimerText: {
    color: theme.colors.buttonText,
    fontSize: 17,
    lineHeight: 22,
    fontFamily: theme.fonts.bold,
  },
  ingredientsSection: {
    gap: 14,
  },
  ingredientsSectionTitle: {
    fontSize: 14,
    textTransform: "uppercase",
    color: theme.colors.textSecondary,
    letterSpacing: 0,
    fontFamily: theme.fonts.semiBold,
  },
  ingredientRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  ingredientBullet: {
    width: 7,
    height: 7,
    marginTop: 9,
    borderRadius: 4,
    backgroundColor: theme.colors.primary,
  },
  ingredientText: {
    flex: 1,
    fontSize: 18,
    lineHeight: 26,
    color: theme.colors.text,
  },
}));
