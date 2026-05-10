import { useNavigation } from "@react-navigation/native";
import { StyleSheet } from "react-native-unistyles";

import { Ionicons } from "@/components/Ionicons";
import { ScalePressable } from "@/components/buttons/ScalePressable";

export const BackButton = () => {
  const { goBack } = useNavigation();
  return (
    <ScalePressable
      style={styles.button}
      onPress={goBack}
      accessibilityRole="button"
      accessibilityLabel="Go back"
    >
      <Ionicons name="arrow-back" size={22} style={styles.icon} />
    </ScalePressable>
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
