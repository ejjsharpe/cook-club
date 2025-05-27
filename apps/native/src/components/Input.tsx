import { useState } from 'react';
import { TextInput, TextInputProps, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { Text } from './Text';

interface Props extends TextInputProps {
  label?: string;
}

export const Input = ({ label, style, ...props }: Props) => {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={styles.container}>
      {!!label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        style={[styles.input, isFocused && styles.focused, style]}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        {...props}
      />
    </View>
  );
};

const styles = StyleSheet.create((theme) => ({
  container: {
    width: '100%',
  },
  label: { marginBottom: 8, marginLeft: 4 },
  input: {
    width: '100%',
    padding: 14,
    borderRadius: theme.borderRadius.medium,
    borderColor: theme.colors.border,
    borderWidth: 1,
    justifyContent: 'center',
    fontFamily: theme.fonts.albertRegular,
    fontSize: 17,
  },
  focused: {
    borderColor: `${theme.colors.text}80`,
  },
}));
