import * as React from "react";
import { View, ViewStyle } from "react-native";
import Svg, { Path } from "react-native-svg";

export const AppleLogo = ({
  size = 40,
  color,
  style,
}: {
  size: number;
  color: string;
  style: ViewStyle;
}) => (
  <View
    style={{
      width: size,
      height: size,
      ...style,
      alignItems: "center",
      justifyContent: "center",
    }}
  >
    <Svg viewBox="0 0 33 40" width={size * 0.825} height={size} fill="none">
      <Path
        fill={color}
        d="M31.95 13.636c-.235.18-4.386 2.488-4.386 7.62 0 5.936 5.282 8.036 5.44 8.088-.024.128-.84 2.876-2.785 5.676-1.735 2.464-3.547 4.924-6.304 4.924s-3.466-1.58-6.649-1.58c-3.101 0-4.204 1.632-6.725 1.632-2.522 0-4.282-2.28-6.305-5.08C1.893 31.628 0 26.52 0 21.672c0-7.776 5.124-11.9 10.168-11.9 2.68 0 4.913 1.736 6.596 1.736 1.6 0 4.098-1.84 7.147-1.84 1.155 0 5.307.104 8.039 3.968Zm-9.486-7.26c1.26-1.476 2.152-3.524 2.152-5.572A3.79 3.79 0 0 0 24.54 0c-2.051.076-4.492 1.348-5.963 3.032-1.156 1.296-2.234 3.344-2.234 5.42 0 .312.053.624.077.724.13.024.34.052.551.052 1.84 0 4.156-1.216 5.494-2.852Z"
      />
    </Svg>
  </View>
);
