import { TouchableOpacity } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { Text } from './Text';

interface Props {
  label: string;
  selected: boolean;
  onPress: () => void;
}

export const TagChip = ({ label, selected, onPress }: Props) => {
  return (
    <TouchableOpacity
      style={[styles.chip, selected && styles.chipSelected]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text type="bodyFaded" style={[styles.chipText, selected && styles.chipTextSelected]}>
        {label}
      </Text>
    </TouchableOpacity>
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
  chipSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  chipText: {
    fontSize: 14,
  },
  chipTextSelected: {
    color: theme.colors.buttonText,
  },
}));
