import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { Image } from "expo-image";
import { useState } from "react";
import {
  View,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  TextInput,
  Alert,
} from "react-native";
import Swipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import { KeyboardStickyView } from "react-native-keyboard-controller";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { StyleSheet } from "react-native-unistyles";

import {
  useGetShoppingList,
  useToggleItemChecked,
  useRemoveItem,
  useClearCheckedItems,
  useRemoveRecipeFromList,
  useAddManualItem,
} from "@/api/shopping";
import { FLOATING_TAB_BAR_HEIGHT } from "@/components/FloatingTabBar";
import { VSpace } from "@/components/Space";
import { Text } from "@/components/Text";

interface ShoppingListItem {
  id: number;
  ingredientName: string;
  quantity: number;
  unit: string | null;
  displayText: string;
  isChecked: boolean;
  sourceItems: {
    id: number;
    quantity: number | null;
    sourceRecipeId: number | null;
    sourceRecipeName: string | null;
  }[];
}

interface Recipe {
  id: number;
  name: string;
  imageUrl: string | null;
}

const INPUT_SECTION_HEIGHT = 68;

export const ShoppingListScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [manualItemText, setManualItemText] = useState("");

  const { data, isLoading, error } = useGetShoppingList();
  const toggleMutation = useToggleItemChecked();
  const removeMutation = useRemoveItem();
  const clearMutation = useClearCheckedItems();
  const removeRecipeMutation = useRemoveRecipeFromList();
  const addManualMutation = useAddManualItem();

  const items = data?.items || [];
  const recipes = data?.recipes || [];
  const checkedCount = items.filter(
    (item: ShoppingListItem) => item.isChecked,
  ).length;

  const handleToggleCheck = (itemId: number) => {
    toggleMutation.mutate({ itemId });
  };

  const handleRemoveItem = (itemId: number) => {
    removeMutation.mutate({ itemId });
  };

  const handleClearChecked = () => {
    if (checkedCount === 0) return;

    Alert.alert(
      "Clear Checked Items",
      `Remove ${checkedCount} checked item${checkedCount > 1 ? "s" : ""}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: () => clearMutation.mutate(),
        },
      ],
    );
  };

  const handleRemoveRecipe = (recipeId: number, recipeName: string) => {
    Alert.alert(
      "Remove Recipe",
      `Remove all ingredients from "${recipeName}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => removeRecipeMutation.mutate({ recipeId }),
        },
      ],
    );
  };

  const handleAddManualItem = () => {
    if (!manualItemText.trim()) return;

    addManualMutation.mutate(
      { ingredientText: manualItemText.trim() },
      {
        onSuccess: () => {
          setManualItemText("");
        },
      },
    );
  };

  const handleRecipePress = (recipeId: number) => {
    navigation.navigate("RecipeDetail", { recipeId });
  };

  const renderRecipeChip = ({ item }: { item: Recipe }) => (
    <TouchableOpacity
      style={styles.recipeChip}
      onPress={() => handleRecipePress(item.id)}
      activeOpacity={0.7}
    >
      {item.imageUrl ? (
        <Image
          source={{ uri: item.imageUrl }}
          style={styles.recipeChipImage}
          contentFit="cover"
        />
      ) : (
        <View
          style={[styles.recipeChipImage, styles.recipeChipImagePlaceholder]}
        >
          <Ionicons
            name="image-outline"
            size={20}
            style={styles.placeholderIcon}
          />
        </View>
      )}
      <Text type="body" style={styles.recipeChipText} numberOfLines={1}>
        {item.name}
      </Text>
      <TouchableOpacity
        style={styles.recipeChipRemove}
        onPress={(e) => {
          e.stopPropagation();
          handleRemoveRecipe(item.id, item.name);
        }}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="close-circle" size={20} style={styles.removeIcon} />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const renderRightActions = (itemId: number) => {
    return (
      <TouchableOpacity
        style={styles.deleteAction}
        onPress={() => handleRemoveItem(itemId)}
      >
        <Ionicons name="trash" size={24} color="#fff" />
      </TouchableOpacity>
    );
  };

  const renderItem = ({ item }: { item: ShoppingListItem }) => (
    <Swipeable renderRightActions={() => renderRightActions(item.id)}>
      <TouchableOpacity
        style={[styles.itemRow, item.isChecked && styles.itemRowChecked]}
        onPress={() => handleToggleCheck(item.id)}
        activeOpacity={0.7}
      >
        <View
          style={[styles.checkbox, item.isChecked && styles.checkboxChecked]}
        >
          {item.isChecked && (
            <Ionicons name="checkmark" size={20} style={styles.checkIcon} />
          )}
        </View>
        <View style={styles.itemContent}>
          <Text
            type="body"
            style={[styles.itemText, item.isChecked && styles.itemTextChecked]}
          >
            {item.displayText}
          </Text>
          {item.sourceItems.length > 0 &&
            item.sourceItems.some((si) => si.sourceRecipeName) && (
              <Text type="bodyFaded" style={styles.recipeTag}>
                from{" "}
                {item.sourceItems
                  .filter((si) => si.sourceRecipeName)
                  .map((si) => si.sourceRecipeName)
                  .join(", ")}
              </Text>
            )}
        </View>
      </TouchableOpacity>
    </Swipeable>
  );

  const renderEmpty = () => {
    if (isLoading) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator size="large" />
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.centered}>
          <Text type="bodyFaded">Failed to load shopping list</Text>
        </View>
      );
    }

    return (
      <View style={styles.centered}>
        <Ionicons name="cart-outline" size={64} style={styles.emptyIcon} />
        <VSpace size={16} />
        <Text type="heading" style={styles.emptyTitle}>
          Your shopping list is empty
        </Text>
        <VSpace size={8} />
        <Text type="bodyFaded" style={styles.emptySubtitle}>
          Add ingredients from any recipe to get started
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.container} edges={["top"]}>
        <VSpace size={28} />

        {/* Header */}
        <View style={styles.header}>
          <Text type="title2">Shopping List</Text>
          {checkedCount > 0 && (
            <TouchableOpacity
              onPress={handleClearChecked}
              style={styles.clearButton}
              disabled={clearMutation.isPending}
            >
              <Text type="body" style={styles.clearButtonText}>
                Clear ({checkedCount})
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <VSpace size={16} />

        {/* Recipe Chips */}
        {recipes.length > 0 && (
          <View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.recipeChipsContainer}
            >
              {recipes.map((recipe: Recipe) => (
                <View key={recipe.id}>
                  {renderRecipeChip({ item: recipe })}
                </View>
              ))}
            </ScrollView>
            <VSpace size={12} />
          </View>
        )}

        {/* Shopping List Items */}
        <FlatList
          data={items}
          renderItem={renderItem}
          keyExtractor={(item) => item.id.toString()}
          ListEmptyComponent={renderEmpty}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: INPUT_SECTION_HEIGHT + insets.bottom },
            items.length === 0 && styles.emptyListContent,
          ]}
        />
      </SafeAreaView>
      {/* Bottom Input - sticks to keyboard */}
      <KeyboardStickyView
        style={[
          styles.inputSection,
          { paddingBottom: FLOATING_TAB_BAR_HEIGHT + insets.bottom },
        ]}
        offset={{
          closed: 0,
          opened: FLOATING_TAB_BAR_HEIGHT + insets.bottom - 12,
        }}
      >
        <TextInput
          style={styles.input}
          placeholder="Add item (e.g., 2 cups milk)"
          value={manualItemText}
          onChangeText={setManualItemText}
          onSubmitEditing={handleAddManualItem}
          returnKeyType="done"
          autoCapitalize="none"
          placeholderTextColor="#999"
        />
        <TouchableOpacity
          style={[
            styles.addButton,
            !manualItemText.trim() && styles.addButtonDisabled,
          ]}
          onPress={handleAddManualItem}
          disabled={!manualItemText.trim() || addManualMutation.isPending}
        >
          <Ionicons
            name="add-circle"
            size={32}
            style={[
              styles.addIcon,
              !manualItemText.trim() && styles.addIconDisabled,
            ]}
          />
        </TouchableOpacity>
      </KeyboardStickyView>
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
  },
  header: {
    paddingHorizontal: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  clearButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.small,
    backgroundColor: theme.colors.primary + "20",
  },
  clearButtonText: {
    color: theme.colors.primary,
  },

  // Recipe Chips
  recipeChipsContainer: {
    paddingHorizontal: 20,
    paddingVertical: 4,
    width: "100%",
  },
  recipeChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: theme.borderRadius.medium,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
    gap: 8,
  },
  recipeChipImage: {
    width: 40,
    height: 40,
    borderRadius: theme.borderRadius.small,
  },
  recipeChipImagePlaceholder: {
    backgroundColor: theme.colors.border + "40",
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderIcon: {
    color: theme.colors.text,
    opacity: 0.3,
  },
  recipeChipText: {
    fontSize: 14,
  },
  recipeChipRemove: {
    padding: 4,
  },
  removeIcon: {
    color: theme.colors.text,
    opacity: 0.5,
  },

  // Manual Item Input (positioned at bottom)
  inputSection: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.background,
    gap: 8,
  },
  input: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: "#f5f5f5",
    fontSize: 16,
    fontFamily: theme.fonts.albertRegular,
    color: theme.colors.text,
  },
  addButton: {
    padding: 4,
  },
  addButtonDisabled: {
    opacity: 0.3,
  },
  addIcon: {
    color: theme.colors.primary,
  },
  addIconDisabled: {
    opacity: 0.3,
  },

  // List Items
  listContent: {
    paddingBottom: 20,
  },
  emptyListContent: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  emptyIcon: {
    color: theme.colors.text,
    opacity: 0.3,
  },
  emptyTitle: {
    textAlign: "center",
  },
  emptySubtitle: {
    textAlign: "center",
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: theme.colors.background,
  },
  itemRowChecked: {
    opacity: 0.5,
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  checkboxChecked: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary,
  },
  checkIcon: {
    color: "#fff",
  },
  itemContent: {
    flex: 1,
  },
  itemText: {
    fontSize: 16,
  },
  itemTextChecked: {
    textDecorationLine: "line-through",
  },
  recipeTag: {
    fontSize: 12,
    marginTop: 2,
  },
  deleteAction: {
    backgroundColor: "#FF3B30",
    justifyContent: "center",
    alignItems: "center",
    width: 80,
  },
}));
