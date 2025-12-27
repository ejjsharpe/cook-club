import { View } from "react-native";
import Animated, {
  useAnimatedStyle,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { StyleSheet } from "react-native-unistyles";

interface Props {
  currentStep: number;
  totalSteps: number;
}

export const OnboardingProgress = ({ currentStep, totalSteps }: Props) => {
  const progressWidth = (currentStep / totalSteps) * 100;

  const animatedStyle = useAnimatedStyle(() => ({
    width: withTiming(`${progressWidth}%`, {
      duration: 300,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
    }),
  }));

  return (
    <View style={styles.container}>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, animatedStyle]} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create((theme) => ({
  container: {
    width: "100%",
    paddingHorizontal: 20,
  },
  track: {
    height: 4,
    backgroundColor: theme.colors.border,
    borderRadius: 2,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    backgroundColor: theme.colors.primary,
    borderRadius: 2,
  },
}));
