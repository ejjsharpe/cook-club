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

export const OnboardingStepCuisines = ({
  likes,
  dislikes,
  onToggleLike,
  onToggleDislike,
}: Props) => {
  return (
    <View style={styles.container}>
      <Text type="largeTitle" style={styles.title}>
        What cuisines do you love?
      </Text>
      <VSpace size={12} />
      <Text type="bodyFaded" style={styles.subtitle}>
        We'll personalize your recipe recommendations
      </Text>
      <VSpace size={32} />

      {/* Likes Section */}
      <View style={styles.section}>
        <Text type="heading" style={styles.sectionTitle}>
          Cuisines you enjoy
        </Text>
        <VSpace size={12} />
        <AutocompleteTagSelector
          tagType="cuisine"
          selectedIds={likes}
          onToggle={onToggleLike}
          placeholder="Search cuisines (e.g., Italian, Thai)"
          variant="like"
          excludeIds={dislikes}
        />
      </View>

      <VSpace size={28} />

      {/* Dislikes Section */}
      <View style={styles.section}>
        <Text type="heading" style={styles.sectionTitle}>
          Cuisines you'd rather skip
        </Text>
        <VSpace size={12} />
        <AutocompleteTagSelector
          tagType="cuisine"
          selectedIds={dislikes}
          onToggle={onToggleDislike}
          placeholder="Search cuisines to avoid"
          variant="dislike"
          excludeIds={likes}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create(() => ({
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
}));
