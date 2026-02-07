import { View, Pressable } from "react-native";
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
} from "react-native-reanimated";
import { StyleSheet } from "react-native-unistyles";
import { useEffect } from "react";

import { VSpace } from "@/components/Space";
import { Text } from "@/components/Text";
import type { MeasurementSystem } from "@/lib/measurementPreferences";

interface Props {
  selected: MeasurementSystem;
  onSelect: (system: MeasurementSystem) => void;
}

const SPRING_CONFIG = { damping: 15, stiffness: 150, mass: 0.8 };

const options: { value: MeasurementSystem; label: string; description: string }[] = [
  {
    value: "metric",
    label: "Metric",
    description: "g, ml, °C",
  },
  {
    value: "imperial",
    label: "Imperial",
    description: "oz, cups, °F",
  },
  {
    value: "auto",
    label: "Use recipe original",
    description: "Keeps the recipe's original units",
  },
];

function MeasurementCard({
  option,
  isSelected,
  onPress,
}: {
  option: (typeof options)[number];
  isSelected: boolean;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);
  const selected = useSharedValue(isSelected ? 1 : 0);

  useEffect(() => {
    selected.value = withSpring(isSelected ? 1 : 0, SPRING_CONFIG);
  }, [isSelected, selected]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.97, SPRING_CONFIG);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, SPRING_CONFIG);
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Animated.View
        style={[
          styles.card,
          isSelected && styles.cardSelected,
          animatedStyle,
        ]}
      >
        <View style={styles.cardContent}>
          <Text type="heading" style={isSelected ? styles.cardLabelSelected : undefined}>
            {option.label}
          </Text>
          <VSpace size={4} />
          <Text type="bodyFaded">{option.description}</Text>
        </View>
        {isSelected && (
          <View style={styles.checkmark}>
            <Text style={styles.checkmarkText}>✓</Text>
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
}

export const OnboardingStepMeasurements = ({ selected, onSelect }: Props) => {
  return (
    <View style={styles.container}>
      <Text type="largeTitle" style={styles.title}>
        Measurement units
      </Text>
      <VSpace size={12} />
      <Text type="bodyFaded" style={styles.subtitle}>
        How would you like to see measurements?
      </Text>
      <VSpace size={32} />

      {options.map((option) => (
        <View key={option.value}>
          <MeasurementCard
            option={option}
            isSelected={selected === option.value}
            onPress={() => onSelect(option.value)}
          />
          <VSpace size={12} />
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create((theme) => ({
  container: {
    flex: 1,
  },
  title: {
    textAlign: "center",
  },
  subtitle: {
    textAlign: "center",
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 24,
    paddingHorizontal: 20,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.inputBackground,
  },
  cardSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary + "10",
  },
  cardContent: {
    flex: 1,
  },
  cardLabelSelected: {
    color: theme.colors.primary,
  },
  checkmark: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  checkmarkText: {
    color: theme.colors.buttonText,
    fontSize: 16,
    fontFamily: theme.fonts.semiBold,
  },
}));
