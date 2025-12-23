import { Ionicons } from "@expo/vector-icons";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useEffect, useRef } from "react";
import { Pressable, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, UnistylesRuntime } from "react-native-unistyles";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type TabIconName = "home" | "add" | "book" | "list";

const TAB_ICONS: Record<string, TabIconName> = {
  Home: "home",
  "Add recipe": "add",
  "My Recipes": "book",
  "Shopping List": "list",
};

const TAB_ITEM_SIZE = 40;
const TAB_BAR_PADDING_VERTICAL = 8;
const TAB_BAR_BOTTOM_MARGIN = 16;

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
          size={24}
          color={isFocused ? theme.colors.primary : theme.colors.text}
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
  const tabWidth = tabBarWidth / tabCount;
  const indicatorOffset = (tabWidth - TAB_ITEM_SIZE) / 2;
  const initialX = activeIndex * tabWidth + indicatorOffset;

  const translateX = useSharedValue(initialX);
  const scaleX = useSharedValue(1);
  const scaleY = useSharedValue(1);
  const prevIndex = useRef(activeIndex);

  useEffect(() => {
    const targetX = activeIndex * tabWidth + indicatorOffset;
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
  }, [activeIndex, tabWidth, indicatorOffset, translateX, scaleX, scaleY]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { scaleX: scaleX.value },
      { scaleY: scaleY.value },
    ],
  }));

  return <Animated.View style={[styles.slidingIndicator, animatedStyle]} />;
};

export const FloatingTabBar = ({ state, navigation }: BottomTabBarProps) => {
  const insets = useSafeAreaInsets();
  const tabBarWidth = useSharedValue(0);

  return (
    <View style={[styles.container, { bottom: Math.max(insets.bottom, 16) }]}>
      <View
        style={styles.tabBar}
        onLayout={(e) => {
          tabBarWidth.value = e.nativeEvent.layout.width;
        }}
      >
        {tabBarWidth.value > 0 && (
          <SlidingIndicator
            activeIndex={state.index}
            tabCount={state.routes.length}
            tabBarWidth={tabBarWidth.value}
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
      </View>
    </View>
  );
};

const styles = StyleSheet.create((theme) => ({
  container: {
    position: "absolute",
    left: 80,
    right: 80,
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.full,
    paddingVertical: TAB_BAR_PADDING_VERTICAL,
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
    borderRadius: theme.borderRadius.full,
  },
  slidingIndicator: {
    position: "absolute",
    top: TAB_BAR_PADDING_VERTICAL,
    width: TAB_ITEM_SIZE,
    height: TAB_ITEM_SIZE,
    borderRadius: theme.borderRadius.full,
    backgroundColor: `${theme.colors.primary}20`,
  },
}));
