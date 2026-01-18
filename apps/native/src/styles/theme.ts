import { borderRadius } from "./borderRadius";
import { colors } from "./colors";
import { fonts } from "./fonts";

export const lightTheme = {
  colors: {
    background: colors.white,
    primary: colors.red,
    destructive: "#FF3B30",
    text: colors.black,
    textSecondary: "rgba(0, 0, 0, 0.5)",
    textTertiary: "rgba(0, 0, 0, 0.1)",
    buttonText: colors.white,
    border: `${colors.black}26`,
    inputBackground: "#F2F4F5",
    placeholderText: "#BCBDC0",
  },
  fonts,
  borderRadius,
} as const;

export const darkTheme = {
  colors: {
    background: colors.black,
    primary: colors.red,
    destructive: "#FF453A",
    text: colors.white,
    textSecondary: "rgba(255, 255, 255, 0.6)",
    textTertiary: "rgba(255, 255, 255, 0.4)",
    buttonText: colors.white,
    border: `${colors.white}26`,
    inputBackground: "rgba(120, 120, 128, 0.24)",
    placeholderText: "#BCBDC0",
  },
  fonts,
  borderRadius,
} as const;
