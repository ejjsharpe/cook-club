import { TouchableOpacity, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { Text } from './Text';

interface Props {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  size?: 'small' | 'medium';
}

export const TagChip = ({ label, selected = false, onPress, size = 'medium' }: Props) => {
  const Wrapper = onPress ? TouchableOpacity : View;

  return (
    <Wrapper
      style={[
        styles.chip,
        size === 'small' && styles.chipSmall,
        selected && styles.chipSelected,
      ]}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <Text
        type="bodyFaded"
        style={[
          styles.chipText,
          size === 'small' && styles.chipTextSmall,
          selected && styles.chipTextSelected,
        ]}
      >
        {label}
      </Text>
    </Wrapper>
  );
};

const styles = StyleSheet.create((theme) => ({
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.medium,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  chipSmall: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.small,
  },
  chipSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  chipText: {
    fontSize: 14,
  },
  chipTextSmall: {
    fontSize: 11,
  },
  chipTextSelected: {
    color: theme.colors.buttonText,
  },
}));
