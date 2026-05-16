import { useNavigation } from "@react-navigation/native";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  View,
  ScrollView,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import Animated, {
  FadeIn,
  LinearTransition,
  Easing,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { StyleSheet, UnistylesRuntime } from "react-native-unistyles";

import {
  usePersonalizeRecipe,
  type ParsedRecipe,
  type PersonalizationGoal,
} from "@/api/recipe";
import {
  BasicImportSheet,
  type BasicImportSheetRef,
} from "@/components/BasicImportSheet";
import { Ionicons } from "@/components/Ionicons";
import {
  PersonaliseRecipeSheet,
  type PersonaliseRecipeSheetRef,
} from "@/components/PersonaliseRecipeSheet";
import {
  RecipeBrowserSheet,
  type RecipeBrowserSheetRef,
} from "@/components/RecipeBrowserSheet";
import {
  SmartImportSheet,
  type SmartImportTask,
  type SmartImportSheetRef,
} from "@/components/SmartImportSheet";
import { VSpace } from "@/components/Space";
import { Text } from "@/components/Text";
import {
  useBackgroundImportQueue,
  type BackgroundImport,
} from "@/lib/backgroundImportQueue";

const HEADER_HEIGHT = 52;
const IMPORT_PROGRESS_TRACK_WIDTH = 160;
const IMPORT_PROGRESS_BAR_WIDTH = 56;

const ActionRow = ({
  icon,
  label,
  subtitle,
  onPress,
  disabled,
  featured,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  subtitle: string;
  onPress: () => void;
  disabled?: boolean;
  featured?: boolean;
}) => {
  const theme = UnistylesRuntime.getTheme();

  return (
    <Pressable
      style={[
        styles.row,
        disabled && styles.rowDisabled,
        featured && styles.rowFeatured,
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      {({ pressed }) => (
        <>
          {pressed && !disabled && (
            <View pointerEvents="none" style={styles.pressHighlight} />
          )}
          <View
            style={[
              styles.iconContainer,
              featured && styles.iconContainerFeatured,
            ]}
          >
            <Ionicons name={icon} size={24} color={theme.colors.primary} />
          </View>
          <View style={styles.textContainer}>
            <View style={styles.labelRow}>
              <Text type="body">{label}</Text>
              {featured && (
                <View style={styles.badge}>
                  <Text type="caption" style={styles.badgeText}>
                    Recommended
                  </Text>
                </View>
              )}
            </View>
            <Text type="subheadline" style={styles.subtitle}>
              {subtitle}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} style={styles.chevron} />
        </>
      )}
    </Pressable>
  );
};

const getImportIcon = (
  mode: SmartImportTask["mode"],
): keyof typeof Ionicons.glyphMap => {
  switch (mode) {
    case "url":
      return "link-outline";
    case "text":
      return "document-text-outline";
    case "image":
      return "image-outline";
  }
};

const getImportStatusCopy = (importItem: BackgroundImport) => {
  if (importItem.status === "ready") return "Recipe ready";
  if (importItem.status === "failed")
    return importItem.error || "Import failed";
  return "AI is reading the recipe";
};

const ImportProgressBar = ({ active }: { active: boolean }) => {
  const progress = useSharedValue(0);
  const { width } = useWindowDimensions();
  const trackWidth = Math.max(IMPORT_PROGRESS_TRACK_WIDTH, width - 72);

  useEffect(() => {
    if (active) {
      progress.value = withRepeat(
        withTiming(1, {
          duration: 1400,
          easing: Easing.inOut(Easing.ease),
        }),
        -1,
        true,
      );
    } else {
      progress.value = withTiming(1, { duration: 220 });
    }
  }, [active, progress]);

  const indicatorStyle = useAnimatedStyle(
    () => ({
      transform: [
        {
          translateX: progress.value * (trackWidth - IMPORT_PROGRESS_BAR_WIDTH),
        },
      ],
    }),
    [trackWidth],
  );

  return (
    <View style={styles.importProgressTrack}>
      <Animated.View
        style={[
          styles.importProgressIndicator,
          !active && styles.importProgressIndicatorDone,
          active && indicatorStyle,
        ]}
      />
    </View>
  );
};

const ImportQueueSummary = ({
  pendingCount,
  readyCount,
}: {
  pendingCount: number;
  readyCount: number;
}) => {
  const active = pendingCount > 0;

  return (
    <Animated.View
      entering={FadeIn.duration(180)}
      layout={LinearTransition.duration(180)}
      style={styles.importSummary}
    >
      <View style={styles.importSummaryTopRow}>
        <View style={styles.importSummaryTitleRow}>
          <Ionicons
            name={active ? "sparkles" : "checkmark"}
            size={18}
            style={styles.importSummaryIconGlyph}
          />
          <Text type="headline">
            {active ? "Smart import is working" : "Import ready"}
          </Text>
        </View>
        <Text type="caption" style={styles.importProgressLabel}>
          {active ? "Analyzing" : "Complete"}
        </Text>
      </View>
      <View style={styles.importSummaryText}>
        <Text type="subheadline" style={styles.importSummarySubtitle}>
          {active
            ? "You can keep using Cook Club. Your recipe will appear here when it is ready."
            : `${readyCount} recipe${readyCount === 1 ? "" : "s"} ready to review.`}
        </Text>
      </View>
      <ImportProgressBar active={active} />
    </Animated.View>
  );
};

const BackgroundImportCard = ({
  importItem,
  onReview,
  onDismiss,
}: {
  importItem: BackgroundImport;
  onReview: (id: string) => void;
  onDismiss: (id: string) => void;
}) => {
  const theme = UnistylesRuntime.getTheme();
  const isReady = importItem.status === "ready";
  const isFailed = importItem.status === "failed";
  const isPending = importItem.status === "pending";

  return (
    <Animated.View
      entering={FadeIn.duration(180)}
      layout={LinearTransition.duration(180)}
      style={[
        styles.importCard,
        !isReady && styles.importCardWithSeparator,
        isReady && styles.importCardReady,
        isFailed && styles.importCardFailed,
      ]}
    >
      {isPending && <View pointerEvents="none" style={styles.importCardGlow} />}
      <View
        style={[
          styles.importIconContainer,
          isFailed && styles.importIconContainerFailed,
          isReady && styles.importIconContainerReady,
        ]}
      >
        {importItem.status === "pending" ? (
          <ActivityIndicator size="small" color={theme.colors.primary} />
        ) : (
          <Ionicons
            name={
              isFailed ? "alert-circle-outline" : getImportIcon(importItem.mode)
            }
            size={22}
            color={isFailed ? theme.colors.destructive : theme.colors.primary}
          />
        )}
      </View>

      <View style={styles.importTextContainer}>
        <Text type="body" numberOfLines={1} style={styles.importTitle}>
          {importItem.title}
        </Text>
        <Text
          type="subheadline"
          numberOfLines={2}
          style={[
            styles.importSubtitle,
            isFailed && styles.importSubtitleFailed,
          ]}
        >
          {getImportStatusCopy(importItem)}
        </Text>
      </View>

      {isReady ? (
        <Pressable
          style={styles.importReviewButton}
          onPress={() => onReview(importItem.id)}
        >
          <Text type="caption" style={styles.importReviewButtonText}>
            Review
          </Text>
        </Pressable>
      ) : isFailed ? (
        <Pressable
          style={styles.importDismissButton}
          onPress={() => onDismiss(importItem.id)}
          accessibilityLabel="Dismiss failed import"
        >
          <Ionicons name="close" size={18} style={styles.importDismissIcon} />
        </Pressable>
      ) : null}
    </Animated.View>
  );
};

export const AddRecipeScreen = () => {
  const { navigate } = useNavigation();
  const insets = UnistylesRuntime.insets;

  // Sheet refs
  const smartImportSheetRef = useRef<SmartImportSheetRef>(null);
  const basicImportSheetRef = useRef<BasicImportSheetRef>(null);
  const recipeBrowserSheetRef = useRef<RecipeBrowserSheetRef>(null);
  const personaliseRecipeSheetRef = useRef<PersonaliseRecipeSheetRef>(null);
  const [selectedPersonaliseRecipeId, setSelectedPersonaliseRecipeId] =
    useState<number | null>(null);
  const {
    imports: backgroundImports,
    pendingCount: pendingImportCount,
    readyCount: readyImportCount,
    startImport,
    dismissImport,
    removeImport,
  } = useBackgroundImportQueue();
  const personalizeRecipeMutation = usePersonalizeRecipe();

  // Scroll tracking for header fade
  const titleOpacity = useSharedValue(1);

  const titleAnimatedStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
  }));

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = event.nativeEvent.contentOffset.y;
      const titleShouldHide = y > 5;
      titleOpacity.value = withTiming(titleShouldHide ? 0 : 1, {
        duration: 150,
      });
    },
    [titleOpacity],
  );

  const handleRecipeParsed = (result: ParsedRecipe | undefined) => {
    if (result) {
      navigate("RecipeDetail", { parsedRecipe: result, mode: "edit" });
    }
  };

  const handleSmartImportStarted = useCallback(
    (task: SmartImportTask) => {
      startImport(task);
    },
    [startImport],
  );

  const handleReviewImport = useCallback(
    (id: string) => {
      const importItem = backgroundImports.find((item) => item.id === id);
      if (!importItem?.recipe) return;

      removeImport(id);
      navigate("RecipeDetail", {
        parsedRecipe: importItem.recipe,
        mode: "edit",
      });
    },
    [backgroundImports, navigate, removeImport],
  );

  const handleDismissImport = useCallback(
    (id: string) => {
      dismissImport(id);
    },
    [dismissImport],
  );

  const onPressSmartImport = () => {
    smartImportSheetRef.current?.present();
  };

  const onPressCreate = () => {
    navigate("RecipeDetail", { draft: true, mode: "edit" });
  };

  const onPressAIChef = () => {
    navigate("GenerateRecipe");
  };

  const onPressPersonalise = () => {
    recipeBrowserSheetRef.current?.present();
  };

  const onPressBasicImport = () => {
    basicImportSheetRef.current?.present();
  };

  const handleSelectRecipeToPersonalise = async (recipeId: number) => {
    setSelectedPersonaliseRecipeId(recipeId);
    setTimeout(() => {
      personaliseRecipeSheetRef.current?.present();
    }, 350);
  };

  const handlePersonaliseRecipe = async (input: {
    goals: PersonalizationGoal[];
    allergyNotes?: string;
    customNotes?: string;
  }) => {
    if (!selectedPersonaliseRecipeId) {
      Alert.alert("Choose a recipe", "Select a recipe to personalise first.");
      return;
    }

    try {
      const result = await personalizeRecipeMutation.mutateAsync({
        recipeId: selectedPersonaliseRecipeId,
        goals: input.goals,
        allergyNotes: input.allergyNotes,
        customNotes: input.customNotes,
      });

      personaliseRecipeSheetRef.current?.dismiss();
      setSelectedPersonaliseRecipeId(null);
      navigate("RecipeDetail", {
        parsedRecipe: result as ParsedRecipe,
        mode: "edit",
      });
    } catch (err: any) {
      Alert.alert(
        "Personalisation Failed",
        err?.message || "Something went wrong while personalising the recipe.",
      );
    }
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        <VSpace size={insets.top + HEADER_HEIGHT + 8} />

        {backgroundImports.length > 0 && (
          <>
            <VSpace size={8} />
            <View style={styles.importQueue}>
              <ImportQueueSummary
                pendingCount={pendingImportCount}
                readyCount={readyImportCount}
              />
              {backgroundImports.map((importItem) => (
                <BackgroundImportCard
                  key={importItem.id}
                  importItem={importItem}
                  onReview={handleReviewImport}
                  onDismiss={handleDismissImport}
                />
              ))}
            </View>
            <VSpace size={24} />
          </>
        )}

        {/* Import Section */}
        <Text style={styles.sectionTitle}>Import</Text>
        <VSpace size={8} />
        <View style={styles.section}>
          <ActionRow
            icon="link"
            label="Basic import"
            subtitle="Import from URL. Works for most recipe websites."
            onPress={onPressBasicImport}
          />
          <View style={styles.separator} />
          <ActionRow
            icon="sparkles"
            label="Smart import"
            subtitle="Import from anywhere including social media using AI."
            onPress={onPressSmartImport}
            featured
          />
        </View>

        <VSpace size={24} />

        {/* AI Section */}
        <Text style={styles.sectionTitle}>AI Tools</Text>
        <VSpace size={8} />
        <View style={styles.section}>
          <ActionRow
            icon="restaurant"
            label="AI Chef"
            subtitle="Describe what you want and AI will create a recipe."
            onPress={onPressAIChef}
          />
          <View style={styles.separator} />
          <ActionRow
            icon="sparkles"
            label="Personalise recipe"
            subtitle="Make it vegan, cheaper, healthier, kid-friendly, or meal-prep ready."
            onPress={onPressPersonalise}
          />
        </View>

        <VSpace size={24} />

        {/* Manual Section */}
        <Text style={styles.sectionTitle}>Manual</Text>
        <VSpace size={8} />
        <View style={styles.section}>
          <ActionRow
            icon="create"
            label="Create from scratch"
            subtitle="Build your own recipe step by step."
            onPress={onPressCreate}
          />
        </View>
      </ScrollView>

      {/* Fixed Header */}
      <View style={styles.fixedHeader}>
        <Animated.View style={titleAnimatedStyle}>
          <Text type="screenTitle">Add recipe</Text>
        </Animated.View>
      </View>

      {/* Sheets */}
      <SmartImportSheet
        ref={smartImportSheetRef}
        onImportStarted={handleSmartImportStarted}
      />
      <BasicImportSheet
        ref={basicImportSheetRef}
        onRecipeParsed={handleRecipeParsed}
      />
      <RecipeBrowserSheet
        ref={recipeBrowserSheetRef}
        title="Choose Recipe"
        onSelectRecipe={handleSelectRecipeToPersonalise}
      />
      <PersonaliseRecipeSheet
        ref={personaliseRecipeSheetRef}
        isSubmitting={personalizeRecipeMutation.isPending}
        onSubmit={handlePersonaliseRecipe}
      />
    </View>
  );
};

