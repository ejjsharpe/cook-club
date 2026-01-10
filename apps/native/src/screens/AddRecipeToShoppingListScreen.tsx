import { useNavigation } from "@react-navigation/native";
import { useCallback } from "react";
import { View, Alert } from "react-native";
import { StyleSheet } from "react-native-unistyles";

import { useAddRecipeToShoppingList } from "@/api/shopping";
import { RecipeCollectionBrowser } from "@/components/RecipeCollectionBrowser";
import { VSpace } from "@/components/Space";
import { Text } from "@/components/Text";
import { BackButton } from "@/components/buttons/BackButton";
import type { Recipe } from "@/hooks/useRecipeCollectionBrowser";

// Header height constants
const TITLE_SECTION_HEIGHT = 44 + 16; // Back button row + VSpace

export const AddRecipeToShoppingListScreen = () => {
  const navigation = useNavigation();

  const addToShoppingListMutation = useAddRecipeToShoppingList();

  const handleRecipeSelect = useCallback(
    (recipe: Recipe) => {
      Alert.alert(
        "Add to Shopping List",
        `Add ingredients from "${recipe.name}" to your shopping list?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Add",
            onPress: () => {
              addToShoppingListMutation.mutate(
                { recipeId: recipe.id },
                {
                  onSuccess: () => {
                    navigation.goBack();
                  },
                },
              );
            },
          },
        ],
      );
    },
    [addToShoppingListMutation, navigation],
  );

  const handleCollectionPress = useCallback(
    (collectionId: number) => {
      navigation.navigate("CollectionDetail", { collectionId });
    },
    [navigation],
  );

  const headerContent = (
    <>
      <View style={styles.titleRow}>
        <BackButton />
        <Text type="title2" style={styles.headerTitle}>
          Add to Groceries
        </Text>
        <View style={styles.headerSpacer} />
      </View>
      <VSpace size={16} />
    </>
  );

  return (
    <RecipeCollectionBrowser
      headerContent={headerContent}
      titleSectionHeight={TITLE_SECTION_HEIGHT}
      onRecipePress={handleRecipeSelect}
      onCollectionPress={handleCollectionPress}
      recipesEmptyMessage="No recipes in your library yet"
    />
  );
};

const styles = StyleSheet.create(() => ({
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
  },
  headerSpacer: {
    width: 44,
  },
}));
