import * as React from 'react';
import Svg, { Path } from 'react-native-svg';

export const OpenBookIcon = ({
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
      d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2V3ZM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7V3Z"
    />
  </Svg>
);
