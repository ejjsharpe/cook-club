import { Text as _Text, TextProps } from "react-native";
import { StyleSheet } from "react-native-unistyles";

interface Props extends TextProps {
  type?:
    | "body"
    | "bodyFaded"
    | "largeTitle"
    | "title1"
    | "title2"
    | "title3"
    | "highlight"
    | "heading"
    | "caption";
}

export const Text = ({ type = "body", ...props }: Props) => {
  styles.useVariants({ type });
  return <_Text {...props} style={[styles.text, props.style]} />;
};

const styles = StyleSheet.create((theme) => ({
  text: {
    variants: {
      type: {
        body: {
          fontSize: 17,
          color: theme.colors.text,
          fontFamily: theme.fonts.albertRegular,
        },
        highlight: {
          fontSize: 17,
          color: theme.colors.primary,
          fontFamily: theme.fonts.albertBold,
        },
        bodyFaded: {
          fontSize: 17,
          color: theme.colors.text,
          fontFamily: theme.fonts.albertBold,
          opacity: 0.5,
        },
        largeTitle: {
          fontSize: 34,
          color: theme.colors.text,
          fontFamily: theme.fonts.baskervilleBold,
          letterSpacing: -1,
        },
        title1: {
          fontSize: 28,
          color: theme.colors.text,
          fontFamily: theme.fonts.baskervilleBold,
          letterSpacing: -1,
        },
        title2: {
          fontSize: 22,
          color: theme.colors.text,
          fontFamily: theme.fonts.albertBold,
          letterSpacing: -0.5,
        },
        title3: {
          fontSize: 20,
          color: theme.colors.text,
          fontFamily: theme.fonts.albertBold,
          letterSpacing: -0.5,
        },
        heading: {
          fontSize: 17,
          color: theme.colors.text,
          fontFamily: theme.fonts.albertBold,
          letterSpacing: -0.5,
        },
        caption: {
          fontSize: 13,
          color: theme.colors.text,
          fontFamily: theme.fonts.albertMedium,
          opacity: 0.5,
        },
      },
    },
  },
}));
