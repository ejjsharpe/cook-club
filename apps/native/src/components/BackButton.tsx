import { useNavigation } from '@react-navigation/native';
import { TouchableOpacity } from 'react-native';

import { BackIcon } from './svg/BackIcon';

export const BackButton = ({ color = 'white' }) => {
  const { goBack } = useNavigation();
  return (
    <TouchableOpacity onPress={goBack}>
      <BackIcon stroke={color} />
    </TouchableOpacity>
  );
};
