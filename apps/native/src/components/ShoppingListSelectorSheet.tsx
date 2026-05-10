import { TrueSheet } from "@lodev09/react-native-true-sheet";
import {
  forwardRef,
  useState,
  useImperativeHandle,
  useCallback,
  useRef,
  useEffect,
  useMemo,
} from "react";
import {
  View,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, UnistylesRuntime } from "react-native-unistyles";

import { AppSheet } from "./AppSheet";
import { Text } from "./Text";

import {
  useGetUserShoppingLists,
  useCreateShoppingList,
  useAddRecipeToSpecificList,
} from "@/api/shopping";
import { Ionicons } from "@/components/Ionicons";
import { isCompactUnit, formatUnit } from "@/utils/measurementUtils";

interface Ingredient {
  id: number;
  quantity: string | null;
  unit: string | null;
  name: string;
  preparation?: string | null;
}

interface IngredientSection {
  id?: number | string | null;
  name?: string | null;
  ingredients: Ingredient[];
}

export interface ShoppingListSelectorSheetProps {
  recipeId?: number;
  recipeName?: string;
  ingredients?: Ingredient[];
  ingredientSections?: IngredientSection[];
  servings?: number;
  targetShoppingListId?: number;
}

export interface ShoppingListSelectorSheetRef {
  present: () => void;
  dismiss: () => void;
}

export const ShoppingListSelectorSheet = forwardRef<
  ShoppingListSelectorSheetRef,
  ShoppingListSelectorSheetProps
