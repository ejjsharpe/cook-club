import { useRef, useEffect } from "react";
import { View, TouchableOpacity, LayoutChangeEvent } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  SharedValue,
  interpolate,
  useDerivedValue,
  interpolateColor,
} from "react-native-reanimated";
import { StyleSheet, UnistylesRuntime } from "react-native-unistyles";

import { Text } from "./Text";

// Animated tab text component
const AnimatedText = Animated.createAnimatedComponent(Text);

const AnimatedTabText = ({
  label,
  index,
  scrollProgress,
  activeIndex,
  totalTabs,
}: {
  label: string;
  index: number;
  scrollProgress: SharedValue<number> | undefined;
  activeIndex: number;
  totalTabs: number;
}) => {
  const theme = UnistylesRuntime.getTheme();

  const animatedStyle = useAnimatedStyle(() => {
    if (scrollProgress) {
      // Create input range for all tabs
      const inputRange = Array.from({ length: totalTabs }, (_, i) => i);
      // Output range: this tab is active (1) at its index, inactive (0) at others
      const outputRange = inputRange.map((i) => (i === index ? 1 : 0));

      const progress = interpolate(
        scrollProgress.value,
        inputRange,
        outputRange,
        "clamp",
      );

      return {
        color: interpolateColor(
          progress,
          [0, 1],
          [theme.colors.textSecondary, theme.colors.text],
        ),
      };
    }
    // Fallback to static color when no scrollProgress
    return {
      color: index === activeIndex ? theme.colors.text : theme.colors.textSecondary,
    };
  });

  return (
    <AnimatedText type="body" style={[tabTextStyles.text, animatedStyle]}>
      {label}
    </AnimatedText>
  );
};

export interface TabOption<T extends string> {
  value: T;
  label: string;
}

interface UnderlineTabBarProps<T extends string> {
  options: TabOption<T>[];
  value: T;
  onValueChange: (value: T, direction: number) => void;
  scrollProgress?: SharedValue<number>;
  fullWidth?: boolean;
}

const SPRING_CONFIG = {
  damping: 20,
  stiffness: 200,
  mass: 0.5,
};

export function UnderlineTabBar<T extends string>({
  options,
  value,
  onValueChange,
  scrollProgress,
  fullWidth = false,
}: UnderlineTabBarProps<T>) {
  const tabPositions = useRef<{ x: number; width: number }[]>([]);
  const indicatorX = useSharedValue(0);
  const indicatorWidth = useSharedValue(0);
  const isInitialized = useRef(false);
  const currentIndex = useRef(0);

  // Shared values for tab positions (for use in worklets)
  const tabXPositions = useSharedValue<number[]>([]);
  const tabWidths = useSharedValue<number[]>([]);

  const activeIndex = options.findIndex((opt) => opt.value === value);

  const handleTabLayout = (index: number, event: LayoutChangeEvent) => {
    const { x, width } = event.nativeEvent.layout;
    tabPositions.current[index] = { x, width };

    // Update shared values when all tabs are laid out
    if (tabPositions.current.length === options.length) {
      const allValid = tabPositions.current.every(
        (pos) => pos && pos.width > 0,
      );
      if (allValid) {
        tabXPositions.value = tabPositions.current.map((p) => p.x);
        tabWidths.value = tabPositions.current.map((p) => p.width);
      }
    }

    // Set initial position without animation when the active tab is laid out
    if (index === activeIndex && !isInitialized.current) {
      indicatorX.value = x;
      indicatorWidth.value = width;
      currentIndex.current = index;
      isInitialized.current = true;
    }
  };

  // Sync indicator position when value changes externally (e.g., from swipe completion)
  useEffect(() => {
    if (
      isInitialized.current &&
      activeIndex !== currentIndex.current &&
      !scrollProgress
    ) {
      const position = tabPositions.current[activeIndex];
      if (position) {
        indicatorX.value = withSpring(position.x, SPRING_CONFIG);
        indicatorWidth.value = withSpring(position.width, SPRING_CONFIG);
        currentIndex.current = activeIndex;
      }
    }
  }, [activeIndex, indicatorX, indicatorWidth, scrollProgress]);

  const handlePress = (optionValue: T, index: number) => {
    const position = tabPositions.current[index];
    if (position) {
      indicatorX.value = withSpring(position.x, SPRING_CONFIG);
      indicatorWidth.value = withSpring(position.width, SPRING_CONFIG);
    }

    const direction = index > currentIndex.current ? 1 : -1;
    currentIndex.current = index;

    onValueChange(optionValue, direction);
  };

  // Derived values for interpolated position when scrollProgress is provided
  const interpolatedX = useDerivedValue(() => {
    if (scrollProgress && tabXPositions.value.length >= 2) {
      const inputRange = tabXPositions.value.map((_, i) => i);
      return interpolate(
        scrollProgress.value,
        inputRange,
        tabXPositions.value,
        "clamp",
      );
    }
    return indicatorX.value;
  });

  const interpolatedWidth = useDerivedValue(() => {
    if (scrollProgress && tabWidths.value.length >= 2) {
      const inputRange = tabWidths.value.map((_, i) => i);
      return interpolate(
        scrollProgress.value,
        inputRange,
        tabWidths.value,
        "clamp",
      );
    }
    return indicatorWidth.value;
  });

  // Animated indicator style
  const indicatorStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: interpolatedX.value }],
      width: interpolatedWidth.value,
    };
  });

  return (
    <View style={[styles.container, fullWidth && styles.containerFullWidth]}>
      <Animated.View style={[styles.indicator, indicatorStyle]} />
      {options.map((option, index) => (
        <TouchableOpacity
          key={option.value}
          style={[styles.tab, fullWidth && styles.tabFullWidth]}
          onPress={() => handlePress(option.value, index)}
          onLayout={(e) => handleTabLayout(index, e)}
          activeOpacity={0.7}
        >
          <AnimatedTabText
            label={option.label}
            index={index}
            scrollProgress={scrollProgress}
            activeIndex={activeIndex}
            totalTabs={options.length}
          />
        </TouchableOpacity>
      ))}
    </View>
  );
}

const TAB_HEIGHT = 42;
const CONTAINER_PADDING = 4;

const styles = StyleSheet.create((theme) => ({
  container: {
    flexDirection: "row",
    alignSelf: "flex-start",
    position: "relative",
    backgroundColor: theme.colors.inputBackground,
    borderRadius: (TAB_HEIGHT + CONTAINER_PADDING * 2) / 2,
    padding: CONTAINER_PADDING,
  },
  containerFullWidth: {
    alignSelf: "stretch",
  },
  tab: {
    height: TAB_HEIGHT,
    justifyContent: "center",
    paddingHorizontal: 20,
    zIndex: 1,
  },
  tabFullWidth: {
    flex: 1,
    alignItems: "center",
  },
  indicator: {
    position: "absolute",
    top: CONTAINER_PADDING,
    bottom: CONTAINER_PADDING,
    backgroundColor: theme.colors.background,
    borderRadius: TAB_HEIGHT / 2,
    shadowColor: theme.colors.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
}));

const tabTextStyles = StyleSheet.create((theme) => ({
  text: {
    fontFamily: theme.fonts.albertSemiBold,
  },
}));
