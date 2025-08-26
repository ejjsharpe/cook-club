import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Platform, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';

import { useSignInWithEmail } from '@/api/auth';
import { Input } from '@/components/Input';
import { VSpace } from '@/components/Space';
import { Text } from '@/components/Text';
import { BaseButton } from '@/components/buttons/BaseButton';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SignInWithAppleButton } from '@/components/buttons/SignInWithAppleButton';
import { SignInWithGoogleButton } from '@/components/buttons/SignInWithGoogleButton';

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { mutate: signInWithEmail } = useSignInWithEmail();
  const onPressSignInWithEmail = () => signInWithEmail({ email, password });

  const { popTo } = useNavigation<NativeStackNavigationProp<ReactNavigation.RootParamList>>();
  const onPressSignUp = () => popTo('Sign Up');

  return (
    <View style={styles.screenContainer}>
      <SafeAreaView style={styles.safeArea}>
        <VSpace size={32} />
        <Text type="title1">Sign in</Text>
        <VSpace size={12} />
        <Text style={styles.textAlignCenter} type="bodyFaded">
          Lets get cooking! Your next meal is only minutes away...
        </Text>
        <VSpace size={32} />
        <Input label="Email" onChangeText={setEmail} placeholder="gordon@superchef.com" />
        <VSpace size={12} />
        <Input label="Password" onChangeText={setPassword} placeholder="••••••••••••" />
        <VSpace size={12} />
        <PrimaryButton onPress={onPressSignInWithEmail}>Sign in </PrimaryButton>
        <VSpace size={12} />
        <Text type="bodyFaded" style={styles.textAlignCenter}>
          or
        </Text>
        <VSpace size={12} />
        {Platform.OS === 'ios' && <SignInWithAppleButton />}
        <VSpace size={12} />
        <SignInWithGoogleButton />
        <VSpace size={32} />
        <BaseButton onPress={onPressSignUp}>
          <Text>
            Don't have an account yet? <Text type="highlight">Sign up</Text>
          </Text>
        </BaseButton>
        <VSpace size={12} />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  screenContainer: {
    flex: 1,
    paddingHorizontal: 24,
  },
  safeArea: {
    alignItems: 'center',
    width: '100%',
  },
  textAlignCenter: {
    textAlign: 'center',
  },
}));
