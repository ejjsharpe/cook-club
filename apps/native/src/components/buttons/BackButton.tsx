import { useNavigation } from "@react-navigation/native";
import { TouchableOpacity } from "react-native";

import { BackIcon } from "@/components/svg/BackIcon";

export const BackButton = ({ color = "black" }) => {
  const { goBack } = useNavigation();
  return (
    <TouchableOpacity onPress={goBack}>
      <BackIcon stroke={color} />
    </TouchableOpacity>
  );
};
