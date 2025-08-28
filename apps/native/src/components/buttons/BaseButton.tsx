import { Pressable, PressableProps, ViewStyle } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface BaseButtonProps {
  children: React.ReactNode;
  onPress: PressableProps['onPress'];
  disabled?: boolean;
  style?: PressableProps['style'];
}

export function BaseButton({ children, onPress, disabled, style }: BaseButtonProps) {
  const sv = useSharedValue(1);
  const animatedStyles = useAnimatedStyle(() => {
    return {
      transform: [{ scale: sv.value }],
      opacity: interpolate(sv.value, [0.97, 1], [0.7, 1]),
    };
  });

  const onPressIn = () => {
    sv.value = withSpring(0.97, {
      damping: 1,
      stiffness: 100,
      mass: 0.3,
    });
  };

  const onPressOut = () => {
    sv.value = withSpring(1, {
      damping: 1,
      stiffness: 200,
      mass: 0.3,
    });
  };

  return (
    <AnimatedPressable
      disabled={disabled}
      style={[style, animatedStyles]}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      onPress={onPress}>
      {children}
    </AnimatedPressable>
  );
}
