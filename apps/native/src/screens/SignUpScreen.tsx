import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useState } from "react";
import {
  Platform,
  ScrollView,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet } from "react-native-unistyles";

import { useSignInWithEmail, useSignInWithSocial } from "@/api/auth";
import { Input } from "@/components/Input";
import { VSpace } from "@/components/Space";
import { Text } from "@/components/Text";
import { BackButton } from "@/components/buttons/BackButton";
import { BaseButton } from "@/components/buttons/BaseButton";
import { PrimaryButton } from "@/components/buttons/PrimaryButton";
import { SignInWithAppleButton } from "@/components/buttons/SignInWithAppleButton";
import { SignInWithGoogleButton } from "@/components/buttons/SignInWithGoogleButton";

export default function SignUpScreen() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const { mutate: signInWithEmail } = useSignInWithEmail();
  const onPressSignInWithEmail = () => signInWithEmail({ email, password });

  const { navigate } =
    useNavigation<NativeStackNavigationProp<ReactNavigation.RootParamList>>();
  const onPressSignUp = () => navigate("Sign In");

  return (
    <View style={styles.screenContainer}>
      <SafeAreaView style={styles.safeArea}>
        <VSpace size={32} />
        <Text type="title1">Sign up</Text>
        <VSpace size={12} />
        <Text style={styles.textAlignCenter} type="bodyFaded">
          Sign up now to find your next favourite meal.
        </Text>
        <VSpace size={32} />
        <Input
          label="Name"
          autoComplete="cc-name"
          onChangeText={setName}
          placeholder="Gordon Ramsey"
        />
        <VSpace size={12} />
        <Input
          label="Email"
          autoComplete="email"
          onChangeText={setEmail}
          placeholder="gordon@superchef.com"
        />
        <VSpace size={12} />
        <Input
          label="Password"
          autoComplete="new-password"
          onChangeText={setPassword}
          placeholder="••••••••••••"
        />
        <VSpace size={12} />
        <PrimaryButton onPress={onPressSignInWithEmail}>Sign up</PrimaryButton>
        <VSpace size={12} />
        <Text type="bodyFaded" style={styles.textAlignCenter}>
          or
        </Text>
        <VSpace size={12} />
        {Platform.OS === "ios" && <SignInWithAppleButton />}
        <VSpace size={12} />
        <SignInWithGoogleButton />
        <VSpace size={32} />
        <BaseButton onPress={onPressSignUp}>
          <Text>
            Already have an account? <Text type="highlight">Sign in</Text>
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
    alignItems: "center",
    width: "100%",
  },
  textAlignCenter: {
    textAlign: "center",
  },
}));
