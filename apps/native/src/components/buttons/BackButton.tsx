import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { TouchableOpacity } from "react-native";
import { StyleSheet } from "react-native-unistyles";

export const BackButton = () => {
  const { goBack } = useNavigation();
  return (
    <TouchableOpacity
      style={styles.button}
      onPress={goBack}
      activeOpacity={0.7}
    >
      <Ionicons name="arrow-back" size={22} style={styles.icon} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create((theme) => ({
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.inputBackground,
    justifyContent: "center",
    alignItems: "center",
  },
  icon: {
    color: theme.colors.text,
  },
}));
