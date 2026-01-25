import { useState, useCallback } from "react";
import {
  View,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Alert,
} from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { StyleSheet } from "react-native-unistyles";

import { OnboardingStepCuisines } from "./onboarding-steps/OnboardingStepCuisines";
import { OnboardingStepDietary } from "./onboarding-steps/OnboardingStepDietary";
import { OnboardingStepIngredients } from "./onboarding-steps/OnboardingStepIngredients";
import { OnboardingStepProfile } from "./onboarding-steps/OnboardingStepProfile";

import { useCompleteOnboarding, useUser } from "@/api/user";
import { OnboardingProgress } from "@/components/OnboardingProgress";
import { SafeAreaView } from "@/components/SafeAreaView";
import { VSpace } from "@/components/Space";
import { Text } from "@/components/Text";
import { PrimaryButton } from "@/components/buttons/PrimaryButton";

const TOTAL_STEPS = 4;

export default function OnboardingScreen() {
  const { data: userData } = useUser();
  const user = userData?.user;
  const completeOnboarding = useCompleteOnboarding();

  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Step 1: Profile data
  const [name, setName] = useState(user?.name || "");
  const [bio, setBio] = useState("");
  const [profileImage, setProfileImage] = useState<string | null>(null);

  // Step 2: Cuisines
  const [cuisineLikes, setCuisineLikes] = useState<number[]>([]);
  const [cuisineDislikes, setCuisineDislikes] = useState<number[]>([]);

  // Step 3: Ingredients
  const [ingredientLikes, setIngredientLikes] = useState<number[]>([]);
  const [ingredientDislikes, setIngredientDislikes] = useState<number[]>([]);

  // Step 4: Dietary
  const [dietaryRequirements, setDietaryRequirements] = useState<number[]>([]);

  const toggleInArray = useCallback(
    (arr: number[], id: number, setArr: (arr: number[]) => void) => {
      if (arr.includes(id)) {
        setArr(arr.filter((item) => item !== id));
      } else {
        setArr([...arr, id]);
      }
    },
    [],
  );

  const handleNext = async () => {
    if (currentStep < TOTAL_STEPS) {
      setCurrentStep((prev) => prev + 1);
    } else {
      // Final step - save everything
      setIsSubmitting(true);
      try {
        await completeOnboarding.mutateAsync({
          name: name || undefined,
          bio: bio || null,
          image: profileImage,
          cuisineLikes,
          cuisineDislikes,
          ingredientLikes,
          ingredientDislikes,
          dietaryRequirements,
        });
        // Navigation will automatically switch due to onboardingCompleted flag
      } catch (error) {
        console.error("Onboarding save error:", error);
        Alert.alert(
          "Error",
          "Failed to save your preferences. Please try again.",
        );
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleSkip = async () => {
    setIsSubmitting(true);
    try {
      await completeOnboarding.mutateAsync({
        cuisineLikes: [],
        cuisineDislikes: [],
        ingredientLikes: [],
        ingredientDislikes: [],
        dietaryRequirements: [],
      });
      // Navigation will automatically switch
    } catch (error) {
      console.error("Onboarding skip error:", error);
      Alert.alert("Error", "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const canProceed = () => {
    if (currentStep === 1) return name.trim().length > 0;
    return true; // Other steps are optional
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <OnboardingStepProfile
            name={name}
            setName={setName}
            bio={bio}
            setBio={setBio}
            profileImage={profileImage}
            setProfileImage={setProfileImage}
            existingName={user?.name}
            existingImage={user?.image}
          />
        );
      case 2:
        return (
          <OnboardingStepCuisines
            likes={cuisineLikes}
            dislikes={cuisineDislikes}
            onToggleLike={(id) =>
              toggleInArray(cuisineLikes, id, setCuisineLikes)
            }
            onToggleDislike={(id) =>
              toggleInArray(cuisineDislikes, id, setCuisineDislikes)
            }
          />
        );
      case 3:
        return (
          <OnboardingStepIngredients
            likes={ingredientLikes}
            dislikes={ingredientDislikes}
            onToggleLike={(id) =>
              toggleInArray(ingredientLikes, id, setIngredientLikes)
            }
            onToggleDislike={(id) =>
              toggleInArray(ingredientDislikes, id, setIngredientDislikes)
            }
          />
        );
      case 4:
        return (
          <OnboardingStepDietary
            selected={dietaryRequirements}
            onToggle={(id) =>
              toggleInArray(dietaryRequirements, id, setDietaryRequirements)
            }
          />
        );
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <VSpace size={16} />
        <OnboardingProgress
          currentStep={currentStep}
          totalSteps={TOTAL_STEPS}
        />
        <VSpace size={24} />

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View
            key={currentStep}
            entering={FadeIn.duration(300)}
            exiting={FadeOut.duration(200)}
          >
            {renderStep()}
          </Animated.View>
        </ScrollView>

        <View style={styles.footer}>
          <View style={styles.buttonRow}>
            {currentStep > 1 && (
              <TouchableOpacity
                style={styles.backButton}
                onPress={handleBack}
                activeOpacity={0.7}
              >
                <Text style={styles.backButtonText}>Back</Text>
              </TouchableOpacity>
            )}
            <PrimaryButton
              onPress={handleNext}
              disabled={!canProceed() || isSubmitting}
              style={currentStep > 1 ? styles.nextButtonFlex : undefined}
            >
              {isSubmitting
                ? "Saving..."
                : currentStep === TOTAL_STEPS
                  ? "Get Started"
                  : "Continue"}
            </PrimaryButton>
          </View>
          {currentStep > 1 && (
            <>
              <VSpace size={12} />
              <TouchableOpacity
                onPress={handleSkip}
                disabled={isSubmitting}
                activeOpacity={0.7}
              >
                <Text type="bodyFaded" style={styles.skipText}>
                  Skip for now
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    flexGrow: 1,
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  backButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    justifyContent: "center",
    alignItems: "center",
  },
  backButtonText: {
    fontSize: 16,
    fontFamily: theme.fonts.medium,
    color: theme.colors.text,
  },
  nextButtonFlex: {
    flex: 1,
    width: undefined,
  },
  skipText: {
    textAlign: "center",
  },
}));
