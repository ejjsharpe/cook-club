import { borderRadius } from "./borderRadius";
import { colors } from "./colors";
import { fonts } from "./fonts";

export const lightTheme = {
  colors: {
    background: colors.white,
    primary: colors.red,
    text: colors.black,
    buttonText: colors.white,
    border: `${colors.black}26`,
  },
  fonts,
  borderRadius,
} as const;

export const darkTheme = {
  colors: {
    background: colors.black,
    primary: colors.red,
    text: colors.white,
    buttonText: colors.white,
    border: `${colors.white}26`,
  },
  fonts,
  borderRadius,
} as const;
