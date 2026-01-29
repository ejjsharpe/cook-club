import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
  View,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from "react-native";
import ActionSheet, {
  SheetManager,
  SheetProps,
  ScrollView,
} from "react-native-actions-sheet";
import { StyleSheet } from "react-native-unistyles";

import { VSpace } from "./Space";
import { Text } from "./Text";

import {
  useGetUserShoppingLists,
  useCreateShoppingList,
  useAddRecipeToSpecificList,
} from "@/api/shopping";
import { isCompactUnit, formatUnit } from "@/utils/measurementUtils";

interface Ingredient {
  id: number;
  quantity: string | null;
  unit: string | null;
  name: string;
  preparation?: string | null;
}

export const ShoppingListSelectorSheet = (
  props: SheetProps<"shopping-list-selector-sheet">,
) => {
  const { recipeId, recipeName, ingredients, servings } = props.payload || {};
  const [selectedListId, setSelectedListId] = useState<number | null>(null);
  const [isCreatingList, setIsCreatingList] = useState(false);
  const [newListName, setNewListName] = useState("");

  const { data: lists, isLoading } = useGetUserShoppingLists();
  const createListMutation = useCreateShoppingList();
  const addRecipeMutation = useAddRecipeToSpecificList();

  const handleSelectList = (listId: number) => {
    setSelectedListId(listId);
  };

  const handleCreateList = async () => {
    if (!newListName.trim()) return;

    try {
      const newList = await createListMutation.mutateAsync({
        name: newListName.trim(),
      });

      if (newList) {
        setSelectedListId(newList.id);
        setNewListName("");
        setIsCreatingList(false);
      }
    } catch {
      // Error handled in mutation
    }
  };

  const handleAddToList = async () => {
    if (!recipeId || !selectedListId) return;

    try {
      await addRecipeMutation.mutateAsync({
        recipeId,
        shoppingListId: selectedListId,
        servings,
      });
      SheetManager.hide("shopping-list-selector-sheet");
    } catch {
      // Error handled in mutation
    }
  };

  const hasLists = lists && lists.length > 0;
  const isAddDisabled = !selectedListId || addRecipeMutation.isPending;

  // Format ingredient for display
  const formatIngredient = (ing: Ingredient) => {
    const quantity = ing.quantity ? parseFloat(ing.quantity) : null;
    const formattedQuantity = quantity
      ? quantity % 1 === 0
        ? quantity.toString()
        : quantity.toFixed(2).replace(/\.?0+$/, "")
      : null;

    const displayUnit = formatUnit(ing.unit, quantity);
    const needsSpace = displayUnit && !isCompactUnit(displayUnit);

    let text = "";
    if (formattedQuantity) {
      text += formattedQuantity;
      if (displayUnit) {
        text += needsSpace ? " " : "";
        text += displayUnit;
      }
      text += " ";
    } else if (displayUnit) {
      text += displayUnit + " ";
    }
    text += ing.name;

    return text;
  };

  return (
    <ActionSheet
      id={props.sheetId}
      snapPoints={[100]}
      initialSnapIndex={0}
      gestureEnabled
      enableGesturesInScrollView={false}
      indicatorStyle={styles.indicator}
    >
      <View>
        {/* Header */}
        <View style={styles.header}>
          <Text type="title2">Add to Shopping List</Text>
          <TouchableOpacity
            onPress={() => SheetManager.hide("shopping-list-selector-sheet")}
          >
            <Ionicons name="close" size={28} style={styles.closeIcon} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scrollView}>
          <View style={styles.scrollContent}>
            {/* Ingredients Preview */}
            {ingredients && ingredients.length > 0 && (
              <>
                <Text type="heading" style={styles.sectionTitle}>
                  Ingredients from {recipeName || "recipe"}
                </Text>
                <VSpace size={8} />
                <View style={styles.ingredientsPreview}>
                  {ingredients.slice(0, 5).map((ing: Ingredient) => (
                    <View key={ing.id} style={styles.ingredientRow}>
                      <View style={styles.ingredientBullet} />
                      <Text
                        type="body"
                        style={styles.ingredientText}
                        numberOfLines={1}
                      >
                        {formatIngredient(ing)}
                      </Text>
                    </View>
                  ))}
                  {ingredients.length > 5 && (
                    <Text type="caption" style={styles.moreText}>
                      +{ingredients.length - 5} more ingredients
                    </Text>
                  )}
                </View>
                <VSpace size={24} />
              </>
            )}

            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" />
              </View>
            ) : (
              <>
                {/* Shopping Lists */}
                <Text type="heading" style={styles.sectionTitle}>
                  Select a list
                </Text>
                <VSpace size={12} />

                {hasLists ? (
                  <>
                    {lists.map((list) => (
                      <TouchableOpacity
                        key={list.id}
                        style={styles.listRow}
                        onPress={() => handleSelectList(list.id)}
                      >
                        <View style={styles.listInfo}>
                          <Ionicons
                            name="list-outline"
                            size={20}
                            style={styles.listIcon}
                          />
                          <Text type="body">{list.name}</Text>
                        </View>
                        <View
                          style={[
                            styles.radio,
                            selectedListId === list.id && styles.radioSelected,
                          ]}
                        >
                          {selectedListId === list.id && (
                            <View style={styles.radioInner} />
                          )}
                        </View>
                      </TouchableOpacity>
                    ))}
                    <VSpace size={16} />
                  </>
                ) : (
                  <>
                    <Text type="bodyFaded" style={styles.emptyText}>
                      No shopping lists yet. Create your first one below!
                    </Text>
                    <VSpace size={16} />
                  </>
                )}

                {/* Create New List */}
                {isCreatingList ? (
                  <>
                    <Text type="heading" style={styles.sectionTitle}>
                      New list name
                    </Text>
                    <VSpace size={12} />
                    <View style={styles.inputRow}>
                      <TextInput
                        style={styles.input}
                        placeholder="e.g., Weekly Groceries"
                        placeholderTextColor="#999"
                        value={newListName}
                        onChangeText={setNewListName}
                        autoFocus
                      />
                    </View>
                    <VSpace size={12} />
                    <View style={styles.createActions}>
                      <TouchableOpacity
                        style={styles.cancelButton}
                        onPress={() => {
                          setNewListName("");
                          setIsCreatingList(false);
                        }}
                      >
                        <Text type="body">Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.createButton,
                          (!newListName.trim() ||
                            createListMutation.isPending) &&
                            styles.createButtonDisabled,
                        ]}
                        onPress={handleCreateList}
                        disabled={
                          !newListName.trim() || createListMutation.isPending
                        }
                      >
                        {createListMutation.isPending ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Text
                            type="highlight"
                            style={styles.createButtonText}
                          >
                            Create
                          </Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </>
                ) : (
                  <TouchableOpacity
                    style={styles.newListButton}
                    onPress={() => setIsCreatingList(true)}
                  >
                    <Ionicons
                      name="add-circle-outline"
                      size={24}
                      style={styles.newListIcon}
                    />
                    <Text type="body" style={styles.newListText}>
                      Create new list
                    </Text>
                  </TouchableOpacity>
                )}

                <VSpace size={24} />

                {/* Add Button */}
                <TouchableOpacity
                  style={[
                    styles.addButton,
                    isAddDisabled && styles.addButtonDisabled,
                  ]}
                  onPress={handleAddToList}
                  disabled={isAddDisabled}
                >
                  {addRecipeMutation.isPending ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons
                        name="cart-outline"
                        size={20}
                        style={styles.addButtonIcon}
                      />
                      <Text style={styles.addButtonText}>Add to List</Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>
        </ScrollView>
      </View>
    </ActionSheet>
  );
};

