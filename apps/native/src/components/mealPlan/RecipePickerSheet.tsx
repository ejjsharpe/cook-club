import { Ionicons } from "@expo/vector-icons";
import { useState, useCallback } from "react";
import {
  View,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Image,
} from "react-native";
import ActionSheet, {
  SheetManager,
  SheetProps,
  FlatList,
} from "react-native-actions-sheet";
import { StyleSheet } from "react-native-unistyles";

import { useAddRecipeToMealPlan } from "../../api/mealPlan";
import { useGetUserRecipes, type RecipeListItem } from "../../api/recipe";
import { useDebounce } from "../../hooks/useDebounce";
import { Text } from "../Text";

const MEAL_TYPE_LABELS: Record<string, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
};

interface RecipeItemProps {
  recipe: RecipeListItem;
  onPress: () => void;
  isPending: boolean;
}

const RecipeItem = ({ recipe, onPress, isPending }: RecipeItemProps) => {
  const imageUrl = recipe.coverImage;

  return (
    <TouchableOpacity
      style={styles.recipeRow}
      onPress={onPress}
      disabled={isPending}
    >
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={styles.recipeImage} />
      ) : (
        <View style={[styles.recipeImage, styles.recipeImagePlaceholder]}>
          <Ionicons
            name="restaurant-outline"
            size={24}
            style={styles.placeholderIcon}
          />
        </View>
      )}
      <View style={styles.recipeInfo}>
        <Text type="body" numberOfLines={2}>
          {recipe.name}
        </Text>
        {recipe.totalTime && (
          <Text type="caption" style={styles.recipeTime}>
            {recipe.totalTime}
          </Text>
        )}
      </View>
      {isPending ? (
        <ActivityIndicator size="small" />
      ) : (
        <Ionicons name="add-circle" size={28} style={styles.addIcon} />
      )}
    </TouchableOpacity>
  );
};

export const RecipePickerSheet = (props: SheetProps<"recipe-picker-sheet">) => {
  const { mealPlanId, date, mealType } = props.payload || {};
  const [searchText, setSearchText] = useState("");
  const debouncedSearch = useDebounce(searchText, 300);

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useGetUserRecipes({
      search: debouncedSearch || undefined,
      limit: 20,
    });

  const addRecipeMutation = useAddRecipeToMealPlan();

  const recipes = data?.pages.flatMap((page) => page.items) ?? [];

  const handleSelectRecipe = useCallback(
    async (recipe: RecipeListItem) => {
      if (!mealPlanId || !date || !mealType) return;

      try {
        await addRecipeMutation.mutateAsync({
          mealPlanId,
          recipeId: recipe.id,
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

  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const mealTypeLabel = mealType ? MEAL_TYPE_LABELS[mealType] : "";

  const renderItem = useCallback(
    ({ item }: { item: RecipeListItem }) => (
      <RecipeItem
        recipe={item}
        onPress={() => handleSelectRecipe(item)}
        isPending={addRecipeMutation.isPending}
      />
    ),
    [handleSelectRecipe, addRecipeMutation.isPending],
  );

  const renderFooter = useCallback(() => {
    if (!isFetchingNextPage) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" />
      </View>
    );
  }, [isFetchingNextPage]);

  const renderEmpty = useCallback(() => {
    if (isLoading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Ionicons
          name="restaurant-outline"
          size={48}
          style={styles.emptyIcon}
        />
        <Text type="bodyFaded" style={styles.emptyText}>
          {searchText
            ? "No recipes found matching your search"
            : "You don't have any recipes yet"}
        </Text>
      </View>
    );
  }, [isLoading, searchText]);

  return (
    <ActionSheet
      id={props.sheetId}
      snapPoints={[100]}
      initialSnapIndex={0}
      gestureEnabled
      enableGesturesInScrollView={false}
      indicatorStyle={styles.indicator}
      containerStyle={{ flex: 0.7 }}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text type="title2">Add to {mealTypeLabel}</Text>
          <TouchableOpacity
            onPress={() => SheetManager.hide("recipe-picker-sheet")}
          >
            <Ionicons name="close" size={28} style={styles.closeIcon} />
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search your recipes..."
            placeholderTextColor="#999"
            value={searchText}
            onChangeText={setSearchText}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchText.length > 0 && (
            <TouchableOpacity onPress={() => setSearchText("")}>
              <Ionicons
                name="close-circle"
                size={20}
                style={styles.clearIcon}
              />
            </TouchableOpacity>
          )}
        </View>

        {/* Recipe List */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" />
          </View>
        ) : (
          <FlatList
            data={recipes}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.5}
            ListFooterComponent={renderFooter}
            ListEmptyComponent={renderEmpty}
          />
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
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  closeIcon: {
    color: theme.colors.text,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    marginVertical: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: theme.colors.inputBackground,
    borderRadius: theme.borderRadius.medium,
  },
  searchIcon: {
    color: theme.colors.textTertiary,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: theme.colors.text,
  },
  clearIcon: {
    color: theme.colors.textTertiary,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  recipeRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  recipeImage: {
    width: 56,
    height: 56,
    borderRadius: theme.borderRadius.small,
    backgroundColor: theme.colors.inputBackground,
  },
  recipeImagePlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderIcon: {
    color: theme.colors.textTertiary,
  },
  recipeInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  recipeTime: {
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  addIcon: {
    color: theme.colors.primary,
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: "center",
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
    paddingHorizontal: 40,
  },
}));