const styles = StyleSheet.create((theme, rt) => ({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollView: {
    flex: 1,
  },
  container: {
    paddingBottom: 40,
  },
  fixedHeader: {
    position: "absolute",
    top: rt.insets.top,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: 20,
    fontFamily: theme.fonts.semiBold,
    marginLeft: 24,
  },
  section: {
    marginHorizontal: 20,
    backgroundColor: theme.colors.inputBackground,
    borderRadius: theme.borderRadius.large,
    overflow: "hidden",
  },
  importQueue: {
    marginHorizontal: 20,
    backgroundColor: theme.colors.inputBackground,
    borderRadius: theme.borderRadius.large,
    overflow: "hidden",
  },
  importSummary: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
    gap: 10,
    backgroundColor: theme.colors.inputBackground,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  importSummaryTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  importSummaryTitleRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  importSummaryIconGlyph: {
    color: theme.colors.primary,
  },
  importSummaryText: {
    gap: 4,
  },
  importSummarySubtitle: {
    color: theme.colors.textSecondary,
  },
  importProgressTrack: {
    width: "100%",
    height: 8,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.background,
    overflow: "hidden",
  },
  importProgressIndicator: {
    width: IMPORT_PROGRESS_BAR_WIDTH,
    height: "100%",
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.primary,
  },
  importProgressIndicatorDone: {
    width: IMPORT_PROGRESS_TRACK_WIDTH,
  },
  importProgressLabel: {
    color: theme.colors.primary,
    fontFamily: theme.fonts.semiBold,
    fontVariant: ["tabular-nums"],
  },
  importCard: {
    minHeight: 74,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    backgroundColor: theme.colors.inputBackground,
    overflow: "hidden",
  },
  importCardWithSeparator: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  importCardReady: {
    backgroundColor: theme.colors.inputBackground,
  },
  importCardFailed: {
    backgroundColor: theme.colors.inputBackground,
  },
  importCardGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.primary + "04",
  },
  importIconContainer: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: theme.colors.primary + "18",
    justifyContent: "center",
    alignItems: "center",
  },
  importIconContainerReady: {
    backgroundColor: theme.colors.primary + "22",
  },
  importIconContainerFailed: {
    backgroundColor: theme.colors.destructive + "16",
  },
  importTextContainer: {
    flex: 1,
    gap: 2,
  },
  importTitle: {
    position: "relative",
  },
  importSubtitle: {
    color: theme.colors.textSecondary,
  },
  importSubtitleFailed: {
    color: theme.colors.destructive,
  },
  importReviewButton: {
    minWidth: 72,
    height: 34,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  importReviewButtonText: {
    color: theme.colors.buttonText,
    fontFamily: theme.fonts.semiBold,
  },
  importDismissButton: {
    width: 34,
    height: 34,
    borderRadius: theme.borderRadius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.pressHighlight,
  },
  importDismissIcon: {
    color: theme.colors.textSecondary,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 16,
    position: "relative",
  },
  pressHighlight: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.pressHighlight,
  },
  rowDisabled: {
    opacity: 0.5,
  },
  rowFeatured: {
    backgroundColor: theme.colors.primary + "10",
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: theme.colors.primary + "15",
    justifyContent: "center",
    alignItems: "center",
  },
  iconContainerFeatured: {
    backgroundColor: theme.colors.primary + "25",
  },
  textContainer: {
    flex: 1,
    gap: 2,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  badge: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.full,
  },
  badgeText: {
    color: "white",
    fontWeight: "600",
  },
  subtitle: {
    color: theme.colors.textSecondary,
  },
  chevron: {
    color: theme.colors.textTertiary,
  },
  separator: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginLeft: 72,
  },
}));
