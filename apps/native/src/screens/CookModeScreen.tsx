import { Ionicons } from "@expo/vector-icons";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import { Image } from "expo-image";
import { useKeepAwake } from "expo-keep-awake";
import { useMemo, useState } from "react";
import {
  Modal,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet } from "react-native-unistyles";

import { Text } from "@/components/Text";
import { getImageUrl } from "@/utils/imageUrl";

interface Instruction {
  id: number;
  instruction: string;
  imageUrl?: string | null;
}

interface Ingredient {
  id: number;
  quantity: string | null;
  unit: string | null;
  name: string;
  preparation: string | null;
}

interface IngredientSection {
  id: number;
  name: string | null;
  ingredients: Ingredient[];
}

interface InstructionSection {
  id: number;
  name: string | null;
  instructions: Instruction[];
}

type CookModeScreenParams = {
  CookMode: {
    recipeName: string;
    ingredientSections: IngredientSection[];
    instructionSections: InstructionSection[];
  };
};

type CookModeScreenRouteProp = RouteProp<CookModeScreenParams, "CookMode">;

interface FlattenedInstruction {
  id: number;
  stepNumber: number;
  instruction: string;
  imageUrl?: string | null;
  sectionName?: string | null;
  isFirstInSection: boolean;
}

interface InstructionListItemProps {
  item: FlattenedInstruction;
  index: number;
  itemHeight: number;
  scrollY: SharedValue<number>;
}

const InstructionListItem = ({
  item,
  index,
  itemHeight,
  scrollY,
}: InstructionListItemProps) => {
  const animatedStyle = useAnimatedStyle(() => {
    const center = index * itemHeight;
    const opacity = interpolate(
      scrollY.value,
      [center - itemHeight, center, center + itemHeight],
      [0.18, 1, 0.18],
      Extrapolation.CLAMP,
    );

    return { opacity };
  });

  return (
    <Animated.View
      style={[styles.instructionItem, { height: itemHeight }, animatedStyle]}
    >
      {item.sectionName && item.isFirstInSection && (
        <Text style={styles.sectionName}>{item.sectionName}</Text>
      )}

      <View style={styles.stepHeader}>
        <Text style={styles.stepNumber}>{item.stepNumber}</Text>
      </View>

      <Text style={styles.instructionText}>{item.instruction}</Text>

      {item.imageUrl && (
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: getImageUrl(item.imageUrl, "step-full") }}
            style={styles.instructionImage}
            contentFit="cover"
          />
        </View>
      )}
    </Animated.View>
  );
};

const formatIngredient = (ingredient: Ingredient) => {
  const parts = [
    ingredient.quantity,
    ingredient.unit,
    ingredient.name,
    ingredient.preparation,
  ].filter(Boolean);

  return parts.join(" ");
};

