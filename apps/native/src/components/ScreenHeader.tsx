import { View, ViewStyle } from "react-native";
import { StyleSheet } from "react-native-unistyles";

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
      <VSpace size={24} />
      <View style={styles.titleRow}>
        <Text type="title1">{title}</Text>
      </View>
      {children && (
        <>
          <VSpace size={20} />
          {children}
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create(() => ({
  titleRow: {
    minHeight: 40,
    justifyContent: "center",
  },
}));
