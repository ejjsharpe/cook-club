import { Ionicons as ExpoIonicons } from "@expo/vector-icons";
import { withUnistyles } from "react-native-unistyles";

export const Ionicons = Object.assign(withUnistyles(ExpoIonicons), {
  glyphMap: ExpoIonicons.glyphMap,
});
