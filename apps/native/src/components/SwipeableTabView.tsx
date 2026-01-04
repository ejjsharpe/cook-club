import { ReactNode, useEffect } from "react";
import { View, Dimensions } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  SharedValue,
} from "react-native-reanimated";
import { StyleSheet } from "react-native-unistyles";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const SPRING_CONFIG = {
  damping: 20,
  stiffness: 200,
  mass: 0.5,
};

const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.2;
const VELOCITY_THRESHOLD = 500;

interface SwipeableTabViewProps {
  activeIndex: number;
  onIndexChange: (index: number) => void;
  children: ReactNode[];
  containerWidth?: number;
  scrollProgress?: SharedValue<number>;
}

export const SwipeableTabView = ({
  activeIndex,
  onIndexChange,
  children,
  containerWidth = SCREEN_WIDTH,
  scrollProgress,
}: SwipeableTabViewProps) => {
  const translateX = useSharedValue(-activeIndex * containerWidth);
  const startX = useSharedValue(0);
  const tabCount = children.length;

  // Sync translateX and scrollProgress when activeIndex changes externally (e.g., tab press)
  useEffect(() => {
    translateX.value = withSpring(-activeIndex * containerWidth, SPRING_CONFIG);
    if (scrollProgress) {
      scrollProgress.value = withSpring(activeIndex, SPRING_CONFIG);
    }
  }, [activeIndex, containerWidth, translateX, scrollProgress]);

  const panGesture = Gesture.Pan()
    // Only activate for horizontal swipes, allow vertical scrolling to pass through
    .activeOffsetX([-10, 10])
    .failOffsetY([-10, 10])
    .onStart(() => {
      startX.value = translateX.value;
    })
    .onUpdate((event) => {
      const newTranslateX = startX.value + event.translationX;
      // Clamp to prevent over-scrolling
      const minTranslate = -(tabCount - 1) * containerWidth;
      const maxTranslate = 0;
      translateX.value = Math.max(
        minTranslate,
        Math.min(maxTranslate, newTranslateX),
      );

      // Update scroll progress for synced tab bar animation
      if (scrollProgress) {
        scrollProgress.value = -translateX.value / containerWidth;
      }
    })
    .onEnd((event) => {
      const velocity = event.velocityX;
      const currentOffset = -translateX.value;
      const currentIndex = Math.round(currentOffset / containerWidth);

      let newIndex = currentIndex;

      // Determine if we should change tabs based on velocity or distance
      if (Math.abs(velocity) > VELOCITY_THRESHOLD) {
        // Velocity-based: flick to change
        if (velocity > 0 && currentIndex > 0) {
          newIndex = currentIndex - 1;
        } else if (velocity < 0 && currentIndex < tabCount - 1) {
          newIndex = currentIndex + 1;
        }
      } else {
        // Distance-based: snap to nearest
        const distanceFromCurrent =
          currentOffset - currentIndex * containerWidth;
        if (Math.abs(distanceFromCurrent) > SWIPE_THRESHOLD) {
          if (distanceFromCurrent > 0 && currentIndex < tabCount - 1) {
            newIndex = currentIndex + 1;
          } else if (distanceFromCurrent < 0 && currentIndex > 0) {
            newIndex = currentIndex - 1;
          }
        }
      }

      // Clamp newIndex
      newIndex = Math.max(0, Math.min(tabCount - 1, newIndex));

      // Animate to the new position
      translateX.value = withSpring(-newIndex * containerWidth, SPRING_CONFIG);

      // Animate scroll progress with spring
      if (scrollProgress) {
        scrollProgress.value = withSpring(newIndex, SPRING_CONFIG);
      }

      // Notify parent if index changed
      if (newIndex !== activeIndex) {
        onIndexChange(newIndex);
      }
    })
    .runOnJS(true);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <View style={styles.container}>
      <GestureDetector gesture={panGesture}>
        <Animated.View
          style={[
            styles.tabsContainer,
            { width: containerWidth * tabCount },
            animatedStyle,
          ]}
        >
          {children.map((child, index) => (
            <View
              key={index}
              style={[styles.tabContent, { width: containerWidth }]}
            >
              {child}
            </View>
          ))}
        </Animated.View>
      </GestureDetector>
    </View>
  );
};

const styles = StyleSheet.create(() => ({
  container: {
    flex: 1,
    overflow: "hidden",
  },
  tabsContainer: {
    flexDirection: "row",
    flex: 1,
  },
  tabContent: {
    flex: 1,
  },
}));
