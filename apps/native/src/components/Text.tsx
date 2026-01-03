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
    | "headline"
    | "heading" // Alias for headline
    | "highlight"
    | "callout"
    | "subheadline"
    | "footnote"
    | "caption"
    | "caption1"
    | "caption2";
}

export const Text = ({ type = "body", ...props }: Props) => {
  styles.useVariants({ type });
  return <_Text {...props} style={[styles.text, props.style]} />;
};

const styles = StyleSheet.create((theme) => ({
  text: {
    variants: {
      type: {
        // iOS Large Title: 34pt Regular
        largeTitle: {
          fontSize: 34,
          lineHeight: 41,
          color: theme.colors.text,
          fontFamily: theme.fonts.baskervilleBold,
          letterSpacing: -1,
        },
        // iOS Title 1: 28pt Regular
        title1: {
          fontSize: 28,
          lineHeight: 34,
          color: theme.colors.text,
          fontFamily: theme.fonts.baskervilleBold,
          letterSpacing: -1,
        },
        // iOS Title 2: 22pt Regular
        title2: {
          fontSize: 22,
          lineHeight: 28,
          color: theme.colors.text,
          fontFamily: theme.fonts.albertBold,
          letterSpacing: 0.35,
        },
        // iOS Title 3: 20pt Regular
        title3: {
          fontSize: 20,
          lineHeight: 25,
          color: theme.colors.text,
          fontFamily: theme.fonts.albertSemiBold,
          letterSpacing: 0.38,
        },
        // iOS Headline: 17pt Semibold
        headline: {
          fontSize: 17,
          lineHeight: 22,
          color: theme.colors.text,
          fontFamily: theme.fonts.albertSemiBold,
          letterSpacing: -0.41,
        },
        // iOS Body: 17pt Regular
        body: {
          fontSize: 17,
          lineHeight: 22,
          color: theme.colors.text,
          fontFamily: theme.fonts.albertRegular,
          letterSpacing: -0.41,
        },
        // Highlight variant (same as body but primary color)
        highlight: {
          fontSize: 17,
          lineHeight: 22,
          color: theme.colors.primary,
          fontFamily: theme.fonts.albertSemiBold,
          letterSpacing: -0.41,
        },
        // Body faded variant
        bodyFaded: {
          fontSize: 17,
          lineHeight: 22,
          color: theme.colors.textSecondary,
          fontFamily: theme.fonts.albertRegular,
          letterSpacing: -0.41,
        },
        // iOS Callout: 16pt Regular
        callout: {
          fontSize: 16,
          lineHeight: 21,
          color: theme.colors.text,
          fontFamily: theme.fonts.albertRegular,
          letterSpacing: -0.32,
        },
        // iOS Subheadline: 15pt Regular
        subheadline: {
          fontSize: 15,
          lineHeight: 20,
          color: theme.colors.text,
          fontFamily: theme.fonts.albertRegular,
          letterSpacing: -0.24,
        },
        // iOS Footnote: 13pt Regular
        footnote: {
          fontSize: 13,
          lineHeight: 18,
          color: theme.colors.text,
          fontFamily: theme.fonts.albertRegular,
          letterSpacing: -0.08,
        },
        // iOS Caption 1: 12pt Regular
        caption1: {
          fontSize: 12,
          lineHeight: 16,
          color: theme.colors.textSecondary,
          fontFamily: theme.fonts.albertRegular,
          letterSpacing: 0,
        },
        // iOS Caption 2: 11pt Regular
        caption2: {
          fontSize: 11,
          lineHeight: 13,
          color: theme.colors.textSecondary,
          fontFamily: theme.fonts.albertRegular,
          letterSpacing: 0.07,
        },
        // Alias: heading -> headline (for backwards compatibility)
        heading: {
          fontSize: 17,
          lineHeight: 22,
          color: theme.colors.text,
          fontFamily: theme.fonts.albertSemiBold,
          letterSpacing: -0.41,
        },
        // Alias: caption -> footnote (for backwards compatibility)
        caption: {
          fontSize: 13,
          lineHeight: 18,
          color: theme.colors.textSecondary,
          fontFamily: theme.fonts.albertRegular,
          letterSpacing: -0.08,
        },
      },
    },
  },
}));
