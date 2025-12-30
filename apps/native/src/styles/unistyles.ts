import { StyleSheet } from "react-native-unistyles";

import { breakpoints } from "./breakpoints";
import { darkTheme, lightTheme } from "./theme";

import {
  applyThemePreference,
  getThemePreference,
} from "@/lib/themePreferences";

type AppBreakpoints = typeof breakpoints;

type AppThemes = {
  light: typeof lightTheme;
  dark: typeof darkTheme;
};

declare module "react-native-unistyles" {
  export interface UnistylesBreakpoints extends AppBreakpoints {}
  export interface UnistylesThemes extends AppThemes {}
}

StyleSheet.configure({
  settings: { adaptiveThemes: true },
  breakpoints,
  themes: { light: lightTheme, dark: darkTheme },
});

// Initialize theme from stored preference
const storedPreference = getThemePreference();
if (storedPreference !== "system") {
  applyThemePreference(storedPreference);
}