const styles = StyleSheet.create((theme) => ({
  indicator: {
    backgroundColor: theme.colors.border,
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
  scrollView: {
    maxHeight: 500,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
  },
  loadingContainer: {
    alignItems: "center",
    paddingVertical: 40,
  },
  sectionTitle: {
    marginBottom: 4,
  },

  // Ingredients Preview
  ingredientsPreview: {
    backgroundColor: theme.colors.inputBackground,
    borderRadius: theme.borderRadius.medium,
    padding: 12,
  },
  ingredientRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
  },
  ingredientBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.primary,
    marginRight: 10,
  },
  ingredientText: {
    flex: 1,
    fontSize: 14,
    color: theme.colors.text,
  },
  moreText: {
    color: theme.colors.textSecondary,
    marginTop: 4,
    marginLeft: 16,
  },

  // List Selection
  listRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: theme.borderRadius.medium,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 8,
  },
  listInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 10,
  },
  listIcon: {
    color: theme.colors.textSecondary,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  radioSelected: {
    borderColor: theme.colors.primary,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: theme.colors.primary,
  },
  emptyText: {
    textAlign: "center",
    paddingVertical: 20,
  },

  // Create New List
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.medium,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: theme.colors.text,
    backgroundColor: theme.colors.background,
  },
  createActions: {
    flexDirection: "row",
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: theme.borderRadius.medium,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
  },
  createButton: {
    flex: 1,
    backgroundColor: theme.colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: theme.borderRadius.medium,
    alignItems: "center",
  },
  createButtonDisabled: {
    opacity: 0.5,
  },
  createButtonText: {
    color: theme.colors.buttonText,
  },
  newListButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: theme.borderRadius.medium,
    borderWidth: 2,
    borderColor: theme.colors.border,
    borderStyle: "dashed",
  },
  newListIcon: {
    color: theme.colors.text,
    opacity: 0.6,
    marginRight: 8,
  },
  newListText: {
    color: theme.colors.text,
    opacity: 0.6,
  },

  // Add Button
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 50,
    backgroundColor: theme.colors.primary,
    borderRadius: 25,
  },
  addButtonDisabled: {
    opacity: 0.5,
  },
  addButtonIcon: {
    color: theme.colors.buttonText,
  },
  addButtonText: {
    color: theme.colors.buttonText,
    fontSize: 17,
    fontFamily: theme.fonts.semiBold,
  },
}));
