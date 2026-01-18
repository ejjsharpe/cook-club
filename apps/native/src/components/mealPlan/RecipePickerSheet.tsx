import { Ionicons } from "@expo/vector-icons";
import { useState, useCallback } from "react";
import {
  View,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
} from "react-native";
import ActionSheet, {
  SheetManager,
  SheetProps,
} from "react-native-actions-sheet";
import { StyleSheet } from "react-native-unistyles";

import { useGetCollectionDetail } from "../../api/collection";
import { useAddRecipeToMealPlan } from "../../api/mealPlan";
import { RecipeCard } from "../RecipeCard";
import { RecipeCollectionBrowser } from "../RecipeCollectionBrowser";
import { Text } from "../Text";

import type { Recipe } from "@/hooks/useRecipeCollectionBrowser";

const MEAL_TYPE_LABELS: Record<string, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
};

// Recipe type from collection detail (dates are serialized to strings via tRPC)
type CollectionRecipe = {
  id: number;
  name: string;
  cookTime: number | null;
  servings: number | null;
  sourceUrl: string | null;
  createdAt: string;
  images: { id: number; url: string }[];
};

const RecipeSeparator = () => (
  <View style={styles.separatorContainer}>
    <View style={styles.separator} />
  </View>
);

export const RecipePickerSheet = (props: SheetProps<"recipe-picker-sheet">) => {
  const { mealPlanId, date, mealType } = props.payload || {};
  const [selectedCollectionId, setSelectedCollectionId] = useState<
    number | null
  >(null);

  const addRecipeMutation = useAddRecipeToMealPlan();

  const { data: collectionDetail, isLoading: isLoadingCollection } =
    useGetCollectionDetail({
      collectionId: selectedCollectionId ?? 0,
    });

  const mealTypeLabel = mealType ? MEAL_TYPE_LABELS[mealType] : "";

  const handleSelectRecipe = useCallback(
    async (recipeId: number) => {
      if (!mealPlanId || !date || !mealType) return;

      try {
        await addRecipeMutation.mutateAsync({
          mealPlanId,
          recipeId,
          date,
          mealType,
        });
        SheetManager.hide("recipe-picker-sheet");
      } catch {
        // Error handled by mutation
      }
    },
    [mealPlanId, date, mealType, addRecipeMutation],
  );

  const handleRecipePress = useCallback(
    (recipe: Recipe) => {
      handleSelectRecipe(recipe.id);
    },
    [handleSelectRecipe],
  );

  const handleCollectionPress = useCallback((collectionId: number) => {
    setSelectedCollectionId(collectionId);
  }, []);

  const handleBackPress = useCallback(() => {
    setSelectedCollectionId(null);
  }, []);

  const renderCollectionRecipe = useCallback(
    ({ item }: { item: CollectionRecipe }) => (
      <RecipeCard
        recipe={{
          id: item.id,
          name: item.name,
          cookTime: item.cookTime,
          sourceUrl: item.sourceUrl,
          coverImage: item.images[0]?.url,
        }}
        onPress={() => handleSelectRecipe(item.id)}
      />
    ),
    [handleSelectRecipe],
  );

  return (
    <ActionSheet
      id={props.sheetId}
      snapPoints={[100]}
      initialSnapIndex={0}
      gestureEnabled
      enableGesturesInScrollView={false}
      indicatorStyle={styles.indicator}
      containerStyle={{ flex: 1 }}
    >
      <View style={styles.container}>
        {selectedCollectionId !== null ? (
          // Collection drill-down view
          <View style={styles.container}>
            <View style={styles.collectionHeader}>
              <TouchableOpacity
                onPress={handleBackPress}
                style={styles.backButton}
              >
                <Ionicons
                  name="chevron-back"
                  size={24}
                  style={styles.backIcon}
                />
              </TouchableOpacity>
              <Text
                type="title2"
                numberOfLines={1}
                style={styles.collectionTitle}
              >
                {collectionDetail?.name ?? "Collection"}
              </Text>
              <TouchableOpacity
                onPress={() => SheetManager.hide("recipe-picker-sheet")}
              >
                <Ionicons name="close" size={28} style={styles.closeIcon} />
              </TouchableOpacity>
            </View>
            {isLoadingCollection ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" />
              </View>
            ) : (
              <FlatList
                data={collectionDetail?.recipes ?? []}
                keyExtractor={(item) => item.id.toString()}
                renderItem={renderCollectionRecipe}
                ItemSeparatorComponent={RecipeSeparator}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <Ionicons
                      name="restaurant-outline"
                      size={48}
                      style={styles.emptyIcon}
                    />
                    <Text type="subheadline" style={styles.emptyText}>
                      No recipes in this collection yet
                    </Text>
                  </View>
                }
              />
            )}
          </View>
        ) : (
          // Recipe collection browser
          <View style={styles.container}>
            <View style={styles.header}>
              <Text type="title2">Add to {mealTypeLabel}</Text>
              <TouchableOpacity
                onPress={() => SheetManager.hide("recipe-picker-sheet")}
              >
                <Ionicons name="close" size={28} style={styles.closeIcon} />
              </TouchableOpacity>
            </View>
            <RecipeCollectionBrowser
              onRecipePress={handleRecipePress}
              onCollectionPress={handleCollectionPress}
              showCreateCollectionCard={false}
              recipesEmptyMessage="You don't have any recipes yet"
            />
          </View>
        )}
      </View>
    </ActionSheet>
  );
};

const styles = StyleSheet.create((theme) => ({
  indicator: {
    backgroundColor: theme.colors.border,
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  closeIcon: {
    color: theme.colors.text,
  },
  collectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  backButton: {
    marginRight: 8,
  },
  backIcon: {
    color: theme.colors.text,
  },
  collectionTitle: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  listContent: {
    paddingBottom: 40,
  },
  separatorContainer: {
    paddingHorizontal: 20,
  },
  separator: {
    height: 1,
    backgroundColor: theme.colors.border,
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyIcon: {
    color: theme.colors.textTertiary,
    marginBottom: 12,
  },
  emptyText: {
    textAlign: "center",
    color: theme.colors.textSecondary,
    paddingHorizontal: 40,
  },
}));
