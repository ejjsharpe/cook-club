import { View } from "react-native";
import { StyleSheet } from "react-native-unistyles";

import { AutocompleteTagSelector } from "@/components/AutocompleteTagSelector";
import { VSpace } from "@/components/Space";
import { Text } from "@/components/Text";

interface Props {
  selected: number[];
  onToggle: (tagId: number) => void;
}

export const OnboardingStepDietary = ({ selected, onToggle }: Props) => {
  return (
    <View style={styles.container}>
      <Text type="largeTitle" style={styles.title}>
        Any dietary requirements?
      </Text>
      <VSpace size={12} />
      <Text type="bodyFaded" style={styles.subtitle}>
        We'll help you find recipes that fit your lifestyle
      </Text>
      <VSpace size={32} />

      <View style={styles.section}>
        <Text type="heading" style={styles.sectionTitle}>
          Your dietary preferences
        </Text>
        <VSpace size={12} />
        <AutocompleteTagSelector
          tagType="dietary"
          selectedIds={selected}
          onToggle={onToggle}
          placeholder="Search (e.g., Vegetarian, Gluten-Free)"
          variant="default"
        />
      </View>

      <VSpace size={24} />

      <View style={styles.infoBox}>
        <Text type="caption" style={styles.infoText}>
          You can always update these preferences later in your profile
          settings.
        </Text>
      </View>
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
  section: {},
  sectionTitle: {
    marginLeft: 4,
  },
  infoBox: {
    backgroundColor: theme.colors.primary + "10",
    padding: 16,
    borderRadius: theme.borderRadius.medium,
  },
  infoText: {
    textAlign: "center",
    opacity: 0.8,
  },
}));
