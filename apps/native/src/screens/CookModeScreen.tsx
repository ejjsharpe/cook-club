import { Ionicons } from "@expo/vector-icons";
import { RouteProp, useRoute, useNavigation } from "@react-navigation/native";
import { useKeepAwake } from "expo-keep-awake";
import { Image } from "expo-image";
import { useRef, useState, useCallback } from "react";
import {
  View,
  TouchableOpacity,
  Dimensions,
  FlatList,
  ViewToken,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet } from "react-native-unistyles";

import { VSpace } from "@/components/Space";
import { Text } from "@/components/Text";
import { getImageUrl } from "@/utils/imageUrl";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

interface Instruction {
  id: number;
  instruction: string;
  imageUrl?: string | null;
}

interface InstructionSection {
  id: number;
  name: string | null;
  instructions: Instruction[];
}

type CookModeScreenParams = {
  CookMode: {
    recipeName: string;
    instructionSections: InstructionSection[];
  };
};

type CookModeScreenRouteProp = RouteProp<CookModeScreenParams, "CookMode">;

// Flatten instructions with section context
interface FlattenedInstruction {
  id: number;
  stepNumber: number;
  instruction: string;
  imageUrl?: string | null;
  sectionName?: string | null;
  isFirstInSection: boolean;
}

export const CookModeScreen = () => {
  // Keep screen awake during cooking
  useKeepAwake();

  const route = useRoute<CookModeScreenRouteProp>();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList>(null);

  const { recipeName, instructionSections } = route.params;

  // Flatten instructions from all sections
  const flattenedInstructions: FlattenedInstruction[] = [];
  let globalStepNumber = 0;

  instructionSections.forEach((section) => {
    section.instructions.forEach((instruction, idx) => {
      globalStepNumber++;
      flattenedInstructions.push({
        id: instruction.id,
        stepNumber: globalStepNumber,
        instruction: instruction.instruction,
        imageUrl: instruction.imageUrl,
        sectionName: section.name,
        isFirstInSection: idx === 0,
      });
    });
  });

  const totalSteps = flattenedInstructions.length;
  const [currentStep, setCurrentStep] = useState(0);

  const handleViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const firstItem = viewableItems[0];
      if (viewableItems.length > 0 && firstItem?.index != null) {
        setCurrentStep(firstItem.index);
      }
    },
    [],
  );

  const viewabilityConfig = {
    viewAreaCoveragePercentThreshold: 50,
  };

  const goToStep = (stepIndex: number) => {
    if (stepIndex >= 0 && stepIndex < totalSteps) {
      flatListRef.current?.scrollToIndex({ index: stepIndex, animated: true });
    }
  };

  const renderInstruction = ({
    item,
    index,
  }: {
    item: FlattenedInstruction;
    index: number;
  }) => {
    const isFirstStep = index === 0;
    const isLastStep = index === totalSteps - 1;

    return (
      <View style={styles.instructionPage}>
        {/* Instruction Image */}
        {item.imageUrl && (
          <View style={styles.imageContainer}>
            <Image
              source={{ uri: getImageUrl(item.imageUrl, "step-full") }}
              style={styles.instructionImage}
              contentFit="cover"
            />
          </View>
        )}

        <View
          style={[
            styles.instructionContent,
            !item.imageUrl && styles.instructionContentNoImage,
          ]}
        >
          {/* Section Name */}
          {item.sectionName && item.isFirstInSection && (
            <>
              <Text style={styles.sectionName}>{item.sectionName}</Text>
              <VSpace size={8} />
            </>
          )}

          {/* Step Number */}
          <Text style={styles.stepNumber}>Step {item.stepNumber}</Text>
          <VSpace size={16} />

          {/* Instruction Text */}
          <Text style={styles.instructionText}>{item.instruction}</Text>

          <VSpace size={32} />

          {/* Navigation Arrows */}
          <View style={styles.navArrows}>
            <TouchableOpacity
              style={[
                styles.navArrowButton,
                isFirstStep && styles.navArrowButtonDisabled,
              ]}
              onPress={() => goToStep(index - 1)}
              disabled={isFirstStep}
            >
              <Ionicons
                name="chevron-back"
                size={28}
                style={[
                  styles.navArrowIcon,
                  isFirstStep && styles.navArrowIconDisabled,
                ]}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.navArrowButton,
                isLastStep && styles.navArrowButtonDisabled,
              ]}
              onPress={() => goToStep(index + 1)}
              disabled={isLastStep}
            >
              <Ionicons
                name="chevron-forward"
                size={28}
                style={[
                  styles.navArrowIcon,
                  isLastStep && styles.navArrowIconDisabled,
                ]}
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      {/* Header */}
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
        <View style={styles.headerSpacer} />
      </View>

      {/* Instructions Carousel */}
      <FlatList
        ref={flatListRef}
        data={flattenedInstructions}
        renderItem={renderInstruction}
        keyExtractor={(item) => item.id.toString()}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={handleViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        getItemLayout={(_, index) => ({
          length: SCREEN_WIDTH,
          offset: SCREEN_WIDTH * index,
          index,
        })}
      />

      {/* Progress Indicator */}
      <View style={[styles.progressContainer, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.progressDots}>
          {flattenedInstructions.map((_, index) => (
            <View
              key={index}
              style={[
                styles.progressDot,
                index === currentStep && styles.progressDotActive,
                index < currentStep && styles.progressDotCompleted,
              ]}
            />
          ))}
        </View>
        <Text style={styles.progressText}>
          {currentStep + 1} of {totalSteps}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create((theme) => ({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
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
    alignItems: "center",
    paddingHorizontal: 8,
  },
  headerTitle: {
    textAlign: "center",
  },
  headerSpacer: {
    width: 44,
  },

  // Instruction Page
  instructionPage: {
    width: SCREEN_WIDTH,
    flex: 1,
  },
  imageContainer: {
    height: SCREEN_HEIGHT * 0.35,
  },
  instructionImage: {
    width: "100%",
    height: "100%",
  },
  instructionContent: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  instructionContentNoImage: {
    paddingTop: 48,
  },
  sectionName: {
    fontSize: 14,
    textTransform: "uppercase",
    color: theme.colors.textSecondary,
    letterSpacing: 0.5,
    fontFamily: theme.fonts.semiBold,
  },
  stepNumber: {
    fontSize: 48,
    fontFamily: theme.fonts.bold,
    color: theme.colors.primary,
  },
  instructionText: {
    fontSize: 20,
    lineHeight: 30,
    color: theme.colors.text,
  },
  navArrows: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 24,
  },
  navArrowButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.inputBackground,
    justifyContent: "center",
    alignItems: "center",
  },
  navArrowButtonDisabled: {
    opacity: 0.3,
  },
  navArrowIcon: {
    color: theme.colors.text,
  },
  navArrowIconDisabled: {
    color: theme.colors.textSecondary,
  },

  // Progress Indicator
  progressContainer: {
    alignItems: "center",
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  progressDots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginBottom: 8,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.border,
  },
  progressDotActive: {
    backgroundColor: theme.colors.primary,
    width: 24,
  },
  progressDotCompleted: {
    backgroundColor: theme.colors.primary,
    opacity: 0.5,
  },
  progressText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
}));
