import * as React from 'react';
import Svg, { Path } from 'react-native-svg';

export const MagnifyingGlassIcon = ({
  color = '#000',
  size = 24,
  strokeWidth = 2,
}: {
  color?: string;
  size?: number;
  strokeWidth?: number;
}) => (
  <Svg width={size} height={size} fill="none">
    <Path
      stroke={color}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={strokeWidth}
      d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM21 21l-4.35-4.35"
    />
  </Svg>
);
