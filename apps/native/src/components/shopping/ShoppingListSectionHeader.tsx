import { Ionicons } from "@expo/vector-icons";
import { memo } from "react";
import { View } from "react-native";
import Animated, {
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { StyleSheet } from "react-native-unistyles";

import { Text } from "@/components/Text";

interface SectionCheckProps {
  isComplete: boolean;
}

const SectionCheck = ({ isComplete }: SectionCheckProps) => {
  const scale = useSharedValue(isComplete ? 1 : 0);

  useAnimatedReaction(
    () => isComplete,
    (current, previous) => {
      if (current !== previous) {
        scale.value = withSpring(current ? 1 : 0, {
          damping: 50,
          stiffness: 300,
          mass: 2,
        });
      }
    },
    [isComplete],
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: scale.value,
  }));

  return (
    <Animated.View style={[styles.sectionCheck, animatedStyle]}>
      <Ionicons name="checkmark" size={14} style={styles.sectionCheckIcon} />
    </Animated.View>
  );
};

interface ShoppingListSectionHeaderProps {
  title: string;
  isComplete: boolean;
}

export const ShoppingListSectionHeader = memo(
  ({ title, isComplete }: ShoppingListSectionHeaderProps) => {
    return (
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <SectionCheck isComplete={isComplete} />
      </View>
    );
  },
);

ShoppingListSectionHeader.displayName = "ShoppingListSectionHeader";

const styles = StyleSheet.create((theme) => ({
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
    backgroundColor: theme.colors.background,
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: 20,
    fontFamily: theme.fonts.semiBold,
  },
  sectionCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: theme.colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  sectionCheckIcon: {
    color: theme.colors.buttonText,
  },
}));
