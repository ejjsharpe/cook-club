import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

export const VSpace = ({ size }: { size: number }) => {
  return <View style={[styles.vspace, { height: size }]} />;
};

export const HSpace = ({ size }: { size: number }) => {
  return <View style={[styles.hspace, { width: size }]} />;
};

const styles = StyleSheet.create({
  vspace: {
    width: '100%',
  },
  hspace: {
    height: '100%',
  },
});
