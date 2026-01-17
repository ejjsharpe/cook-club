import { Ionicons } from "@expo/vector-icons";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { BlurView } from "expo-blur";
import { useEffect, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { StyleSheet, UnistylesRuntime } from "react-native-unistyles";

import { useTabBar } from "@/lib/tabBarContext";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type TabIconName = "home" | "add" | "calendar" | "book" | "cart";

const TAB_ICONS: Record<string, TabIconName> = {
  Home: "home",
  "Add recipe": "add",
  "Meal Plan": "calendar",
  "My Recipes": "book",
  "Shopping List": "cart",
};

const TAB_ITEM_SIZE = 48;
const TAB_BAR_PADDING_VERTICAL = 8;
const TAB_BAR_PADDING_HORIZONTAL = 8;
const TAB_BAR_MARGIN_HORIZONTAL = 20;
const TAB_BAR_BOTTOM_MARGIN = 16;
const INDICATOR_HORIZONTAL_INSET = 0; // Padding from edge of tab area

// Height of the floating tab bar (item + vertical padding)
export const FLOATING_TAB_BAR_HEIGHT =
  TAB_ITEM_SIZE + TAB_BAR_PADDING_VERTICAL * 2 + TAB_BAR_BOTTOM_MARGIN;

interface TabItemProps {
  routeName: string;
  isFocused: boolean;
  onPress: () => void;
  onLongPress: () => void;
}

const TabItem = ({
  routeName,
  isFocused,
  onPress,
  onLongPress,
}: TabItemProps) => {
  const theme = UnistylesRuntime.getTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.9, { damping: 8, stiffness: 100, mass: 0.4 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 8, stiffness: 100, mass: 0.4 });
  };

  const iconName = TAB_ICONS[routeName] ?? "home";

  return (
    <AnimatedPressable
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[styles.tabItem, animatedStyle]}
    >
      <View style={styles.iconContainer}>
        <Ionicons
          name={iconName}
          size={26}
          color={isFocused ? theme.colors.primary : theme.colors.textTertiary}
        />
      </View>
    </AnimatedPressable>
  );
};

interface SlidingIndicatorProps {
  activeIndex: number;
  tabCount: number;
  tabBarWidth: number;
}

const SlidingIndicator = ({
  activeIndex,
  tabCount,
  tabBarWidth,
}: SlidingIndicatorProps) => {
  // Calculate position based on tab item widths
  const contentWidth = tabBarWidth - TAB_BAR_PADDING_HORIZONTAL * 2;
  const tabWidth = contentWidth / tabCount;
  const indicatorWidth = tabWidth - INDICATOR_HORIZONTAL_INSET * 2;
  const initialX =
    TAB_BAR_PADDING_HORIZONTAL +
    activeIndex * tabWidth +
    INDICATOR_HORIZONTAL_INSET;

  const translateX = useSharedValue(initialX);
  const scaleX = useSharedValue(1);
  const scaleY = useSharedValue(1);
  const prevIndex = useRef(activeIndex);

  useEffect(() => {
    const targetX =
      TAB_BAR_PADDING_HORIZONTAL +
      activeIndex * tabWidth +
      INDICATOR_HORIZONTAL_INSET;
    const distance = Math.abs(activeIndex - prevIndex.current);

    if (distance > 0) {
      // Squash horizontally (stretch in direction of movement) and compress vertically
      const stretchAmount = Math.min(1 + distance * 0.15, 1.4);
      const squashAmount = 1 / Math.sqrt(stretchAmount); // Preserve area roughly

      scaleX.value = withSequence(
        withTiming(stretchAmount, { duration: 150 }),
        withSpring(1, { damping: 8, stiffness: 100, mass: 0.4 }),
      );
      scaleY.value = withSequence(
        withTiming(squashAmount, { duration: 150 }),
        withSpring(1, { damping: 8, stiffness: 100, mass: 0.4 }),
      );
    }

    translateX.value = withSpring(targetX, {
      damping: 8,
      stiffness: 100,
      mass: 0.4,
    });

    prevIndex.current = activeIndex;
  }, [activeIndex, tabWidth, translateX, scaleX, scaleY]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { scaleX: scaleX.value },
      { scaleY: scaleY.value },
    ],
  }));

  return (
    <Animated.View
      style={[
        styles.slidingIndicator,
        { width: indicatorWidth },
        animatedStyle,
      ]}
    />
  );
};

export const FloatingTabBar = ({ state, navigation }: BottomTabBarProps) => {
  const insets = UnistylesRuntime.insets;
  const [tabBarWidth, setTabBarWidth] = useState(0);
  const { isVisible } = useTabBar();

  const animatedContainerStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: withSpring(isVisible.value === 1 ? 0 : 100, {
          damping: 50,
          stiffness: 400,
          mass: 2,
        }),
      },
    ],
    opacity: withTiming(isVisible.value, { duration: 200 }),
  }));

  return (
    <Animated.View
      style={[
        styles.container,
        { bottom: Math.max(insets.bottom - 16, 16) },
        animatedContainerStyle,
      ]}
    >
      <BlurView
        intensity={60}
        tint={UnistylesRuntime.themeName === "dark" ? "dark" : "light"}
        style={styles.tabBar}
        onLayout={(e) => {
          setTabBarWidth(e.nativeEvent.layout.width);
        }}
      >
        {tabBarWidth > 0 && (
          <SlidingIndicator
            activeIndex={state.index}
            tabCount={state.routes.length}
            tabBarWidth={tabBarWidth}
          />
        )}
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          const onLongPress = () => {
            navigation.emit({
              type: "tabLongPress",
              target: route.key,
            });
          };

          return (
            <TabItem
              key={route.key}
              routeName={route.name}
              isFocused={isFocused}
              onPress={onPress}
              onLongPress={onLongPress}
            />
          );
        })}
      </BlurView>
    </Animated.View>
  );
};

const styles = StyleSheet.create((theme) => ({
  container: {
    position: "absolute",
    left: TAB_BAR_MARGIN_HORIZONTAL,
    right: TAB_BAR_MARGIN_HORIZONTAL,
  },
  tabBar: {
    flexDirection: "row",
    borderRadius: (TAB_ITEM_SIZE + TAB_BAR_PADDING_VERTICAL * 2) / 2,
    paddingVertical: TAB_BAR_PADDING_VERTICAL,
    paddingHorizontal: TAB_BAR_PADDING_HORIZONTAL,
    overflow: "hidden",
    backgroundColor: theme.colors.inputBackground + "CC",
    shadowColor: theme.colors.text,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  iconContainer: {
    width: TAB_ITEM_SIZE,
    height: TAB_ITEM_SIZE,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: TAB_ITEM_SIZE / 2,
  },
  slidingIndicator: {
    position: "absolute",
    left: 0,
    top: TAB_BAR_PADDING_VERTICAL,
    height: TAB_ITEM_SIZE,
    borderRadius: TAB_ITEM_SIZE / 2,
    backgroundColor: theme.colors.primary + "20",
  },
}));
