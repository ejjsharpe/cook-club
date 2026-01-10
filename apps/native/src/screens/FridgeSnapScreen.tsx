import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import {
  View,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { StyleSheet, UnistylesRuntime } from "react-native-unistyles";

import {
  useIdentifyIngredients,
  useGetRecipeSuggestions,
  useGenerateRecipeFromSuggestion,
  type RecipeSuggestion,
  type GeneratedRecipeResult,
} from "@/api/fridgeSnap";
import { IngredientChipEditor } from "@/components/IngredientChipEditor";
import { RecipeSuggestionCard } from "@/components/RecipeSuggestionCard";
import { SafeAreaView } from "@/components/SafeAreaView";
import { VSpace } from "@/components/Space";
import { Text } from "@/components/Text";
import { BackButton } from "@/components/buttons/BackButton";
import { PrimaryButton } from "@/components/buttons/PrimaryButton";
import { imageToBase64 } from "@/utils/imageUtils";

type Step =
  | "capture"
  | "identifying"
  | "review"
  | "suggesting"
  | "select"
  | "generating"
  | "preview";

interface State {
  step: Step;
  imageUri: string | null;
  ingredients: string[];
  suggestions: RecipeSuggestion[];
  selectedSuggestion: RecipeSuggestion | null;
  generatedRecipe: GeneratedRecipeResult | null;
}

const INITIAL_STATE: State = {
  step: "capture",
  imageUri: null,
  ingredients: [],
  suggestions: [],
  selectedSuggestion: null,
  generatedRecipe: null,
};

export const FridgeSnapScreen = () => {
  const { navigate } = useNavigation();
  const theme = UnistylesRuntime.getTheme();
  const [state, setState] = useState<State>(INITIAL_STATE);

  const identifyMutation = useIdentifyIngredients();
  const suggestMutation = useGetRecipeSuggestions();
  const generateMutation = useGenerateRecipeFromSuggestion();

  const handleImageSelected = async (uri: string) => {
    setState((s) => ({ ...s, imageUri: uri, step: "identifying" }));

    try {
      const { base64, mimeType } = await imageToBase64(uri);

      const result = await identifyMutation.mutateAsync({
        imageBase64: base64,
        mimeType,
      });

      setState((s) => ({
        ...s,
        ingredients: result.ingredients,
        step: "review",
      }));
    } catch {
      Alert.alert(
        "Error",
        "Failed to identify ingredients. Please try again.",
        [{ text: "OK", onPress: () => setState(INITIAL_STATE) }],
      );
    }
  };

  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission Required",
        "Camera permission is needed to take photos.",
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      allowsEditing: false,
    });

    if (!result.canceled && result.assets[0]) {
      handleImageSelected(result.assets[0].uri);
    }
  };

  const handlePickFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission Required",
        "Photo library permission is needed to select photos.",
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      allowsEditing: false,
    });

    if (!result.canceled && result.assets[0]) {
      handleImageSelected(result.assets[0].uri);
    }
  };

  const handleFindRecipes = async () => {
    if (state.ingredients.length === 0) {
      Alert.alert("No Ingredients", "Please add at least one ingredient.");
      return;
    }

    setState((s) => ({ ...s, step: "suggesting" }));

    try {
      const result = await suggestMutation.mutateAsync({
        ingredients: state.ingredients,
        count: 4,
      });

      setState((s) => ({
        ...s,
        suggestions: result.suggestions,
        step: "select",
      }));
    } catch {
      Alert.alert(
        "Error",
        "Failed to get recipe suggestions. Please try again.",
        [
          {
            text: "OK",
            onPress: () => setState((s) => ({ ...s, step: "review" })),
          },
        ],
      );
    }
  };

  const handleSelectSuggestion = async (suggestion: RecipeSuggestion) => {
    setState((s) => ({
      ...s,
      selectedSuggestion: suggestion,
      step: "generating",
    }));

    try {
      const result = await generateMutation.mutateAsync({
        suggestion,
        availableIngredients: state.ingredients,
      });

      setState((s) => ({
        ...s,
        generatedRecipe: result,
        step: "preview",
      }));
    } catch {
      Alert.alert("Error", "Failed to generate recipe. Please try again.", [
        {
          text: "OK",
          onPress: () => setState((s) => ({ ...s, step: "select" })),
        },
      ]);
    }
  };

  const handleEditRecipe = () => {
    if (state.generatedRecipe) {
      navigate("EditRecipe", { parsedRecipe: state.generatedRecipe });
    }
  };

  const handleStartOver = () => {
    setState(INITIAL_STATE);
  };

  // Render step content
  const renderStepContent = () => {
    switch (state.step) {
      case "capture":
        return (
          <View style={styles.captureContainer}>
            <Text type="title2" style={styles.centeredText}>
              Take a photo of your fridge
            </Text>
            <VSpace size={8} />
            <Text type="subheadline" style={styles.captureSubtitle}>
              We'll identify ingredients and suggest recipes you can make
            </Text>
            <VSpace size={32} />

            <TouchableOpacity
              style={styles.captureButton}
              onPress={handleTakePhoto}
            >
              <Ionicons name="camera" size={48} color={theme.colors.primary} />
              <Text type="headline" style={styles.captureButtonText}>
                Take Photo
              </Text>
            </TouchableOpacity>

            <VSpace size={16} />

            <TouchableOpacity
              style={styles.galleryButton}
              onPress={handlePickFromGallery}
            >
              <Ionicons
                name="images-outline"
                size={24}
                color={theme.colors.text}
              />
              <Text type="body">Choose from Gallery</Text>
            </TouchableOpacity>
          </View>
        );

      case "identifying":
      case "suggesting":
      case "generating":
        return (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <VSpace size={16} />
            <Text type="headline" style={styles.centeredText}>
              {state.step === "identifying" && "Identifying ingredients..."}
              {state.step === "suggesting" && "Finding recipes..."}
              {state.step === "generating" && "Creating recipe..."}
            </Text>
          </View>
        );

      case "review":
        return (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {state.imageUri && (
              <View style={styles.imagePreviewContainer}>
                <Image
                  source={{ uri: state.imageUri }}
                  style={styles.imagePreview}
                  contentFit="cover"
                />
              </View>
            )}

            <VSpace size={24} />

            <Text type="title3">Ingredients Found</Text>
            <VSpace size={8} />
            <Text type="subheadline" style={styles.subtitle}>
              Add or remove ingredients as needed
            </Text>
            <VSpace size={16} />

            <IngredientChipEditor
              ingredients={state.ingredients}
              onIngredientsChange={(ingredients) =>
                setState((s) => ({ ...s, ingredients }))
              }
            />

            <VSpace size={32} />

            <PrimaryButton
              onPress={handleFindRecipes}
              disabled={state.ingredients.length === 0}
            >
              Find Recipes
            </PrimaryButton>
          </ScrollView>
        );

      case "select":
        return (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <Text type="title3">Recipe Suggestions</Text>
            <VSpace size={8} />
            <Text type="subheadline" style={styles.subtitle}>
              Select a recipe to view the full details
            </Text>
            <VSpace size={16} />

            {state.suggestions.map((suggestion) => (
              <View key={suggestion.id}>
                <RecipeSuggestionCard
                  suggestion={suggestion}
                  onSelect={() => handleSelectSuggestion(suggestion)}
                  selected={state.selectedSuggestion?.id === suggestion.id}
                />
                <VSpace size={12} />
              </View>
            ))}

            <VSpace size={16} />

            <TouchableOpacity
              style={styles.startOverButton}
              onPress={handleStartOver}
            >
              <Text type="body" style={styles.startOverText}>
                Start Over
              </Text>
            </TouchableOpacity>
          </ScrollView>
        );

      case "preview":
        return (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {state.generatedRecipe?.success && (
              <>
                <Text type="title2">{state.generatedRecipe.data.name}</Text>
                <VSpace size={8} />

                {state.generatedRecipe.data.description && (
                  <>
                    <Text type="subheadline" style={styles.subtitle}>
                      {state.generatedRecipe.data.description}
                    </Text>
                    <VSpace size={16} />
                  </>
                )}

                <View style={styles.metaRow}>
                  {state.generatedRecipe.data.totalTime && (
                    <View style={styles.metaItem}>
                      <Ionicons
                        name="time-outline"
                        size={16}
                        color={theme.colors.textSecondary}
                      />
                      <Text type="subheadline" style={styles.metaText}>
                        {state.generatedRecipe.data.totalTime} min
                      </Text>
                    </View>
                  )}
                  {state.generatedRecipe.data.servings && (
                    <View style={styles.metaItem}>
                      <Ionicons
                        name="people-outline"
                        size={16}
                        color={theme.colors.textSecondary}
                      />
                      <Text type="subheadline" style={styles.metaText}>
                        {state.generatedRecipe.data.servings} servings
                      </Text>
                    </View>
                  )}
                </View>

                <VSpace size={24} />

                <Text type="headline">Ingredients</Text>
                <VSpace size={8} />
                {state.generatedRecipe.data.ingredientSections.map(
                  (section, sectionIndex) => (
                    <View key={sectionIndex}>
                      {section.name && (
                        <>
                          <Text type="body" style={styles.sectionName}>
                            {section.name}
                          </Text>
                          <VSpace size={4} />
                        </>
                      )}
                      {section.ingredients.map((ing, index) => (
                        <Text
                          key={index}
                          type="subheadline"
                          style={styles.listItem}
                        >
                          • {ing.quantity} {ing.unit} {ing.name}
                        </Text>
                      ))}
                      <VSpace size={8} />
                    </View>
                  ),
                )}

                <VSpace size={16} />

                <Text type="headline">Instructions</Text>
                <VSpace size={8} />
                {state.generatedRecipe.data.instructionSections.map(
                  (section, sectionIndex) => (
                    <View key={sectionIndex}>
                      {section.name && (
                        <>
                          <Text type="body" style={styles.sectionName}>
                            {section.name}
                          </Text>
                          <VSpace size={4} />
                        </>
                      )}
                      {section.instructions.map((inst, index) => (
                        <View key={index} style={styles.instructionItem}>
                          <Text type="body" style={styles.stepNumber}>
                            {inst.index + 1}.
                          </Text>
                          <Text
                            type="subheadline"
                            style={styles.instructionText}
                          >
                            {inst.instruction}
                          </Text>
                        </View>
                      ))}
                      <VSpace size={8} />
                    </View>
                  ),
                )}

                <VSpace size={32} />

                <PrimaryButton onPress={handleEditRecipe}>
                  Save Recipe
                </PrimaryButton>

                <VSpace size={12} />

                <TouchableOpacity
                  style={styles.startOverButton}
                  onPress={handleStartOver}
                >
                  <Text type="body" style={styles.startOverText}>
                    Start Over
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        );

      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <BackButton />
        <Text type="headline">Fridge Snap</Text>
        <View style={styles.headerSpacer} />
      </View>

      {renderStepContent()}
    </SafeAreaView>
  );
};

export default FridgeSnapScreen;

const styles = StyleSheet.create((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  captureContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  centeredText: {
    textAlign: "center",
  },
  captureSubtitle: {
    textAlign: "center",
    color: theme.colors.textSecondary,
    paddingHorizontal: 20,
  },
  captureButton: {
    width: 160,
    height: 160,
    borderRadius: theme.borderRadius.large,
    backgroundColor: theme.colors.primary + "15",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  captureButtonText: {
    color: theme.colors.primary,
  },
  galleryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  imagePreviewContainer: {
    width: "100%",
    aspectRatio: 4 / 3,
    borderRadius: theme.borderRadius.large,
    overflow: "hidden",
  },
  imagePreview: {
    width: "100%",
    height: "100%",
  },
  subtitle: {
    color: theme.colors.textSecondary,
  },
  metaRow: {
    flexDirection: "row",
    gap: 16,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    color: theme.colors.textSecondary,
  },
  sectionName: {
    fontWeight: "600",
    color: theme.colors.textSecondary,
  },
  listItem: {
    color: theme.colors.text,
    marginVertical: 2,
  },
  instructionItem: {
    flexDirection: "row",
    gap: 8,
    marginVertical: 4,
  },
  stepNumber: {
    fontWeight: "600",
    color: theme.colors.primary,
    minWidth: 24,
  },
  instructionText: {
    flex: 1,
    color: theme.colors.text,
  },
  startOverButton: {
    alignItems: "center",
    padding: 12,
  },
  startOverText: {
    color: theme.colors.textSecondary,
  },
}));
