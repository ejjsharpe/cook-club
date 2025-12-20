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
  registerSheet,
  SheetDefinition,
  SheetProps,
  ScrollView,
} from "react-native-actions-sheet";
import { StyleSheet } from "react-native-unistyles";

import { VSpace } from "./Space";
import { Text } from "./Text";
import {
  useGetUserCollections,
  useToggleRecipeInCollection,
  useCreateCollection,
} from "../api/collection";

interface CollectionSelectorPayload {
  recipeId: number;
}

// Extend the Sheets interface for TypeScript
declare module "react-native-actions-sheet" {
  interface Sheets {
    "collection-selector-sheet": SheetDefinition<{
      payload: CollectionSelectorPayload;
    }>;
  }
}

const CollectionSelectorSheet = (
  props: SheetProps<"collection-selector-sheet">,
) => {
  const { recipeId } = props.payload || {};
  const [newCollectionName, setNewCollectionName] = useState("");
  const [isCreatingCollection, setIsCreatingCollection] = useState(false);

  const { data: collections, isLoading } = useGetUserCollections({ recipeId });
  const toggleMutation = useToggleRecipeInCollection();
  const createCollectionMutation = useCreateCollection();

  const handleToggleCollection = (collectionId: number) => {
    if (!recipeId) return;
    toggleMutation.mutate({ recipeId, collectionId });
  };

  const handleCreateCollection = async () => {
    if (!newCollectionName.trim()) return;

    try {
      const newCollection = await createCollectionMutation.mutateAsync({
        name: newCollectionName.trim(),
      });

      if (newCollection && recipeId) {
        await toggleMutation.mutateAsync({
          recipeId,
          collectionId: newCollection.id,
        });
      }

      setNewCollectionName("");
      setIsCreatingCollection(false);
    } catch (error) {
      // Error handling is done in the mutation
    }
  };

  const hasCollections = collections && collections.length > 0;

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
          <Text type="title2">Save to collection</Text>
          <TouchableOpacity
            onPress={() => SheetManager.hide("collection-selector-sheet")}
          >
            <Ionicons name="close" size={28} style={styles.closeIcon} />
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
                {/* Collections List */}
                {hasCollections ? (
                  <>
                    <Text type="heading" style={styles.sectionTitle}>
                      Your collections
                    </Text>
                    <VSpace size={12} />
                    {collections.map((collection) => (
                      <TouchableOpacity
                        key={collection.id}
                        style={styles.collectionRow}
                        onPress={() => handleToggleCollection(collection.id)}
                        disabled={toggleMutation.isPending}
                      >
                        <View style={styles.collectionInfo}>
                          {collection.isDefault && (
                            <Ionicons
                              name="bookmark"
                              size={18}
                              style={styles.defaultIcon}
                            />
                          )}
                          <Text type="body">{collection.name}</Text>
                          {collection.isDefault && (
                            <View style={styles.defaultBadge}>
                              <Text style={styles.defaultText}>Default</Text>
                            </View>
                          )}
                        </View>
                        <View
                          style={[
                            styles.checkbox,
                            collection.hasRecipe && styles.checkboxSelected,
                          ]}
                        >
                          {collection.hasRecipe && (
                            <Ionicons
                              name="checkmark"
                              size={18}
                              style={styles.checkIcon}
                            />
                          )}
                        </View>
                      </TouchableOpacity>
                    ))}
                    <VSpace size={24} />
                  </>
                ) : (
                  <>
                    <Text type="bodyFaded" style={styles.emptyText}>
                      You don't have any collections yet. Create your first one
                      below!
                    </Text>
                    <VSpace size={24} />
                  </>
                )}

                {/* Create New Collection */}
                {isCreatingCollection ? (
                  <>
                    <Text type="heading" style={styles.sectionTitle}>
                      New collection name
                    </Text>
                    <VSpace size={12} />
                    <View style={styles.inputRow}>
                      <TextInput
                        style={styles.input}
                        placeholder="e.g., Breakfast Ideas"
                        placeholderTextColor="#999"
                        value={newCollectionName}
                        onChangeText={setNewCollectionName}
                        autoFocus
                      />
                    </View>
                    <VSpace size={12} />
                    <View style={styles.createActions}>
                      <TouchableOpacity
                        style={styles.cancelButton}
                        onPress={() => {
                          setNewCollectionName("");
                          setIsCreatingCollection(false);
                        }}
                      >
                        <Text type="body">Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.saveButton,
                          (!newCollectionName.trim() ||
                            createCollectionMutation.isPending) &&
                            styles.saveButtonDisabled,
                        ]}
                        onPress={handleCreateCollection}
                        disabled={
                          !newCollectionName.trim() ||
                          createCollectionMutation.isPending
                        }
                      >
                        {createCollectionMutation.isPending ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Text type="highlight" style={styles.saveButtonText}>
                            Create & Save
                          </Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </>
                ) : (
                  <TouchableOpacity
                    style={styles.createButton}
                    onPress={() => setIsCreatingCollection(true)}
                  >
                    <Ionicons
                      name="add-circle-outline"
                      size={24}
                      style={styles.createIcon}
                    />
                    <Text type="body" style={styles.createText}>
                      Create new collection
                    </Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        </ScrollView>
      </View>
    </ActionSheet>
  );
};

registerSheet("collection-selector-sheet", CollectionSelectorSheet);

export { SheetManager as CollectionSheetManager };

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
  collectionRow: {
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
  collectionInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 8,
  },
  defaultIcon: {
    color: theme.colors.primary,
  },
  defaultBadge: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.small,
  },
  defaultText: {
    color: theme.colors.buttonText,
    fontSize: 11,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  checkIcon: {
    color: theme.colors.buttonText,
  },
  emptyText: {
    textAlign: "center",
    paddingVertical: 20,
  },
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
