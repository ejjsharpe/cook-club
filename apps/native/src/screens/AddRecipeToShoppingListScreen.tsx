import { useNavigation } from "@react-navigation/native";
import { useCallback } from "react";
import { View, Alert } from "react-native";
import { StyleSheet } from "react-native-unistyles";

import { useAddRecipeToShoppingList } from "@/api/shopping";
import { RecipeCollectionBrowser } from "@/components/RecipeCollectionBrowser";
import { SafeAreaView } from "@/components/SafeAreaView";
import { VSpace } from "@/components/Space";
import { Text } from "@/components/Text";
import { BackButton } from "@/components/buttons/BackButton";
import type { Recipe } from "@/hooks/useRecipeCollectionBrowser";

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

  return (
    <SafeAreaView edges={["top"]} style={styles.container}>
      <View style={styles.titleRow}>
        <BackButton />
        <Text type="title2" style={styles.headerTitle}>
          Add to Groceries
        </Text>
        <View style={styles.headerSpacer} />
      </View>
      <VSpace size={16} />
      <RecipeCollectionBrowser
        onRecipePress={handleRecipeSelect}
        onCollectionPress={handleCollectionPress}
        recipesEmptyMessage="No recipes in your library yet"
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
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
