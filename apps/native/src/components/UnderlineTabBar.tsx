import { useRef, useEffect } from "react";
import { View, TouchableOpacity, LayoutChangeEvent } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  SharedValue,
  interpolate,
  useDerivedValue,
} from "react-native-reanimated";
import { StyleSheet } from "react-native-unistyles";

// Animated tab text component
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
  const animatedStyle = useAnimatedStyle(() => {
    if (scrollProgress) {
      // Create input range for all tabs
      const inputRange = Array.from({ length: totalTabs }, (_, i) => i);
      // Output range: this tab is active (opacity 1) at its index, inactive (0.4) at others
      const outputRange = inputRange.map((i) => (i === index ? 1 : 0.4));

      const opacity = interpolate(
        scrollProgress.value,
        inputRange,
        outputRange,
        "clamp",
      );
      return { opacity };
    }
    // Fallback to static opacity when no scrollProgress
    return { opacity: index === activeIndex ? 1 : 0.4 };
  });

  return (
    <Animated.Text style={[tabTextStyles.text, animatedStyle]}>
      {label}
    </Animated.Text>
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
  const underlineX = useSharedValue(0);
  const underlineWidth = useSharedValue(0);
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
      underlineX.value = x;
      underlineWidth.value = width;
      currentIndex.current = index;
      isInitialized.current = true;
    }
  };

  // Sync underline position when value changes externally (e.g., from swipe completion)
  useEffect(() => {
    if (
      isInitialized.current &&
      activeIndex !== currentIndex.current &&
      !scrollProgress
    ) {
      const position = tabPositions.current[activeIndex];
      if (position) {
        underlineX.value = withSpring(position.x, SPRING_CONFIG);
        underlineWidth.value = withSpring(position.width, SPRING_CONFIG);
        currentIndex.current = activeIndex;
      }
    }
  }, [activeIndex, underlineX, underlineWidth, scrollProgress]);

  const handlePress = (optionValue: T, index: number) => {
    const position = tabPositions.current[index];
    if (position) {
      underlineX.value = withSpring(position.x, SPRING_CONFIG);
      underlineWidth.value = withSpring(position.width, SPRING_CONFIG);
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
    return underlineX.value;
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
    return underlineWidth.value;
  });

  // Animated underline style
  const underlineStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: interpolatedX.value }],
      width: interpolatedWidth.value,
    };
  });

  return (
    <View style={[styles.container, fullWidth && styles.containerFullWidth]}>
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
      <Animated.View style={[styles.underline, underlineStyle]} />
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  container: {
    flexDirection: "row",
    position: "relative",
    gap: 24,
  },
  containerFullWidth: {
    gap: 0,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  tab: {
    paddingBottom: 12,
  },
  tabFullWidth: {
    flex: 1,
    alignItems: "center",
  },
  underline: {
    position: "absolute",
    bottom: 0,
    height: 2,
    backgroundColor: theme.colors.text,
    borderRadius: 1,
  },
}));

const tabTextStyles = StyleSheet.create((theme) => ({
  text: {
    fontSize: 16,
    color: theme.colors.text,
    fontFamily: theme.fonts.albertBold,
  },
}));
