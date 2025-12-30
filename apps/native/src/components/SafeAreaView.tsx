import { View, ViewProps } from "react-native";
import { StyleSheet } from "react-native-unistyles";

type Edge = "top" | "bottom" | "left" | "right";

interface SafeAreaViewProps extends ViewProps {
  edges?: Edge[];
}

export const SafeAreaView = ({
  edges = ["top", "bottom", "left", "right"],
  style,
  ...props
}: SafeAreaViewProps) => {
  const edgeSet = new Set(edges);
  styles.useVariants({
    top: edgeSet.has("top"),
    bottom: edgeSet.has("bottom"),
    left: edgeSet.has("left"),
    right: edgeSet.has("right"),
  });

  return <View {...props} style={[styles.container, style]} />;
};

const styles = StyleSheet.create((_theme, rt) => ({
  container: {
    variants: {
      top: {
        true: { paddingTop: rt.insets.top },
        false: {},
      },
      bottom: {
        true: { paddingBottom: rt.insets.bottom },
        false: {},
      },
      left: {
        true: { paddingLeft: rt.insets.left },
        false: {},
      },
      right: {
        true: { paddingRight: rt.insets.right },
        false: {},
      },
    },
  },
}));
