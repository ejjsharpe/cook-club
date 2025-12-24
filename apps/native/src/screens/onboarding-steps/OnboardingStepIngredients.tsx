import { View } from "react-native";
import { StyleSheet } from "react-native-unistyles";

import { AutocompleteTagSelector } from "@/components/AutocompleteTagSelector";
import { VSpace } from "@/components/Space";
import { Text } from "@/components/Text";

interface Props {
  likes: number[];
  dislikes: number[];
  onToggleLike: (tagId: number) => void;
  onToggleDislike: (tagId: number) => void;
}

export const OnboardingStepIngredients = ({
  likes,
  dislikes,
  onToggleLike,
  onToggleDislike,
}: Props) => {
  return (
    <View style={styles.container}>
      <Text type="largeTitle" style={styles.title}>
        Any food preferences?
      </Text>
      <VSpace size={12} />
      <Text type="bodyFaded" style={styles.subtitle}>
        Tell us what you love and what to avoid
      </Text>
      <VSpace size={32} />

      {/* Likes Section */}
      <View style={styles.section}>
        <Text type="heading" style={styles.sectionTitle}>
          Ingredients you love
        </Text>
        <VSpace size={12} />
        <AutocompleteTagSelector
          tagType="ingredient"
          selectedIds={likes}
          onToggle={onToggleLike}
          placeholder="Search ingredients (e.g., Chicken, Avocado)"
          variant="like"
          excludeIds={dislikes}
        />
      </View>

      <VSpace size={28} />

      {/* Dislikes Section */}
      <View style={styles.section}>
        <Text type="heading" style={styles.sectionTitle}>
          Ingredients to avoid
        </Text>
        <VSpace size={8} />
        <Text type="caption" style={styles.sectionHint}>
          Include allergies or foods you don't like
        </Text>
        <VSpace size={12} />
        <AutocompleteTagSelector
          tagType="ingredient"
          selectedIds={dislikes}
          onToggle={onToggleDislike}
          placeholder="Search ingredients to avoid"
          variant="dislike"
          excludeIds={likes}
        />
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
  sectionHint: {
    marginLeft: 4,
  },
}));