>(
  (
    {
      recipeId,
      recipeName,
      ingredients,
      ingredientSections,
      servings,
      targetShoppingListId,
    },
    ref,
  ) => {
    const theme = UnistylesRuntime.getTheme();
    const insets = useSafeAreaInsets();
    const sheetRef = useRef<TrueSheet>(null);
    const [selectedListId, setSelectedListId] = useState<number | null>(null);
    const [selectedIngredientIds, setSelectedIngredientIds] = useState<
      Set<number>
    >(new Set());
    const [selectedServings, setSelectedServings] = useState(1);
    const [isCreatingList, setIsCreatingList] = useState(false);
    const [newListName, setNewListName] = useState("");

    const { data: lists, isLoading } = useGetUserShoppingLists();
    const createListMutation = useCreateShoppingList();
    const addRecipeMutation = useAddRecipeToSpecificList();
    const isTargetListLocked = targetShoppingListId !== undefined;
    const baseServings = servings && servings > 0 ? servings : 1;
    const canAdjustServings = servings !== undefined && servings > 0;
    const servingMultiplier = canAdjustServings
      ? selectedServings / baseServings
      : 1;

    const sections = useMemo<IngredientSection[]>(() => {
      if (ingredientSections?.length) {
        return ingredientSections.filter(
          (section) => section.ingredients.length,
        );
      }

      if (ingredients?.length) {
        return [{ id: "ingredients", name: null, ingredients }];
      }

      return [];
    }, [ingredientSections, ingredients]);

    const allIngredients = useMemo(
      () => sections.flatMap((section) => section.ingredients),
      [sections],
    );

    const allIngredientIds = useMemo(
      () => allIngredients.map((ingredient) => ingredient.id),
      [allIngredients],
    );

    const selectedCount = selectedIngredientIds.size;
    const totalCount = allIngredientIds.length;
    const hasLists = lists && lists.length > 0;
    const isAddDisabled =
      !selectedListId || selectedCount === 0 || addRecipeMutation.isPending;

    const selectDefaultList = useCallback(() => {
      if (targetShoppingListId !== undefined) {
        setSelectedListId(targetShoppingListId);
        return;
      }

      if (!lists?.length) return;
      setSelectedListId((current) => {
        if (current && lists.some((list) => list.id === current)) {
          return current;
        }

        return lists.find((list) => list.isDefault)?.id ?? lists[0]?.id ?? null;
      });
    }, [lists, targetShoppingListId]);

    useEffect(() => {
      selectDefaultList();
    }, [selectDefaultList]);

    useEffect(() => {
      setSelectedServings(baseServings);
    }, [baseServings]);

    useImperativeHandle(ref, () => ({
      present: () => {
        setSelectedIngredientIds(new Set(allIngredientIds));
        setSelectedServings(baseServings);
        selectDefaultList();
        sheetRef.current?.present();
      },
      dismiss: () => sheetRef.current?.dismiss(),
    }));

    const handleDismiss = useCallback(() => {
      sheetRef.current?.dismiss();
    }, []);

    const handleSheetDismiss = useCallback(() => {
      setIsCreatingList(false);
      setNewListName("");
    }, []);

    const handleSelectList = (listId: number) => {
      setSelectedListId(listId);
    };

    const handleToggleIngredient = (ingredientId: number) => {
      setSelectedIngredientIds((current) => {
        const next = new Set(current);
        if (next.has(ingredientId)) {
          next.delete(ingredientId);
        } else {
          next.add(ingredientId);
        }
        return next;
      });
    };

    const handleSelectAllIngredients = () => {
      setSelectedIngredientIds(new Set(allIngredientIds));
    };

    const handleClearIngredients = () => {
      setSelectedIngredientIds(new Set());
    };

    const handleDecrementServings = () => {
      setSelectedServings((current) => Math.max(1, current - 1));
    };

    const handleIncrementServings = () => {
      setSelectedServings((current) => current + 1);
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
      if (!recipeId || !selectedListId || selectedCount === 0) return;

      try {
        await addRecipeMutation.mutateAsync({
          recipeId,
          shoppingListId: selectedListId,
          servings: canAdjustServings ? selectedServings : undefined,
          ingredientIds: Array.from(selectedIngredientIds),
        });
        handleDismiss();
      } catch {
        // Error handled in mutation
      }
    };

    const formatIngredient = (ing: Ingredient) => {
      const quantity = ing.quantity ? parseFloat(ing.quantity) : null;
      const scaledQuantity = quantity ? quantity * servingMultiplier : null;
      const formattedQuantity = scaledQuantity
        ? scaledQuantity % 1 === 0
          ? scaledQuantity.toString()
          : scaledQuantity.toFixed(2).replace(/\.?0+$/, "")
        : null;

      const displayUnit = formatUnit(ing.unit, scaledQuantity);
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

    const renderFooter = () => (
      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity
          style={[styles.addButton, isAddDisabled && styles.addButtonDisabled]}
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
              <Text style={styles.addButtonText}>
                Add {selectedCount}{" "}
                {selectedCount === 1 ? "Ingredient" : "Ingredients"}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    );

    return (
      <AppSheet
        ref={sheetRef}
        title="Add to Shopping List"
        subtitle={recipeName ? recipeName : "Choose ingredients"}
        detents={[1]}
        scrollable
        backgroundColor={theme.colors.background}
        footer={renderFooter()}
        onDidDismiss={handleSheetDismiss}
      >
        <ScrollView style={styles.scrollView}>
          <View style={styles.scrollContent}>
            {canAdjustServings ? (
              <View style={styles.servingsRow}>
                <View>
                  <Text type="heading">Servings</Text>
                  <Text type="caption" style={styles.sectionSubtitle}>
                    Adjust quantities before adding
                  </Text>
                </View>
                <View style={styles.servingsStepper}>
                  <TouchableOpacity
                    style={[
                      styles.stepperButton,
                      selectedServings <= 1 && styles.stepperButtonDisabled,
                    ]}
                    onPress={handleDecrementServings}
                    disabled={selectedServings <= 1}
                    accessibilityLabel="Decrease servings"
                  >
                    <Ionicons
                      name="remove"
                      size={20}
                      style={styles.stepperIcon}
                    />
                  </TouchableOpacity>
                  <View style={styles.servingsValueWrap}>
                    <Text style={styles.servingsValue}>{selectedServings}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.stepperButton}
                    onPress={handleIncrementServings}
                    accessibilityLabel="Increase servings"
                  >
                    <Ionicons name="add" size={20} style={styles.stepperIcon} />
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}

            <View style={styles.sectionHeadingRow}>
              <View>
                <Text type="heading">Ingredients</Text>
                <Text type="caption" style={styles.sectionSubtitle}>
                  {selectedCount} of {totalCount} selected
                </Text>
              </View>
              <TouchableOpacity
                style={styles.selectToggleButton}
                onPress={
                  selectedCount === totalCount
                    ? handleClearIngredients
                    : handleSelectAllIngredients
                }
                disabled={totalCount === 0}
              >
                <Text type="caption" style={styles.selectToggleText}>
                  {selectedCount === totalCount ? "Clear" : "Select all"}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.ingredientList}>
              {sections.map((section, sectionIndex) => (
                <View key={section.id ?? `section-${sectionIndex}`}>
                  {section.name ? (
                    <Text type="caption" style={styles.ingredientSectionTitle}>
                      {section.name}
                    </Text>
                  ) : null}
                  {section.ingredients.map((ingredient) => {
                    const isSelected = selectedIngredientIds.has(ingredient.id);

                    return (
                      <TouchableOpacity
                        key={ingredient.id}
                        style={styles.ingredientRow}
                        onPress={() => handleToggleIngredient(ingredient.id)}
                        activeOpacity={0.78}
                      >
                        <View
                          style={[
                            styles.checkCircle,
                            isSelected && styles.checkCircleSelected,
                          ]}
                        >
                          {isSelected ? (
                            <Ionicons
                              name="checkmark"
                              size={16}
                              style={styles.checkIcon}
                            />
                          ) : null}
                        </View>
                        <View style={styles.ingredientTextWrap}>
                          <Text type="body" style={styles.ingredientText}>
                            {formatIngredient(ingredient)}
                          </Text>
                          {ingredient.preparation ? (
                            <Text type="caption" style={styles.preparationText}>
                              {ingredient.preparation}
                            </Text>
                          ) : null}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </View>

            {isTargetListLocked ? null : isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" />
              </View>
            ) : (
              <>
                <View style={styles.sectionHeadingRow}>
                  <View>
                    <Text type="heading">Shopping List</Text>
                    <Text type="caption" style={styles.sectionSubtitle}>
                      Choose where these items should go
                    </Text>
                  </View>
                </View>

                {hasLists ? (
                  <View style={styles.group}>
                    {lists.map((list, index) => (
                      <TouchableOpacity
                        key={list.id}
                        style={[
                          styles.listRow,
                          index === lists.length - 1 && styles.lastGroupRow,
                        ]}
                        onPress={() => handleSelectList(list.id)}
                        activeOpacity={0.78}
                      >
                        <View style={styles.listInfo}>
                          <Ionicons
                            name={
                              list.isOwner ? "list-outline" : "people-outline"
                            }
                            size={20}
                            style={styles.listIcon}
                          />
                          <View style={styles.listTextWrap}>
                            <Text type="body" numberOfLines={1}>
                              {list.name}
                            </Text>
                            {!list.isOwner ? (
                              <Text type="caption" style={styles.listMeta}>
                                Shared by {list.owner.name}
                              </Text>
                            ) : list.isDefault ? (
                              <Text type="caption" style={styles.listMeta}>
                                Default
                              </Text>
                            ) : null}
                          </View>
                        </View>
                        {selectedListId === list.id ? (
                          <Ionicons
                            name="checkmark-circle"
                            size={24}
                            style={styles.selectedListIcon}
                          />
                        ) : (
                          <View style={styles.radio} />
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : (
                  <View style={styles.emptyState}>
                    <Text type="bodyFaded" style={styles.emptyText}>
                      Create a shopping list to add these ingredients.
                    </Text>
                  </View>
                )}

                {isCreatingList ? (
                  <View style={styles.createListPanel}>
                    <Text type="heading">New list name</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. Weekly Groceries"
                      placeholderTextColor={theme.colors.placeholderText}
                      value={newListName}
                      onChangeText={setNewListName}
                      autoFocus
                    />
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
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.newListButton}
                    onPress={() => setIsCreatingList(true)}
                    activeOpacity={0.78}
                  >
                    <Ionicons
                      name="add-circle-outline"
                      size={22}
                      style={styles.newListIcon}
                    />
                    <Text type="body" style={styles.newListText}>
                      Create new list
                    </Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        </ScrollView>
      </AppSheet>
    );
  },
);

const styles = StyleSheet.create((theme) => ({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 24,
    gap: 14,
  },
  sectionHeadingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  sectionSubtitle: {
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  selectToggleButton: {
    minHeight: 32,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: theme.colors.inputBackground,
  },
  selectToggleText: {
    color: theme.colors.primary,
    fontFamily: theme.fonts.semiBold,
  },
  servingsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    paddingVertical: 4,
  },
  servingsStepper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  stepperButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.inputBackground,
  },
  stepperButtonDisabled: {
    opacity: 0.35,
  },
  stepperIcon: {
    color: theme.colors.primary,
  },
  servingsValueWrap: {
    minWidth: 34,
    alignItems: "center",
  },
  servingsValue: {
    color: theme.colors.text,
    fontSize: 22,
    lineHeight: 28,
    fontFamily: theme.fonts.bold,
  },
  group: {
    overflow: "hidden",
    borderRadius: theme.borderRadius.medium,
    backgroundColor: theme.colors.inputBackground,
  },
  ingredientList: {
    gap: 2,
  },
  ingredientSectionTitle: {
    paddingHorizontal: 2,
    paddingTop: 8,
    paddingBottom: 6,
    color: theme.colors.textSecondary,
    textTransform: "uppercase",
    fontFamily: theme.fonts.semiBold,
  },
  ingredientRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    minHeight: 46,
    paddingVertical: 8,
    paddingHorizontal: 2,
  },
  lastGroupRow: {
    borderBottomWidth: 0,
  },
  checkCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.background,
  },
  checkCircleSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary,
  },
  checkIcon: {
    color: theme.colors.buttonText,
  },
  ingredientTextWrap: {
    flex: 1,
    gap: 2,
  },
  ingredientText: {
    flex: 1,
  },
  preparationText: {
    color: theme.colors.textSecondary,
  },
  loadingContainer: {
    alignItems: "center",
    paddingVertical: 32,
  },
  listRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 13,
    paddingHorizontal: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
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
  listTextWrap: {
    flex: 1,
  },
  listMeta: {
    color: theme.colors.textSecondary,
    marginTop: 1,
  },
  selectedListIcon: {
    color: theme.colors.primary,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  emptyState: {
    padding: 18,
    borderRadius: theme.borderRadius.medium,
    backgroundColor: theme.colors.inputBackground,
  },
  emptyText: {
    textAlign: "center",
  },
  createListPanel: {
    gap: 12,
    padding: 14,
    borderRadius: theme.borderRadius.medium,
    backgroundColor: theme.colors.inputBackground,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.medium,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    color: theme.colors.text,
    backgroundColor: theme.colors.background,
  },
  createActions: {
    flexDirection: "row",
    gap: 10,
  },
  cancelButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.background,
  },
  createButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.primary,
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
    gap: 8,
    minHeight: 48,
    borderRadius: theme.borderRadius.medium,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderStyle: "dashed",
  },
  newListIcon: {
    color: theme.colors.textSecondary,
  },
  newListText: {
    color: theme.colors.textSecondary,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
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
