import { useState, useEffect, useRef } from 'react';
import {
  View,
  FlatList,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

import { Text } from '@/components/Text';
import { VSpace, HSpace } from '@/components/Space';
import { BackButton } from '@/components/buttons/BackButton';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { useRecipeDetail, useSaveRecipe } from '@/api/recipe';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IMAGE_HEIGHT = 360;

type RecipeDetailScreenParams = {
  RecipeDetail: {
    recipeId: number;
  };
};

type RecipeDetailScreenRouteProp = RouteProp<RecipeDetailScreenParams, 'RecipeDetail'>;

interface RecipeImage {
  id: number;
  url: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  image?: string | null;
}

type TabType = 'ingredients' | 'method';

export const RecipeDetailScreen = () => {
  const route = useRoute<RecipeDetailScreenRouteProp>();
  const navigation = useNavigation();
  const { recipeId } = route.params;

  const { data: recipe, isPending, error } = useRecipeDetail({ recipeId });
  const saveRecipeMutation = useSaveRecipe();

  const [activeTab, setActiveTab] = useState<TabType>('ingredients');
  const [servings, setServings] = useState(1);
  const hasInitializedServings = useRef(false);

  useEffect(() => {
    if (recipe?.servings && !hasInitializedServings.current) {
      setServings(recipe.servings);
      hasInitializedServings.current = true;
    }
  }, [recipe?.servings]);

  const servingMultiplier = recipe?.servings ? servings / recipe.servings : 1;

  const handleSaveRecipe = () => {
    if (!recipe) return;
    saveRecipeMutation.mutate({ recipeId: recipe.id });
  };

  if (isPending) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (error || !recipe) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <Text type="bodyFaded">Recipe not found</Text>
        <VSpace size={16} />
        <PrimaryButton onPress={() => navigation.goBack()}>Go Back</PrimaryButton>
      </View>
    );
  }

  const adjustIngredientAmount = (ingredient: string): string => {
    if (!ingredient) return '';

    // Simple regex to find numbers and fractions at the beginning
    const match = ingredient.match(/^(\d+(?:\/\d+)?|\d*\.?\d+)\s*(.*)$/);
    if (match?.[1] && servingMultiplier !== 1) {
      const amount = parseFloat(match[1]);
      const newAmount = (amount * servingMultiplier).toFixed(2);
      return `${parseFloat(newAmount)} ${match[2]}`;
    }
    return ingredient;
  };

  const renderImage = ({ item, index }: { item: RecipeImage; index: number }) => (
    <View style={styles.imageContainer}>
      <Image source={{ uri: item.url }} style={styles.recipeImage} />
    </View>
  );

  const renderUserInfo = () => (
    <View style={styles.userSection}>
      <View style={styles.userInfo}>
        <View style={styles.avatar}>
          {recipe.uploadedBy.image ? (
            <Image source={{ uri: recipe.uploadedBy.image }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text type="heading" style={styles.avatarText}>
                {recipe.uploadedBy.name.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
        </View>
        <HSpace size={12} />
        <View>
          <Text type="heading">{recipe.uploadedBy.name}</Text>
          <Text type="bodyFaded" style={styles.recipeCount}>
            {recipe.userRecipesCount} recipes
          </Text>
        </View>
      </View>
    </View>
  );

  const renderControls = () => (
    <View style={styles.controlsSection}>
      <PrimaryButton
        style={recipe.isSaved ? [styles.saveButton, styles.savedButton] : styles.saveButton}
        onPress={handleSaveRecipe}
        disabled={recipe.isSaved || saveRecipeMutation.isPending}>
        {saveRecipeMutation.isPending ? 'Saving...' : recipe.isSaved ? 'Saved' : 'Save Recipe'}
      </PrimaryButton>

      <View style={styles.servingsControl}>
        <Text type="bodyFaded" style={styles.servingsLabel}>
          Servings
        </Text>
        <VSpace size={4} />
        <View style={styles.servingsButtons}>
          <TouchableOpacity
            style={styles.servingsButton}
            onPress={() => {
              setServings(Math.max(1, servings - 1));
            }}>
            <Text type="heading" style={styles.servingsButtonText}>
              -
            </Text>
          </TouchableOpacity>
          <View style={styles.servingsDisplay}>
            <Text type="heading" style={styles.servingsNumber}>
              {servings}
            </Text>
          </View>
          <TouchableOpacity style={styles.servingsButton} onPress={() => setServings(servings + 1)}>
            <Text type="heading" style={styles.servingsButtonText}>
              +
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const renderTabs = () => (
    <View style={styles.tabsContainer}>
      <TouchableOpacity
        style={[styles.tab, activeTab === 'ingredients' && styles.activeTab]}
        onPress={() => setActiveTab('ingredients')}>
        <Text type={activeTab === 'ingredients' ? 'highlight' : 'bodyFaded'}>Ingredients</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.tab, activeTab === 'method' && styles.activeTab]}
        onPress={() => setActiveTab('method')}>
        <Text type={activeTab === 'method' ? 'highlight' : 'bodyFaded'}>Method</Text>
      </TouchableOpacity>
    </View>
  );

  const renderTabContent = () => {
    if (activeTab === 'ingredients') {
      return (
        <View style={styles.tabContent}>
          {recipe.ingredients.map((item: { index: number; ingredient: string }, index: number) => (
            <View key={index} style={styles.ingredientItem}>
              <Text type="body">{adjustIngredientAmount(item.ingredient)}</Text>
            </View>
          ))}
        </View>
      );
    } else {
      return (
        <View style={styles.tabContent}>
          {recipe.instructions.map(
            (item: { index: number; instruction: string }, index: number) => (
              <View key={index} style={styles.instructionItem}>
                <View style={styles.stepNumber}>
                  <Text type="highlight" style={styles.stepNumberText}>
                    {item.index + 1}
                  </Text>
                </View>
                <HSpace size={12} />
                <View style={styles.instructionText}>
                  <Text type="body">{item.instruction}</Text>
                </View>
              </View>
            )
          )}
        </View>
      );
    }
  };

  return (
    <View style={styles.screen}>
      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Image Carousel or Header */}
        <View style={[styles.imageCarousel, styles.imageHeader]}>
          {recipe.images && recipe.images.length > 0 && (
            <FlatList
              data={recipe.images}
              renderItem={renderImage}
              keyExtractor={(item) => item.id.toString()}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              style={styles.imageCarousel}
              bounces={false}
            />
          )}
          <LinearGradient
            colors={['rgba(0,0,0,0.0)', 'rgba(0,0,0,1)']}
            style={styles.gradient}
            pointerEvents="none"
          />
          <View style={styles.imageOverlay}>
            <Text type="title1" style={styles.recipeName}>
              {recipe.name}
            </Text>
            <VSpace size={8} />
            <View style={styles.timeInfo}>
              {recipe.prepTime && (
                <Text type="body" style={styles.timeText}>
                  Prep: {recipe.prepTime}
                </Text>
              )}
              {recipe.cookTime && (
                <>
                  <HSpace size={16} />
                  <Text type="body" style={styles.timeText}>
                    Cook: {recipe.cookTime}
                  </Text>
                </>
              )}
            </View>
          </View>
        </View>
        {/* Back Button */}
        <View style={styles.backButtonContainer}>
          <BackButton />
        </View>
        <VSpace size={20} />

        <View style={styles.padded}>
          {renderUserInfo()}
          <VSpace size={24} />

          {renderControls()}
          <VSpace size={24} />

          {renderTabs()}
          {renderTabContent()}

          <VSpace size={40} />
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create((theme) => ({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  imageHeader: {
    justifyContent: 'flex-end',
  },
  imageCarousel: {
    height: IMAGE_HEIGHT,
  },
  gradient: {
    position: 'absolute',
    top: IMAGE_HEIGHT / 2,
    left: 0,
    right: 0,
    bottom: 0,
  },
  imageContainer: {
    width: SCREEN_WIDTH,
    height: IMAGE_HEIGHT,
    position: 'relative',
  },
  recipeImage: {
    width: '100%',
    height: '100%',
    backgroundColor: theme.colors.border,
  },

  imageOverlay: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
  },
  padded: { paddingHorizontal: 20 },
  recipeName: {
    color: 'white',
  },
  timeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeText: {
    color: 'white',
    opacity: 0.9,
  },
  backButtonContainer: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 10,
  },
  content: {
    flex: 1,
  },
  userSection: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 50,
    height: 50,
  },
  avatarImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: theme.colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 20,
    color: theme.colors.primary,
  },
  recipeCount: {
    fontSize: 14,
    marginTop: 2,
  },
  controlsSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  saveButton: {
    flex: 1,
    marginRight: 20,
  },
  savedButton: {
    backgroundColor: theme.colors.primary + '30',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  servingsControl: {
    alignItems: 'center',
  },
  servingsLabel: {
    fontSize: 14,
  },
  servingsButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: theme.borderRadius.small,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  servingsButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  servingsButtonText: {
    fontSize: 18,
  },
  servingsDisplay: {
    width: 60,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  servingsNumber: {
    fontSize: 16,
  },
  tabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: theme.colors.primary,
  },
  tabContent: {
    paddingTop: 20,
  },
  ingredientItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border + '30',
  },
  instructionItem: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border + '30',
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumberText: {
    color: 'white',
    fontSize: 14,
    fontFamily: theme.fonts.albertBold,
  },
  instructionText: {
    flex: 1,
    paddingTop: 2,
  },
}));
