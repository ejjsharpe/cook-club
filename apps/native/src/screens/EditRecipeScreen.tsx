import React, { useState } from 'react';
import { View, ScrollView, TouchableOpacity, Alert, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { Input } from '@/components/Input';
import { Text } from '@/components/Text';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { BackButton } from '@/components/buttons/BackButton';
import { VSpace } from '@/components/Space';
import { TimePicker } from '@/components/TimePicker';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { useTRPC } from '@repo/trpc/client';
import { useMutation } from '@tanstack/react-query';
import { TimeValue, parseDuration, formatDurationISO } from '@/utils/timeUtils';

export default function EditRecipeScreen() {
  const route = useRoute<RouteProp<ReactNavigation.RootParamList, 'EditRecipe'>>();
  const prefill = route.params?.scrapedRecipe;
  const navigation = useNavigation();
  const trpc = useTRPC();

  const [title, setTitle] = useState(prefill?.name || '');
  const [author, setAuthor] = useState(prefill?.author || '');
  const [description, setDescription] = useState(prefill?.description || '');
  const [prepTime, setPrepTime] = useState<TimeValue>(parseDuration(prefill?.prepTime || ''));
  const [cookTime, setCookTime] = useState<TimeValue>(parseDuration(prefill?.cookTime || ''));
  const [servings, setServings] = useState<number>(prefill?.servings || 4);
  const [ingredients, setIngredients] = useState<string[]>(prefill?.ingredients || ['']);
  const [method, setMethod] = useState<string[]>(prefill?.instructions || ['']);
  const [images, setImages] = useState<string[]>(prefill?.images || []);

  const updateIngredient = (idx: number, value: string) => {
    setIngredients((prev) => prev.map((ing, i) => (i === idx ? value : ing)));
  };

  const addIngredient = () => {
    setIngredients((prev) => [...prev, '']);
  };

  const removeIngredient = (idx: number) => {
    setIngredients((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateMethod = (idx: number, value: string) => {
    setMethod((prev) => prev.map((step, i) => (i === idx ? value : step)));
  };

  const addMethod = () => {
    setMethod((prev) => [...prev, '']);
  };

  const removeMethod = (idx: number) => {
    setMethod((prev) => prev.filter((_, i) => i !== idx));
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setImages((prev) => [...prev, ...result.assets.map((item) => item.uri)]);
    }
  };

  const removeImage = (idx: number) => {
    setImages((prev) => prev.filter((_, i) => i !== idx));
  };

  const saveRecipeMutation = useMutation({
    ...trpc.recipe.postRecipe.mutationOptions(),
    onSuccess: () => {
      navigation.navigate('Recipe Detail');
    },
  });

  const onSave = () => {
    // Validate required fields
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a recipe title');
      return;
    }

    if (ingredients.filter((ing) => ing.trim()).length === 0) {
      Alert.alert('Error', 'Please add at least one ingredient');
      return;
    }

    if (method.filter((step) => step.trim()).length === 0) {
      Alert.alert('Error', 'Please add at least one cooking step');
      return;
    }

    if (images.length === 0) {
      Alert.alert('Error', 'Please add at least one image');
      return;
    }

    // Determine if this is a scraped recipe
    const isScrapedRecipe = !!prefill?.sourceUrl;

    // Prepare recipe data
    const recipeData = {
      name: title.trim(),
      description: description.trim() || undefined,
      prepTime: formatDurationISO(prepTime) || undefined,
      cookTime: formatDurationISO(cookTime) || undefined,
      servings,
      ingredients: ingredients
        .map((ing, idx) => ({ index: idx, ingredient: ing.trim() }))
        .filter((ing) => ing.ingredient),
      instructions: method
        .map((step, idx) => ({ index: idx, instruction: step.trim() }))
        .filter((inst) => inst.instruction),
      images: images.map((url) => ({ url })),
      // Include scraped recipe fields if available
      ...(isScrapedRecipe &&
        prefill && {
          sourceUrl: prefill.sourceUrl,
          datePublished: prefill.datePublished
            ? new Date(prefill.datePublished).getTime()
            : undefined,
          author: prefill.author,
          categories: prefill.categories || [],
          cuisines: prefill.cuisines || [],
          keywords: prefill.keywords || [],
        }),
      // For manual recipes, use the author field from the form
      ...(!isScrapedRecipe && {
        author: author.trim() || undefined,
      }),
    };

    saveRecipeMutation.mutate(recipeData);
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <SafeAreaView>
          <View style={styles.padded}>
            <VSpace size={16} />
            <View style={styles.header}>
              <BackButton color="black" />
              <Text type="title2">Add your recipe</Text>
              <View style={styles.headerSpacer} />
            </View>
          </View>
          <VSpace size={32} />
          {images.length > 0 ? (
            <>
              <View style={styles.padded}>
                <View style={styles.imageHeader}>
                  <Text type="body" style={styles.photoCount}>
                    {images.length} photo{images.length !== 1 ? 's' : ''}
                  </Text>
                </View>
              </View>
              <FlatList
                horizontal
                data={images}
                keyExtractor={(_, index) => index.toString()}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.imageList}
                renderItem={({ item: uri, index }) => (
                  <View style={styles.imageContainer}>
                    <Image source={{ uri }} style={styles.image} />
                    <TouchableOpacity
                      style={styles.imageRemoveButton}
                      onPress={() => removeImage(index)}>
                      <Text style={styles.removeButtonText}>×</Text>
                    </TouchableOpacity>
                  </View>
                )}
              />
              <View style={styles.padded}>
                <TouchableOpacity style={styles.addButton} onPress={pickImage}>
                  <Text type="highlight">+ Add another photo</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <TouchableOpacity style={styles.imagePlaceholder} onPress={pickImage}>
              <Text type="body" style={styles.placeholderText}>
                Tap to add photo
              </Text>
            </TouchableOpacity>
          )}
          <View style={styles.padded}>
            <VSpace size={16} />
            <Text type="heading">Recipe title</Text>
            <VSpace size={8} />
            <Input value={title} onChangeText={setTitle} placeholder="Sausage tray bake" />
            <VSpace size={20} />
            <Text type="heading">Author</Text>
            <VSpace size={8} />
            <Input value={author} onChangeText={setAuthor} placeholder="Your name" />
            <VSpace size={20} />
            <Text type="heading">Description</Text>
            <VSpace size={8} />
            <Input
              value={description}
              onChangeText={setDescription}
              placeholder="A quick and easy tray bake..."
              multiline
            />
            <VSpace size={12} />
            <View style={styles.row}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <TimePicker
                  label="Prep time"
                  value={prepTime}
                  onValueChange={setPrepTime}
                  placeholder="Tap to set prep time"
                />
              </View>
              <View style={{ flex: 1, marginLeft: 8 }}>
                <TimePicker
                  label="Cook time"
                  value={cookTime}
                  onValueChange={setCookTime}
                  placeholder="Tap to set cook time"
                />
              </View>
            </View>
            <VSpace size={12} />
            <View style={styles.row}>
              <Text type="heading" style={{ marginRight: 8 }}>
                Servings
              </Text>
              <TouchableOpacity
                onPress={() => setServings(Math.max(1, servings - 1))}
                style={styles.servingButton}>
                <Text type="heading">-</Text>
              </TouchableOpacity>
              <Text style={{ marginHorizontal: 8 }}>{servings}</Text>
              <TouchableOpacity
                onPress={() => setServings(servings + 1)}
                style={styles.servingButton}>
                <Text type="heading">+</Text>
              </TouchableOpacity>
            </View>
            <VSpace size={20} />
            {/* Ingredients */}
            <Text type="heading">Ingredients</Text>
            <VSpace size={8} />
            {ingredients.map((ing, idx) => {
              return (
                <View key={idx} style={styles.ingredientRow}>
                  <Input
                    value={ing}
                    onChangeText={(v) => updateIngredient(idx, v)}
                    placeholder={`e.g. 2 Carrots`}
                    style={{ flex: 1 }}
                    multiline
                  />
                  {ingredients.length > 1 && (
                    <TouchableOpacity
                      onPress={() => removeIngredient(idx)}
                      style={styles.removeButton}>
                      <Text type="heading">×</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
            <TouchableOpacity onPress={addIngredient} style={styles.addButton}>
              <Text type="highlight">+ Add ingredient</Text>
            </TouchableOpacity>
            <VSpace size={20} />
            {/* Method */}
            <Text type="heading">Method</Text>
            <VSpace size={8} />
            {method.map((step, idx) => {
              return (
                <View key={idx} style={styles.ingredientRow}>
                  <Input
                    value={step}
                    onChangeText={(v) => updateMethod(idx, v)}
                    placeholder={`Step ${idx + 1}`}
                    style={{ flex: 1 }}
                  />
                  {method.length > 1 && (
                    <TouchableOpacity onPress={() => removeMethod(idx)} style={styles.removeButton}>
                      <Text type="heading">×</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
            <TouchableOpacity onPress={addMethod} style={styles.addButton}>
              <Text type="highlight">+ Add step</Text>
            </TouchableOpacity>
            <VSpace size={32} />
            <PrimaryButton onPress={onSave} disabled={saveRecipeMutation.isPending}>
              {saveRecipeMutation.isPending ? 'Saving...' : 'Save recipe'}
            </PrimaryButton>
            <VSpace size={32} />
          </View>
        </SafeAreaView>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  screen: {
    flex: 1,
    backgroundColor: '#fff',
  },
  padded: {
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerSpacer: {
    width: 24, // Same width as back button for centering
  },
  imageSection: {
    paddingBottom: 12,
  },
  imageHeader: {
    paddingBottom: 4,
  },
  photoCount: {
    color: '#666',
    fontSize: 14,
  },
  imageList: {
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  imageContainer: {
    marginRight: 12,
    position: 'relative',
  },
  image: {
    width: 180,
    height: 180,
    borderRadius: 12,
    backgroundColor: '#eee',
  },
  imageRemoveButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#ff4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    lineHeight: 20,
  },
  imagePlaceholder: {
    width: '100%',
    height: 220,
    backgroundColor: '#eee',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    color: '#666',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  servingButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  removeButton: {
    marginLeft: 8,
    padding: 4,
  },
  addButton: {
    marginTop: 4,
    marginBottom: 8,
  },
}));
