import { useState, useCallback } from "react";
import {
  View,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Alert,
  Dimensions,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet } from "react-native-unistyles";

import { OnboardingStepFollowCooks } from "./onboarding-steps/OnboardingStepFollowCooks";
import { OnboardingStepMeasurements } from "./onboarding-steps/OnboardingStepMeasurements";
import { OnboardingStepProfile } from "./onboarding-steps/OnboardingStepProfile";

import { useCheckUsername, useUser } from "@/api/user";
import { OnboardingProgress } from "@/components/OnboardingProgress";
import { SafeAreaView } from "@/components/SafeAreaView";
import { useWelcomeOverlay } from "@/components/WelcomeOverlay";

import { useTRPC } from "@repo/trpc/client";
import { useMutation } from "@tanstack/react-query";
import { VSpace } from "@/components/Space";
import { Text } from "@/components/Text";
import { PrimaryButton } from "@/components/buttons/PrimaryButton";
import { useDebounce } from "@/hooks/useDebounce";
import type { MeasurementSystem } from "@/lib/measurementPreferences";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const TOTAL_STEPS = 3;
const SPRING_CONFIG = { damping: 20, stiffness: 170, mass: 0.8 };
const TIMING_CONFIG = { duration: 250, easing: Easing.out(Easing.cubic) };
const BACK_BUTTON_WIDTH = 88;

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const { data: userData } = useUser();
  const user = userData?.user;
  const trpc = useTRPC();
  const { triggerWelcome } = useWelcomeOverlay();
  const completeOnboarding = useMutation({
    ...trpc.user.completeOnboarding.mutationOptions(),
  });

  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);

  // Step 1: Profile data
  const [name, setName] = useState(user?.name || "");
  const [bio, setBio] = useState("");
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [username, setUsername] = useState("");

  // Step 2: Measurements
  const [measurementSystem, setMeasurementSystem] =
    useState<MeasurementSystem>("auto");

  // Username validation
  const debouncedUsername = useDebounce(username, 300);
  const { data: usernameCheck, isFetching: isCheckingUsername } =
    useCheckUsername(debouncedUsername);

  const isUsernameAvailable = usernameCheck?.available;
  const usernameError = usernameCheck?.reason ?? null;

  // Spring pager animation
  const translateX = useSharedValue(0);

  const animatedPagerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  // Back button animation
  const backButtonProgress = useSharedValue(0);

  const animatedBackButtonStyle = useAnimatedStyle(() => ({
    width: backButtonProgress.value * BACK_BUTTON_WIDTH,
    marginRight: backButtonProgress.value * 12,
    opacity: backButtonProgress.value,
    overflow: "hidden" as const,
  }));

  const navigateToStep = useCallback(
    (step: number) => {
      setCurrentStep(step);
      translateX.value = withSpring(-(step - 1) * SCREEN_WIDTH, SPRING_CONFIG);
      backButtonProgress.value = withTiming(step > 1 ? 1 : 0, TIMING_CONFIG);
    },
    [translateX, backButtonProgress],
  );

  const handleNext = async () => {
    if (currentStep === 1 && !canProceed()) {
      setHasAttemptedSubmit(true);
      return;
    }

    if (currentStep < TOTAL_STEPS) {
      navigateToStep(currentStep + 1);
    } else {
      setIsSubmitting(true);
      try {
        await completeOnboarding.mutateAsync({
          username,
          name: name || undefined,
          bio: bio || null,
          image: profileImage,
          measurementPreference: measurementSystem,
        });
        triggerWelcome();
      } catch (error) {
        console.error("Onboarding save error:", error);
        Alert.alert("Error", "Failed to save your profile. Please try again.");
        setIsSubmitting(false);
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      navigateToStep(currentStep - 1);
    }
  };

  const canProceed = () => {
    if (currentStep === 1) {
      return (
        username.length >= 3 &&
        isUsernameAvailable === true &&
        name.trim().length > 0
      );
    }
    return true;
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
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

        <View style={styles.pagerContainer}>
          <Animated.View style={[styles.pagerRow, animatedPagerStyle]}>
            <ScrollView
              style={styles.stepContainer}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <OnboardingStepProfile
                name={name}
                setName={setName}
                bio={bio}
                setBio={setBio}
                profileImage={profileImage}
                setProfileImage={setProfileImage}
                existingName={user?.name}
                existingImage={user?.image}
                username={username}
                setUsername={setUsername}
                isUsernameAvailable={isUsernameAvailable}
                isCheckingUsername={isCheckingUsername}
                usernameError={usernameError}
                hasAttemptedSubmit={hasAttemptedSubmit}
              />
            </ScrollView>

            <View style={[styles.stepContainer, styles.stepContent]}>
              <OnboardingStepMeasurements
                selected={measurementSystem}
                onSelect={setMeasurementSystem}
              />
            </View>

            <ScrollView
              style={styles.stepContainer}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <OnboardingStepFollowCooks />
            </ScrollView>
          </Animated.View>
        </View>

        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.buttonRow}>
            <Animated.View style={animatedBackButtonStyle}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={handleBack}
                activeOpacity={0.7}
              >
                <Text style={styles.backButtonText}>Back</Text>
              </TouchableOpacity>
            </Animated.View>
            <View style={styles.nextButtonFlex}>
              <PrimaryButton
                onPress={handleNext}
                disabled={(currentStep !== 1 && !canProceed()) || isSubmitting}
              >
                {isSubmitting
                  ? "Saving..."
                  : currentStep === TOTAL_STEPS
                    ? "Get Started"
                    : "Continue"}
              </PrimaryButton>
            </View>
          </View>
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
  pagerContainer: {
    flex: 1,
    overflow: "hidden",
  },
  pagerRow: {
    flexDirection: "row",
    width: SCREEN_WIDTH * TOTAL_STEPS,
    flex: 1,
  },
  stepContainer: {
    width: SCREEN_WIDTH,
  },
  stepContent: {
    paddingHorizontal: 20,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    flexGrow: 1,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  buttonRow: {
    flexDirection: "row",
    width: "100%",
  },
  backButton: {
    width: BACK_BUTTON_WIDTH,
    height: 50,
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
}));