export const CookModeScreen = () => {
  useKeepAwake();

  const route = useRoute() as CookModeScreenRouteProp;
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const scrollY = useSharedValue(0);

  const { recipeName, ingredientSections, instructionSections } = route.params;

  const flattenedInstructions = useMemo(() => {
    const instructions: FlattenedInstruction[] = [];
    let globalStepNumber = 0;

    instructionSections.forEach((section) => {
      section.instructions.forEach((instruction, idx) => {
        globalStepNumber++;
        instructions.push({
          id: instruction.id,
          stepNumber: globalStepNumber,
          instruction: instruction.instruction,
          imageUrl: instruction.imageUrl,
          sectionName: section.name,
          isFirstInSection: idx === 0,
        });
      });
    });

    return instructions;
  }, [instructionSections]);

  const totalSteps = flattenedInstructions.length;
  const [ingredientsVisible, setIngredientsVisible] = useState(false);

  const itemHeight = Math.max(Math.min(windowHeight * 0.36, 350), 240);
  const centeredItemInset = Math.max((windowHeight - itemHeight) / 2, 0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="close" size={28} style={styles.closeIcon} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text type="headline" numberOfLines={1} style={styles.headerTitle}>
            {recipeName}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.ingredientsButton}
          onPress={() => setIngredientsVisible(true)}
        >
          <Ionicons
            name="list"
            size={18}
            style={styles.ingredientsButtonIcon}
          />
          <Text style={styles.ingredientsButtonText}>Ingredients</Text>
        </TouchableOpacity>
      </View>

      {totalSteps > 0 ? (
        <Animated.FlatList
          data={flattenedInstructions}
          renderItem={({ item, index }) => (
            <InstructionListItem
              item={item}
              index={index}
              itemHeight={itemHeight}
              scrollY={scrollY}
            />
          )}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{
            paddingTop: centeredItemInset,
            paddingBottom: centeredItemInset,
          }}
          showsVerticalScrollIndicator={false}
          snapToInterval={itemHeight}
          decelerationRate="fast"
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          getItemLayout={(_, index) => ({
            length: itemHeight,
            offset: itemHeight * index,
            index,
          })}
        />
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.instructionText}>No instructions available.</Text>
        </View>
      )}

      <Modal
        visible={ingredientsVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIngredientsVisible(false)}
      >
        <View style={styles.ingredientsSheet}>
          <View
            style={[
              styles.ingredientsSheetHeader,
              { paddingTop: insets.top + 8 },
            ]}
          >
            <Text type="headline" style={styles.ingredientsSheetTitle}>
              Ingredients
            </Text>
            <TouchableOpacity
              style={styles.sheetCloseButton}
              onPress={() => setIngredientsVisible(false)}
            >
              <Ionicons name="close" size={24} style={styles.closeIcon} />
            </TouchableOpacity>
          </View>
          <ScrollView
            contentInsetAdjustmentBehavior="automatic"
            contentContainerStyle={[
              styles.ingredientsList,
              { paddingBottom: insets.bottom + 24 },
            ]}
          >
            {ingredientSections.map((section) => (
              <View key={section.id} style={styles.ingredientsSection}>
                {section.name && (
                  <Text style={styles.ingredientsSectionTitle}>
                    {section.name}
                  </Text>
                )}
                {section.ingredients.map((ingredient) => (
                  <View key={ingredient.id} style={styles.ingredientRow}>
                    <View style={styles.ingredientBullet} />
                    <Text style={styles.ingredientText}>
                      {formatIngredient(ingredient)}
                    </Text>
                  </View>
                ))}
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create((theme) => ({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: "transparent",
  },
  closeButton: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  closeIcon: {
    color: theme.colors.text,
  },
  headerTitleContainer: {
    flex: 1,
    paddingHorizontal: 8,
  },
  headerTitle: {
    textAlign: "left",
  },
  ingredientsButton: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: theme.colors.inputBackground,
  },
  ingredientsButtonIcon: {
    color: theme.colors.text,
  },
  ingredientsButtonText: {
    fontSize: 13,
    fontFamily: theme.fonts.semiBold,
    color: theme.colors.text,
  },
  instructionItem: {
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 18,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  sectionName: {
    fontSize: 14,
    textTransform: "uppercase",
    color: theme.colors.textSecondary,
    letterSpacing: 0,
    fontFamily: theme.fonts.semiBold,
  },
  stepHeader: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
  },
  stepNumber: {
    fontSize: 42,
    lineHeight: 46,
    fontFamily: theme.fonts.bold,
    color: theme.colors.primary,
  },
  instructionText: {
    fontSize: 24,
    lineHeight: 34,
    color: theme.colors.text,
    fontFamily: theme.fonts.medium,
  },
  imageContainer: {
    width: "100%",
    aspectRatio: 1.55,
    overflow: "hidden",
    borderRadius: 8,
    borderCurve: "continuous",
    backgroundColor: theme.colors.inputBackground,
  },
  instructionImage: {
    width: "100%",
    height: "100%",
  },
  ingredientsSheet: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  ingredientsSheetHeader: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  ingredientsSheetTitle: {
    flex: 1,
  },
  sheetCloseButton: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  ingredientsList: {
    paddingHorizontal: 24,
    paddingTop: 24,
    gap: 28,
  },
  ingredientsSection: {
    gap: 14,
  },
  ingredientsSectionTitle: {
    fontSize: 14,
    textTransform: "uppercase",
    color: theme.colors.textSecondary,
    letterSpacing: 0,
    fontFamily: theme.fonts.semiBold,
  },
  ingredientRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  ingredientBullet: {
    width: 7,
    height: 7,
    marginTop: 9,
    borderRadius: 4,
    backgroundColor: theme.colors.primary,
  },
  ingredientText: {
    flex: 1,
    fontSize: 18,
    lineHeight: 26,
    color: theme.colors.text,
  },
}));
