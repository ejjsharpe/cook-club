import { View } from "react-native";
import Animated, {
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import { StyleSheet } from "react-native-unistyles";

interface Props {
  currentStep: number;
  totalSteps: number;
}

const SPRING_CONFIG = { damping: 20, stiffness: 90, mass: 0.8 };
const DOT_SIZE = 10;
const LINE_HEIGHT = 3;

function Dot({ active }: { active: boolean }) {
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(active ? 1.2 : 1, SPRING_CONFIG) }],
    opacity: withSpring(active ? 1 : 0.3, SPRING_CONFIG),
  }));

  return (
    <Animated.View
      style={[styles.dot, active && styles.dotActive, animatedStyle]}
    />
  );
}

function ConnectingLine({ filled }: { filled: boolean }) {
  const animatedFillStyle = useAnimatedStyle(() => ({
    width: withSpring(filled ? "100%" : "0%", SPRING_CONFIG),
  }));

  return (
    <View style={styles.lineTrack}>
      <Animated.View style={[styles.lineFill, animatedFillStyle]} />
    </View>
  );
}

export const OnboardingProgress = ({ currentStep, totalSteps }: Props) => {
  return (
    <View style={styles.container}>
      {Array.from({ length: totalSteps }, (_, i) => {
        const stepNum = i + 1;
        return (
          <View key={i} style={styles.segment}>
            <Dot active={stepNum <= currentStep} />
            {i < totalSteps - 1 && (
              <ConnectingLine filled={stepNum < currentStep} />
            )}
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create((theme) => ({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  segment: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: theme.colors.primary,
  },
  dotActive: {
    backgroundColor: theme.colors.primary,
  },
  lineTrack: {
    flex: 1,
    height: LINE_HEIGHT,
    backgroundColor: theme.colors.border,
    borderRadius: LINE_HEIGHT / 2,
    overflow: "hidden",
    marginHorizontal: 8,
  },
  lineFill: {
    height: "100%",
    backgroundColor: theme.colors.primary,
    borderRadius: LINE_HEIGHT / 2,
  },
}));
