import { View, TextInput, TouchableOpacity } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
}

export const SearchBar = ({ value, onChangeText, placeholder = 'Search recipes...' }: Props) => {
  return (
    <View style={styles.container}>
      <Ionicons name="search" size={20} style={styles.searchIcon} />
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {value.length > 0 && (
        <TouchableOpacity onPress={() => onChangeText('')} style={styles.clearButton}>
          <Ionicons name="close-circle" size={20} style={styles.clearIcon} />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create((theme) => ({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.medium,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10.5,
  },
  searchIcon: {
    marginRight: 8,
    color: theme.colors.text,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: theme.colors.text,
    fontFamily: theme.fonts.albertRegular,
  },
  clearButton: {
    padding: 4,
  },
  clearIcon: {
    color: theme.colors.text,
  },
}));
