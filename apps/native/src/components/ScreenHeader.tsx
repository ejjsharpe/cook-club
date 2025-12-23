import { View, ViewStyle } from "react-native";

import { VSpace } from "./Space";
import { Text } from "./Text";

interface Props {
  title: string;
  children?: React.ReactNode;
  style?: ViewStyle;
}

export const ScreenHeader = ({ title, children, style }: Props) => {
  return (
    <View style={style}>
      <VSpace size={28} />
      <Text type="title1">{title}</Text>
      {children}
    </View>
  );
};
