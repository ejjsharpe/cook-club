import { useRef } from "react";
import { View, TouchableOpacity, LayoutChangeEvent } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { StyleSheet } from "react-native-unistyles";

import { Text } from "./Text";

export interface TabOption<T extends string> {
  value: T;
  label: string;
}

interface UnderlineTabBarProps<T extends string> {
  options: TabOption<T>[];
  value: T;
  onValueChange: (value: T, direction: number) => void;
}

const animationConfig = {
  duration: 250,
  easing: Easing.bezier(0.4, 0, 0.2, 1),
};

export function UnderlineTabBar<T extends string>({
  options,
  value,
  onValueChange,
}: UnderlineTabBarProps<T>) {
  // Store the position and width of each tab
  const tabPositions = useRef<{ x: number; width: number }[]>([]);
  const underlineX = useSharedValue(0);
  const underlineWidth = useSharedValue(0);
  const isInitialized = useRef(false);
  const currentIndex = useRef(0);

  const activeIndex = options.findIndex((opt) => opt.value === value);

  const handleTabLayout = (index: number, event: LayoutChangeEvent) => {
    const { x, width } = event.nativeEvent.layout;
    tabPositions.current[index] = { x, width };

    // Set initial position without animation when the active tab is laid out
    if (index === activeIndex && !isInitialized.current) {
      underlineX.value = x;
      underlineWidth.value = width;
      currentIndex.current = index;
      isInitialized.current = true;
    }
  };

  const handlePress = (optionValue: T, index: number) => {
    const position = tabPositions.current[index];
    if (position) {
      underlineX.value = withTiming(position.x, animationConfig);
      underlineWidth.value = withTiming(position.width, animationConfig);
    }

    // Calculate direction: 1 = moving right, -1 = moving left
    const direction = index > currentIndex.current ? 1 : -1;
    currentIndex.current = index;

    onValueChange(optionValue, direction);
  };

  const underlineStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: underlineX.value }],
    width: underlineWidth.value,
  }));

  return (
    <View style={styles.container}>
      {options.map((option, index) => (
        <TouchableOpacity
          key={option.value}
          style={styles.tab}
          onPress={() => handlePress(option.value, index)}
          onLayout={(e) => handleTabLayout(index, e)}
          activeOpacity={0.7}
        >
          <Text
            type="heading"
            style={[styles.text, value === option.value && styles.textActive]}
          >
            {option.label}
          </Text>
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
  tab: {
    paddingBottom: 8,
  },
  text: {
    fontSize: 16,
    color: theme.colors.text,
    opacity: 0.4,
  },
  textActive: {
    opacity: 1,
  },
  underline: {
    position: "absolute",
    bottom: 0,
    height: 2,
    backgroundColor: theme.colors.text,
    borderRadius: 1,
  },
}));
