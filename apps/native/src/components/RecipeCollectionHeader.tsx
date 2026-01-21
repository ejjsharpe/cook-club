import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { View, TouchableOpacity } from "react-native";
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  withSpring,
  interpolate,
  type SharedValue,
  type AnimatedStyle,
} from "react-native-reanimated";
import { StyleSheet, UnistylesRuntime } from "react-native-unistyles";

import { SearchBar } from "./SearchBar";
import { SegmentedControl, type TabOption } from "./SegmentedControl";
import { VSpace } from "./Space";

import type { TabType } from "@/hooks/useTabNavigation";

// Header content heights
// Full: search (50) + VSpace (8) + segmented (44) + VSpace (32) = 134
export const HEADER_CONTENT_HEIGHT = 134;
export const SEARCH_BAR_ROW_HEIGHT = 58; // search (50) + VSpace (8)

const tabOptions: TabOption<TabType>[] = [
  { value: "recipes", label: "Recipes" },
  { value: "collections", label: "Collections" },
];

interface RecipeCollectionHeaderProps {
  // Search
  searchQuery: string;
  onSearchChange: (query: string) => void;
  hideSearchBar?: boolean;

  // Tab
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  scrollProgress: SharedValue<number>;

  // Filter
  hasActiveFilters: boolean;
  onOpenFilters: () => void;
  filterButtonStyle: AnimatedStyle<{
    opacity: number;
    transform: { scale: number }[];
    width: number;
    marginLeft: number;
  }>;

  // Animation
  headerAnimationProgress?: SharedValue<number>;
}

export const RecipeCollectionHeader = ({
  searchQuery,
  onSearchChange,
  hideSearchBar = false,
  activeTab,
  onTabChange,
  scrollProgress,
  hasActiveFilters,
  onOpenFilters,
  filterButtonStyle,
  headerAnimationProgress,
}: RecipeCollectionHeaderProps) => {
  const theme = UnistylesRuntime.getTheme();

  // Spring animation for segmented control entrance
  const segmentedControlSpring = useDerivedValue(() => {
    return withSpring(headerAnimationProgress?.value ?? 0, {
      mass: 0.5,
    });
  });

  const headerEntranceStyle = useAnimatedStyle(() => {
    "worklet";
    const scale = interpolate(segmentedControlSpring.value, [0, 1], [0.8, 1]);
    return {
      opacity: segmentedControlSpring.value,
      transform: [{ scale }],
    };
  });

  return (
    <View style={styles.headerContainer}>
      <LinearGradient
        colors={[theme.colors.background, `${theme.colors.background}00`]}
        style={styles.headerGradient}
        pointerEvents="none"
      />
      <View
        style={[
          styles.header,
          hideSearchBar && {
            paddingTop: UnistylesRuntime.insets.top + SEARCH_BAR_ROW_HEIGHT,
          },
        ]}
      >
        {!hideSearchBar && (
          <>
            <View style={[styles.searchRow, styles.headerPadded]}>
              <View style={styles.searchBarWrapper}>
                <SearchBar
                  placeholder={
                    activeTab === "recipes"
                      ? "Search recipes..."
                      : "Search collections..."
                  }
                  value={searchQuery}
                  onChangeText={onSearchChange}
                />
              </View>
              <Animated.View
                style={[styles.filterButtonWrapper, filterButtonStyle]}
                pointerEvents={activeTab === "recipes" ? "auto" : "none"}
              >
                <TouchableOpacity
                  style={styles.filterButton}
                  onPress={onOpenFilters}
                >
                  <Ionicons
                    name="options-outline"
                    size={22}
                    color={theme.colors.text}
                  />
                  {hasActiveFilters && <View style={styles.filterBadge} />}
                </TouchableOpacity>
              </Animated.View>
            </View>
            <VSpace size={8} />
          </>
        )}
        <Animated.View style={[styles.headerPadded, headerEntranceStyle]}>
          <SegmentedControl
            options={tabOptions}
            value={activeTab}
            onValueChange={onTabChange}
            scrollProgress={scrollProgress}
            fullWidth
          />
        </Animated.View>
        <VSpace size={32} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create((theme, rt) => ({
  headerContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  headerGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  header: {
    paddingTop: rt.insets.top,
  },
  headerPadded: {
    paddingHorizontal: 20,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  searchBarWrapper: {
    flex: 1,
  },
  filterButtonWrapper: {
    overflow: "hidden",
  },
  filterButton: {
    backgroundColor: theme.colors.inputBackground,
    borderRadius: theme.borderRadius.full,
    width: 50,
    height: 50,
    justifyContent: "center",
    alignItems: "center",
  },
  filterBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.primary,
  },
}));
