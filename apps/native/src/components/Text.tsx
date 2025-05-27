import { Text as _Text, TextProps } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

interface Props extends TextProps {
  type?: 'body' | 'bodyFaded' | 'largeTitle' | 'title1' | 'title2' | 'highlight' | 'heading';
}

export const Text = ({ type = 'body', ...props }: Props) => {
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
          fontFamily: theme.fonts.albertRegular,
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
          fontSize: 25,
          color: theme.colors.text,
          fontFamily: theme.fonts.baskervilleBold,
          letterSpacing: -1,
        },
        heading: {
          fontSize: 17,
          color: theme.colors.text,
          fontFamily: theme.fonts.baskervilleBold,
        },
      },
    },
  },
}));
