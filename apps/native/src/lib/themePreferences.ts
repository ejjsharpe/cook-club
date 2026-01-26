import { Appearance } from "react-native";
import { UnistylesRuntime } from "react-native-unistyles";

import { storage } from "./mmkv";

export type ThemePreference = "light" | "dark" | "system";

const THEME_PREFERENCE_KEY = "theme_preference";

export function getThemePreference(): ThemePreference {
  const stored = storage.getString(THEME_PREFERENCE_KEY);
  return (stored as ThemePreference) || "system";
}

export function setThemePreference(theme: ThemePreference): void {
  storage.set(THEME_PREFERENCE_KEY, theme);
}

export function applyThemePreference(preference: ThemePreference): void {
  if (preference === "system") {
    UnistylesRuntime.setAdaptiveThemes(true);
    // Set to current system color scheme for native components
    const systemScheme = Appearance.getColorScheme() ?? "light";
    Appearance.setColorScheme(systemScheme);
  } else {
    UnistylesRuntime.setAdaptiveThemes(false);
    UnistylesRuntime.setTheme(preference);
    Appearance.setColorScheme(preference);
  }
}

export function getThemeDisplayName(theme: ThemePreference): string {
  switch (theme) {
    case "light":
      return "Light";
    case "dark":
      return "Dark";
    case "system":
      return "System";
    default:
      return "System";
  }
}
