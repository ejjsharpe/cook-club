import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useState } from "react";
import { View, TouchableOpacity, Alert, ScrollView } from "react-native";
import { StyleSheet, UnistylesRuntime } from "react-native-unistyles";

import { useSignOut } from "@/api/auth";
import { SafeAreaView } from "@/components/SafeAreaView";
import { ScreenHeader } from "@/components/ScreenHeader";
import { VSpace } from "@/components/Space";
import { Text } from "@/components/Text";
import { BackButton } from "@/components/buttons/BackButton";
import {
  applyThemePreference,
  getThemePreference,
  setThemePreference,
  type ThemePreference,
} from "@/lib/themePreferences";

type SettingsRowProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  onPress: () => void;
  destructive?: boolean;
};

const SettingsRow = ({
  icon,
  label,
  value,
  onPress,
  destructive,
}: SettingsRowProps) => {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.rowLeft}>
        <View
          style={[styles.iconContainer, destructive && styles.destructiveIcon]}
        >
          <Ionicons
            name={icon}
            size={20}
            style={destructive ? styles.destructiveIconColor : styles.iconColor}
          />
        </View>
        <Text
          type="body"
          style={destructive ? styles.destructiveText : undefined}
        >
          {label}
        </Text>
      </View>
      <View style={styles.rowRight}>
        {value && (
          <Text type="bodyFaded" style={styles.valueText}>
            {value}
          </Text>
        )}
        <Ionicons
          name="chevron-forward"
          size={20}
          style={destructive ? styles.destructiveChevron : styles.chevron}
        />
      </View>
    </TouchableOpacity>
  );
};

const ThemeOption = ({
  label,
  value,
  selected,
  onPress,
}: {
  label: string;
  value: ThemePreference;
  selected: boolean;
  onPress: () => void;
}) => {
  return (
    <TouchableOpacity
      style={[styles.themeOption, selected && styles.themeOptionSelected]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text
        type="body"
        style={selected ? styles.themeOptionTextSelected : undefined}
      >
        {label}
      </Text>
      {selected && (
        <Ionicons name="checkmark" size={20} style={styles.checkmark} />
      )}
    </TouchableOpacity>
  );
};

export const SettingsScreen = () => {
  const navigation = useNavigation();
  const signOutMutation = useSignOut();
  const insets = UnistylesRuntime.insets;
  const [currentTheme, setCurrentTheme] =
    useState<ThemePreference>(getThemePreference);

  const handleThemeChange = (theme: ThemePreference) => {
    setCurrentTheme(theme);
    setThemePreference(theme);
    applyThemePreference(theme);
  };

  const handleSignOut = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: () => signOutMutation.mutate(),
      },
    ]);
  };

  return (
    <SafeAreaView edges={["top"]} style={styles.container}>
      <VSpace size={8} />
      <View style={styles.headerRow}>
        <BackButton />
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
      >
        <ScreenHeader title="Settings" style={styles.screenHeader} />

        {/* Appearance Section */}
        <VSpace size={32} />
        <Text type="heading" style={styles.sectionTitle}>
          Appearance
        </Text>
        <VSpace size={12} />
        <View style={styles.themeSelector}>
          <ThemeOption
            label="Light"
            value="light"
            selected={currentTheme === "light"}
            onPress={() => handleThemeChange("light")}
          />
          <ThemeOption
            label="Dark"
            value="dark"
            selected={currentTheme === "dark"}
            onPress={() => handleThemeChange("dark")}
          />
          <ThemeOption
            label="System"
            value="system"
            selected={currentTheme === "system"}
            onPress={() => handleThemeChange("system")}
          />
        </View>

        {/* Preferences Section */}
        <VSpace size={32} />
        <Text type="heading" style={styles.sectionTitle}>
          Preferences
        </Text>
        <VSpace size={12} />
        <View style={styles.section}>
          <SettingsRow
            icon="restaurant-outline"
            label="Cuisine Preferences"
            onPress={() => navigation.navigate("CuisinePreferences")}
          />
          <View style={styles.separator} />
          <SettingsRow
            icon="leaf-outline"
            label="Ingredient Preferences"
            onPress={() => navigation.navigate("IngredientPreferences")}
          />
          <View style={styles.separator} />
          <SettingsRow
            icon="nutrition-outline"
            label="Dietary Requirements"
            onPress={() => navigation.navigate("DietaryPreferences")}
          />
        </View>

        {/* Account Section */}
        <VSpace size={32} />
        <Text type="heading" style={styles.sectionTitle}>
          Account
        </Text>
        <VSpace size={12} />
        <View style={styles.section}>
          <SettingsRow
            icon="log-out-outline"
            label="Sign Out"
            onPress={handleSignOut}
            destructive
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  headerRow: {
    paddingHorizontal: 20,
  },
  screenHeader: {
    paddingHorizontal: 0,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    marginLeft: 4,
  },
  section: {
    backgroundColor: theme.colors.inputBackground,
    borderRadius: theme.borderRadius.large,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  rowRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.primary + "20",
    justifyContent: "center",
    alignItems: "center",
  },
  iconColor: {
    color: theme.colors.primary,
  },
  destructiveIcon: {
    backgroundColor: theme.colors.destructive + "20",
  },
  destructiveIconColor: {
    color: theme.colors.destructive,
  },
  destructiveText: {
    color: theme.colors.destructive,
  },
  destructiveChevron: {
    color: theme.colors.destructive + "60",
  },
  valueText: {
    fontSize: 15,
  },
  chevron: {
    color: theme.colors.textTertiary,
  },
  separator: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginLeft: 60,
  },
  themeSelector: {
    flexDirection: "row",
    gap: 12,
  },
  themeOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 50,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.inputBackground,
    gap: 6,
  },
  themeOptionSelected: {
    backgroundColor: theme.colors.primary + "20",
  },
  themeOptionTextSelected: {
    color: theme.colors.primary,
    fontWeight: "500",
  },
  checkmark: {
    color: theme.colors.primary,
  },
}));
