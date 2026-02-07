import { Ionicons } from "@expo/vector-icons";
import { TrueSheet } from "@lodev09/react-native-true-sheet";
import { forwardRef, useState, useImperativeHandle, useRef } from "react";
import {
  View,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { StyleSheet, UnistylesRuntime } from "react-native-unistyles";

import {
  useGetUserShoppingLists,
  useCreateShoppingList,
  useDeleteShoppingList,
  type ShoppingListWithMeta,
} from "../../api/shopping";
import { VSpace } from "../Space";
import { Text } from "../Text";

interface ListItemProps {
  list: ShoppingListWithMeta;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
  showDelete: boolean;
}

const ListItem = ({
  list,
  isActive,
  onSelect,
  onDelete,
  showDelete,
}: ListItemProps) => {
  return (
    <TouchableOpacity style={styles.planRow} onPress={onSelect}>
      <View style={styles.planInfo}>
        <View style={styles.planNameRow}>
          <Text type="body">{list.name}</Text>
          {list.isDefault && (
            <View style={styles.defaultBadge}>
              <Text type="caption" style={styles.defaultBadgeText}>
                Default
              </Text>
            </View>
          )}
          {!list.isOwner && (
            <View style={styles.sharedBadge}>
              <Ionicons name="people" size={12} style={styles.sharedIcon} />
              <Text type="caption" style={styles.sharedBadgeText}>
                {list.owner.name}
              </Text>
            </View>
          )}
        </View>
      </View>
      <View style={styles.planActions}>
        {showDelete && !list.isDefault && list.isOwner && (
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            style={styles.deleteButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons
              name="trash-outline"
              size={18}
              style={styles.deleteIcon}
            />
          </TouchableOpacity>
        )}
        {isActive && (
          <Ionicons
            name="checkmark-circle"
            size={24}
            style={styles.checkIcon}
          />
        )}
      </View>
    </TouchableOpacity>
  );
};

export interface ShoppingListPickerSheetProps {
  activeListId?: number;
  onSelectList?: (listId: number) => void;
}

export interface ShoppingListPickerSheetRef {
  present: () => void;
  dismiss: () => void;
}

export const ShoppingListPickerSheet = forwardRef<
  ShoppingListPickerSheetRef,
  ShoppingListPickerSheetProps
>(({ activeListId, onSelectList }, ref) => {
  const theme = UnistylesRuntime.getTheme();
  const sheetRef = useRef<TrueSheet>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [listToDelete, setListToDelete] = useState<number | null>(null);

  const { data: shoppingLists, isLoading } = useGetUserShoppingLists();
  const createMutation = useCreateShoppingList();
  const deleteMutation = useDeleteShoppingList();

  useImperativeHandle(ref, () => ({
    present: () => sheetRef.current?.present(),
    dismiss: () => sheetRef.current?.dismiss(),
  }));

  const handleClose = () => {
    sheetRef.current?.dismiss();
  };

  const handleSelectList = (listId: number) => {
    onSelectList?.(listId);
    sheetRef.current?.dismiss();
  };

  const handleCreateList = async () => {
    if (!newListName.trim()) return;

    try {
      const newList = await createMutation.mutateAsync({
        name: newListName.trim(),
      });
      if (newList) {
        onSelectList?.(newList.id);
      }
      setNewListName("");
      setIsCreating(false);
      sheetRef.current?.dismiss();
    } catch {
      // Error handled by mutation
    }
  };

  const handleDeleteList = async (listId: number) => {
    setListToDelete(listId);
    try {
      await deleteMutation.mutateAsync({ shoppingListId: listId });
      // If we deleted the active list, switch to the default
      if (listId === activeListId) {
        const defaultList = shoppingLists?.find((l) => l.isDefault);
        if (defaultList) {
          onSelectList?.(defaultList.id);
        }
      }
    } catch {
      // Error handled by mutation
    } finally {
      setListToDelete(null);
    }
  };

  const ownedLists = shoppingLists?.filter((l) => l.isOwner) ?? [];
  const sharedLists = shoppingLists?.filter((l) => !l.isOwner) ?? [];

  return (
    <TrueSheet
      ref={sheetRef}
      detents={["auto"]}
      grabber={false}
      backgroundColor={theme.colors.background}
    >
      <View>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerSpacer} />
          <Text type="headline">Select Shopping List</Text>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <View style={styles.closeButtonCircle}>
              <Ionicons name="close" size={16} style={styles.closeIcon} />
            </View>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scrollView}>
          <View style={styles.scrollContent}>
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" />
              </View>
            ) : (
              <>
                {/* Your Lists */}
                {ownedLists.length > 0 && (
                  <>
                    <Text type="heading" style={styles.sectionTitle}>
                      Your Lists
                    </Text>
                    <VSpace size={12} />
                    {ownedLists.map((list) => (
                      <ListItem
                        key={list.id}
                        list={list}
                        isActive={list.id === activeListId}
                        onSelect={() => handleSelectList(list.id)}
                        onDelete={() => handleDeleteList(list.id)}
                        showDelete={listToDelete !== list.id}
                      />
                    ))}
                    <VSpace size={20} />
                  </>
                )}

                {/* Shared Lists */}
                {sharedLists.length > 0 && (
                  <>
                    <Text type="heading" style={styles.sectionTitle}>
                      Shared With You
                    </Text>
                    <VSpace size={12} />
                    {sharedLists.map((list) => (
                      <ListItem
                        key={list.id}
                        list={list}
                        isActive={list.id === activeListId}
                        onSelect={() => handleSelectList(list.id)}
                        onDelete={() => {}}
                        showDelete={false}
                      />
                    ))}
                    <VSpace size={20} />
                  </>
                )}

                {/* Create New List */}
                {isCreating ? (
                  <>
                    <Text type="heading" style={styles.sectionTitle}>
                      New List Name
                    </Text>
                    <VSpace size={12} />
                    <TextInput
                      style={styles.input}
                      placeholder="e.g., Weekend BBQ"
                      placeholderTextColor="#999"
                      value={newListName}
                      onChangeText={setNewListName}
                      autoFocus
                    />
                    <VSpace size={12} />
                    <View style={styles.createActions}>
                      <TouchableOpacity
                        style={styles.cancelButton}
                        onPress={() => {
                          setNewListName("");
                          setIsCreating(false);
                        }}
                      >
                        <Text type="body">Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.saveButton,
                          (!newListName.trim() || createMutation.isPending) &&
                            styles.saveButtonDisabled,
                        ]}
                        onPress={handleCreateList}
                        disabled={
                          !newListName.trim() || createMutation.isPending
                        }
                      >
                        {createMutation.isPending ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Text type="highlight" style={styles.saveButtonText}>
                            Create
                          </Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </>
                ) : (
                  <TouchableOpacity
                    style={styles.createButton}
                    onPress={() => setIsCreating(true)}
                  >
                    <Ionicons
                      name="add-circle-outline"
                      size={24}
                      style={styles.createIcon}
                    />
                    <Text type="body" style={styles.createText}>
                      Create new list
                    </Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        </ScrollView>
      </View>
    </TrueSheet>
  );
});

const styles = StyleSheet.create((theme) => ({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerSpacer: {
    width: 30,
  },
  closeButton: {
    padding: 4,
  },
  closeButtonCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: theme.colors.inputBackground,
    justifyContent: "center",
    alignItems: "center",
  },
  closeIcon: {
    color: theme.colors.textSecondary,
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
  planRow: {
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
  planInfo: {
    flex: 1,
    marginRight: 12,
  },
  planNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  defaultBadge: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.small,
  },
  defaultBadgeText: {
    color: theme.colors.buttonText,
    fontWeight: "600",
  },
  sharedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: theme.colors.inputBackground,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.small,
  },
  sharedIcon: {
    color: theme.colors.textSecondary,
  },
  sharedBadgeText: {
    color: theme.colors.textSecondary,
  },
  planActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  deleteButton: {
    padding: 4,
  },
  deleteIcon: {
    color: theme.colors.destructive,
  },
  checkIcon: {
    color: theme.colors.primary,
  },
  input: {
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
  saveButton: {
    flex: 1,
    backgroundColor: theme.colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: theme.borderRadius.medium,
    alignItems: "center",
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: theme.colors.buttonText,
  },
  createButton: {
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
  createIcon: {
    color: theme.colors.text,
    opacity: 0.6,
    marginRight: 8,
  },
  createText: {
    color: theme.colors.text,
    opacity: 0.6,
  },
}));
