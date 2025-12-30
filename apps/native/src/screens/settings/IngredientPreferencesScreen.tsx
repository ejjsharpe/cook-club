import { useCallback, useState, useEffect } from "react";
import { View, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "@/components/SafeAreaView";
import { StyleSheet } from "react-native-unistyles";

import { useUpdatePreferences, useUser } from "@/api/user";
import { AutocompleteTagSelector } from "@/components/AutocompleteTagSelector";
import { VSpace } from "@/components/Space";
import { Text } from "@/components/Text";
import { BackButton } from "@/components/buttons/BackButton";
import { PrimaryButton } from "@/components/buttons/PrimaryButton";

export const IngredientPreferencesScreen = () => {
  const { data: userData, isLoading: isLoadingUser } = useUser();
  const updatePreferences = useUpdatePreferences();

  const [likes, setLikes] = useState<number[]>([]);
  const [dislikes, setDislikes] = useState<number[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (userData?.user) {
      setLikes(userData.user.ingredientLikes ?? []);
      setDislikes(userData.user.ingredientDislikes ?? []);
    }
  }, [userData?.user]);

  const handleToggleLike = useCallback((tagId: number) => {
    setLikes((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId],
    );
    setHasChanges(true);
  }, []);

  const handleToggleDislike = useCallback((tagId: number) => {
    setDislikes((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId],
    );
    setHasChanges(true);
  }, []);

  const handleSave = () => {
    updatePreferences.mutate(
      { ingredientLikes: likes, ingredientDislikes: dislikes },
      { onSuccess: () => setHasChanges(false) },
    );
  };

  if (isLoadingUser) {
    return (
      <View style={styles.screen}>
        <SafeAreaView style={styles.container}>
          <VSpace size={8} />
          <BackButton />
          <View style={styles.centered}>
            <ActivityIndicator size="large" />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.container}>
        <VSpace size={8} />
        <BackButton />

        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <VSpace size={24} />
          <Text type="title1">Ingredient Preferences</Text>
          <VSpace size={8} />
          <Text type="bodyFaded">
            Update your ingredient preferences to personalize recipe
            recommendations
          </Text>

          <VSpace size={32} />

          <View style={styles.section}>
            <Text type="heading" style={styles.sectionTitle}>
              Ingredients you love
            </Text>
            <VSpace size={12} />
            <AutocompleteTagSelector
              tagType="ingredient"
              selectedIds={likes}
              onToggle={handleToggleLike}
              placeholder="Search ingredients (e.g., garlic, cheese)"
              variant="like"
              excludeIds={dislikes}
            />
          </View>

          <VSpace size={28} />

          <View style={styles.section}>
            <Text type="heading" style={styles.sectionTitle}>
              Ingredients you'd rather avoid
            </Text>
            <VSpace size={12} />
            <AutocompleteTagSelector
              tagType="ingredient"
              selectedIds={dislikes}
              onToggle={handleToggleDislike}
              placeholder="Search ingredients to avoid"
              variant="dislike"
              excludeIds={likes}
            />
          </View>

          <VSpace size={32} />

          <PrimaryButton
            onPress={handleSave}
            disabled={!hasChanges || updatePreferences.isPending}
          >
            {updatePreferences.isPending ? "Saving..." : "Save Changes"}
          </PrimaryButton>

          <VSpace size={40} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create((theme) => ({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  scrollView: {
    flex: 1,
  },
  section: {},
  sectionTitle: {
    marginLeft: 4,
  },
}));
