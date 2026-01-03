import { borderRadius } from "./borderRadius";
import { colors } from "./colors";
import { fonts } from "./fonts";

export const lightTheme = {
  colors: {
    background: colors.white,
    primary: colors.red,
    text: colors.black,
    textSecondary: "rgba(0, 0, 0, 0.5)",
    textTertiary: "rgba(0, 0, 0, 0.35)",
    buttonText: colors.white,
    border: `${colors.black}26`,
    inputBackground: "rgba(120, 120, 128, 0.12)",
    inputBackgroundFocused: "rgba(120, 120, 128, 0.18)",
    secondaryButtonBackground: "rgba(120, 120, 128, 0.12)",
  },
  fonts,
  borderRadius,
} as const;

export const darkTheme = {
  colors: {
    background: colors.black,
    primary: colors.red,
    text: colors.white,
    textSecondary: "rgba(255, 255, 255, 0.6)",
    textTertiary: "rgba(255, 255, 255, 0.4)",
    buttonText: colors.white,
    border: `${colors.white}26`,
    inputBackground: "rgba(120, 120, 128, 0.24)",
    inputBackgroundFocused: "rgba(120, 120, 128, 0.32)",
    secondaryButtonBackground: "rgba(120, 120, 128, 0.24)",
  },
  fonts,
  borderRadius,
} as const;
