import { useCallback, useState, useEffect } from "react";
import { View, ScrollView, ActivityIndicator } from "react-native";
import { StyleSheet } from "react-native-unistyles";

import { useUpdatePreferences, useUser } from "@/api/user";
import { AutocompleteTagSelector } from "@/components/AutocompleteTagSelector";
import { SafeAreaView } from "@/components/SafeAreaView";
import { VSpace } from "@/components/Space";
import { Text } from "@/components/Text";
import { BackButton } from "@/components/buttons/BackButton";
import { PrimaryButton } from "@/components/buttons/PrimaryButton";

export const DietaryPreferencesScreen = () => {
  const { data: userData, isLoading: isLoadingUser } = useUser();
  const updatePreferences = useUpdatePreferences();

  const [dietaryRequirements, setDietaryRequirements] = useState<number[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (userData?.user) {
      setDietaryRequirements(userData.user.dietaryRequirements ?? []);
    }
  }, [userData?.user]);

  const handleToggle = useCallback((tagId: number) => {
    setDietaryRequirements((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId],
    );
    setHasChanges(true);
  }, []);

  const handleSave = () => {
    updatePreferences.mutate(
      { dietaryRequirements },
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
          <Text type="title1">Dietary Requirements</Text>
          <VSpace size={8} />
          <Text type="bodyFaded">
            Set your dietary requirements to filter recipes that don't match
            your needs
          </Text>

          <VSpace size={32} />

          <View style={styles.section}>
            <Text type="heading" style={styles.sectionTitle}>
              Your dietary requirements
            </Text>
            <VSpace size={12} />
            <AutocompleteTagSelector
              tagType="dietary"
              selectedIds={dietaryRequirements}
              onToggle={handleToggle}
              placeholder="Search (e.g., vegetarian, gluten-free)"
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
