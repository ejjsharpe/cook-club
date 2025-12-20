import * as React from "react";
import { ViewStyle } from "react-native";
import Svg, { Path } from "react-native-svg";

export const GoogleLogo = ({
  size = 24,
  style,
}: {
  size?: number;
  style: ViewStyle;
}) => (
  <Svg width={size} height={size} fill="none" viewBox="0 0 40 40" style={style}>
    <Path
      fill="#4285F4"
      fillRule="evenodd"
      d="M39.2 20.455c0-1.419-.127-2.782-.364-4.091H20V24.1h10.764c-.464 2.5-1.873 4.618-3.991 6.036v5.019h6.463c3.782-3.482 5.964-8.61 5.964-14.7Z"
      clipRule="evenodd"
    />
    <Path
      fill="#34A853"
      fillRule="evenodd"
      d="M20 40c5.4 0 9.927-1.791 13.236-4.846l-6.463-5.018c-1.791 1.2-4.082 1.91-6.773 1.91-5.21 0-9.618-3.519-11.191-8.246H2.127v5.181C5.418 35.519 12.182 40 20 40Z"
      clipRule="evenodd"
    />
    <Path
      fill="#FBBC05"
      fillRule="evenodd"
      d="M8.81 23.8c-.4-1.2-.628-2.482-.628-3.8 0-1.318.227-2.6.627-3.8v-5.182H2.127A19.992 19.992 0 0 0 0 20c0 3.227.773 6.282 2.127 8.982L8.81 23.8Z"
      clipRule="evenodd"
    />
    <Path
      fill="#EA4335"
      fillRule="evenodd"
      d="M20 7.955c2.936 0 5.573 1.009 7.645 2.99l5.737-5.736C29.918 1.982 25.39 0 20 0 12.182 0 5.418 4.482 2.127 11.018L8.81 16.2c1.573-4.727 5.982-8.245 11.19-8.245Z"
      clipRule="evenodd"
    />
  </Svg>
);
