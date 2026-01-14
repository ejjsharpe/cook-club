import { useNavigation } from "@react-navigation/native";
import { useCallback } from "react";
import { View, Alert } from "react-native";
import { StyleSheet } from "react-native-unistyles";

import { useCreateCollection } from "@/api/collection";
import { RecipeCollectionBrowser } from "@/components/RecipeCollectionBrowser";
import { SafeAreaView } from "@/components/SafeAreaView";
import { VSpace } from "@/components/Space";
import { Text } from "@/components/Text";
import type { Recipe } from "@/hooks/useRecipeCollectionBrowser";
import { useTabBarScroll } from "@/lib/tabBarContext";

// Header height constants
const TITLE_SECTION_HEIGHT = 8 + 40 + 20; // VSpace(8) + title1 lineHeight(40) + VSpace(20) before search

export const MyRecipesScreen = () => {
  const navigation = useNavigation();
  const { onScroll: onTabBarScroll } = useTabBarScroll();

  const createCollectionMutation = useCreateCollection();

  const handleRecipePress = useCallback(
    (recipe: Recipe) => {
      navigation.navigate("RecipeDetail", { recipeId: recipe.id });
    },
    [navigation],
  );

  const handleCollectionPress = useCallback(
    (collectionId: number) => {
      navigation.navigate("CollectionDetail", { collectionId });
    },
    [navigation],
  );

  const handleCreateCollection = useCallback(() => {
    Alert.prompt(
      "New Collection",
      "Enter a name for your collection",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Create",
          onPress: (collectionName?: string) => {
            const trimmedName = collectionName?.trim();
            if (!trimmedName) {
              Alert.alert("Error", "Collection name cannot be empty");
              return;
            }
            createCollectionMutation.mutate({ name: trimmedName });
          },
        },
      ],
      "plain-text",
    );
  }, [createCollectionMutation]);

  const headerContent = (
    <>
      <VSpace size={8} />
      <View style={styles.headerPadded}>
        <Text type="title1">My Recipes</Text>
      </View>
      <VSpace size={20} />
    </>
  );

  return (
    <SafeAreaView edges={["top"]} style={styles.container}>
      <RecipeCollectionBrowser
        headerContent={headerContent}
        titleSectionHeight={TITLE_SECTION_HEIGHT}
        onRecipePress={handleRecipePress}
        onCollectionPress={handleCollectionPress}
        showCreateCollectionCard
        onCreateCollection={handleCreateCollection}
        isCreatingCollection={createCollectionMutation.isPending}
        recipesEmptyMessage="No recipes in your library yet. Import recipes from the feed or add your own!"
        onTabBarScroll={onTabBarScroll}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  headerPadded: {
    paddingHorizontal: 20,
  },
}));
