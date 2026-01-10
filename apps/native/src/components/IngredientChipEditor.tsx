import { Ionicons } from "@expo/vector-icons";
import { useState, useRef } from "react";
import {
  View,
  TouchableOpacity,
  TextInput,
  Keyboard,
  LayoutAnimation,
} from "react-native";
import { StyleSheet, UnistylesRuntime } from "react-native-unistyles";

import { Text } from "./Text";

interface Props {
  ingredients: string[];
  onIngredientsChange: (ingredients: string[]) => void;
  editable?: boolean;
}

export const IngredientChipEditor = ({
  ingredients,
  onIngredientsChange,
  editable = true,
}: Props) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newIngredient, setNewIngredient] = useState("");
  const inputRef = useRef<TextInput>(null);
  const theme = UnistylesRuntime.getTheme();

  const handleRemove = (index: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const newIngredients = [...ingredients];
    newIngredients.splice(index, 1);
    onIngredientsChange(newIngredients);
  };

  const handleAdd = () => {
    const trimmed = newIngredient.trim().toLowerCase();
    if (trimmed && !ingredients.includes(trimmed)) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      onIngredientsChange([...ingredients, trimmed]);
    }
    setNewIngredient("");
    setIsAdding(false);
    Keyboard.dismiss();
  };

  const handleStartAdding = () => {
    setIsAdding(true);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handleCancelAdding = () => {
    setNewIngredient("");
    setIsAdding(false);
    Keyboard.dismiss();
  };

  return (
    <View style={styles.container}>
      {ingredients.map((ingredient, index) => (
        <View key={`${ingredient}-${index}`} style={styles.chip}>
          <Text type="body" style={styles.chipText}>
            {ingredient}
          </Text>
          {editable && (
            <TouchableOpacity
              onPress={() => handleRemove(index)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name="close-circle"
                size={18}
                color={theme.colors.textSecondary}
              />
            </TouchableOpacity>
          )}
        </View>
      ))}

      {editable && !isAdding && (
        <TouchableOpacity style={styles.addButton} onPress={handleStartAdding}>
          <Ionicons name="add" size={18} color={theme.colors.primary} />
          <Text type="body" style={styles.addButtonText}>
            Add
          </Text>
        </TouchableOpacity>
      )}

      {editable && isAdding && (
        <View style={styles.inputContainer}>
          <TextInput
            ref={inputRef}
            style={styles.input}
            value={newIngredient}
            onChangeText={setNewIngredient}
            placeholder="Ingredient name"
            placeholderTextColor={theme.colors.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={handleAdd}
            onBlur={handleCancelAdding}
          />
          <TouchableOpacity onPress={handleAdd} style={styles.confirmButton}>
            <Ionicons name="checkmark" size={20} color={theme.colors.primary} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create((theme) => ({
  container: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.inputBackground,
  },
  chipText: {
    color: theme.colors.text,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    borderStyle: "dashed",
  },
  addButtonText: {
    color: theme.colors.primary,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: theme.colors.inputBackground,
    borderRadius: theme.borderRadius.full,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontFamily: theme.fonts.albertRegular,
    color: theme.colors.text,
    paddingVertical: 4,
    minWidth: 100,
  },
  confirmButton: {
    padding: 4,
  },
}));
