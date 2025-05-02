import { StyleSheet, UnistylesRuntime } from 'react-native-unistyles';

import { BaseButton } from './BaseButton';
import { Text } from '../Text';
import { AppleLogo } from '../svg/AppleLogo';

import { useSignInWithSocial } from '@/api/auth';

export const SignInWithAppleButton = () => {
  const { colors } = UnistylesRuntime.getTheme();
  const { mutate: signInWithSocial } = useSignInWithSocial();
  const onPress = () => signInWithSocial({ provider: 'apple' });

  return (
    <BaseButton style={styles.container} onPress={onPress}>
      <AppleLogo size={24} color={colors.buttonText} style={styles.logo} />
      <Text style={styles.text}> Sign in with Apple</Text>
    </BaseButton>
  );
};

const styles = StyleSheet.create((theme) => ({
  container: {
    backgroundColor: 'black',
    width: '100%',
    borderRadius: theme.borderRadius.medium,
    paddingVertical: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    color: theme.colors.background,
  },
  logo: {
    position: 'absolute',
    left: 12,
  },
}));
