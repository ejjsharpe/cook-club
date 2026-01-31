import { TrueSheet } from "@lodev09/react-native-true-sheet";
import { forwardRef, useState, useImperativeHandle, useRef } from "react";
import { Platform, View } from "react-native";
import { StyleSheet, UnistylesRuntime } from "react-native-unistyles";

import { useSignInWithEmail } from "@/api/auth";
import { Input } from "@/components/Input";
import { VSpace } from "@/components/Space";
import { Text } from "@/components/Text";
import { BaseButton } from "@/components/buttons/BaseButton";
import { PrimaryButton } from "@/components/buttons/PrimaryButton";
import { SignInWithAppleButton } from "@/components/buttons/SignInWithAppleButton";
import { SignInWithGoogleButton } from "@/components/buttons/SignInWithGoogleButton";

export interface SignInSheetProps {
  onSwitchToSignUp?: () => void;
}

export interface SignInSheetRef {
  present: () => void;
  dismiss: () => Promise<void>;
}

export const SignInSheet = forwardRef<SignInSheetRef, SignInSheetProps>(
  ({ onSwitchToSignUp }, ref) => {
    const theme = UnistylesRuntime.getTheme();
    const sheetRef = useRef<TrueSheet>(null);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const { mutate: signInWithEmail } = useSignInWithEmail();

    useImperativeHandle(ref, () => ({
      present: () => sheetRef.current?.present(),
      dismiss: () => sheetRef.current?.dismiss() ?? Promise.resolve(),
    }));

    const onPressSignInWithEmail = () => signInWithEmail({ email, password });

    const onPressSignUp = async () => {
      await sheetRef.current?.dismiss();
      onSwitchToSignUp?.();
    };

    return (
      <TrueSheet
        ref={sheetRef}
        detents={["auto"]}
        grabber={false}
        backgroundColor={theme.colors.background}
      >
        <View style={styles.content}>
          <VSpace size={24} />
          <Text type="title1">Sign in</Text>
          <VSpace size={12} />
          <Text style={styles.textAlignCenter} type="bodyFaded">
            Lets get cooking! Your next meal is only minutes away...
          </Text>
          <VSpace size={32} />
          <Input
            label="Email"
            onChangeText={setEmail}
            placeholder="gordon@superchef.com"
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />
          <VSpace size={12} />
          <Input
            label="Password"
            onChangeText={setPassword}
            placeholder="••••••••••••"
            secureTextEntry
            autoComplete="password"
          />
          <VSpace size={12} />
          <PrimaryButton onPress={onPressSignInWithEmail}>
            Sign in
          </PrimaryButton>
          <VSpace size={12} />
          <Text type="bodyFaded" style={styles.textAlignCenter}>
            or
          </Text>
          <VSpace size={12} />
          {Platform.OS === "ios" && <SignInWithAppleButton />}
          {Platform.OS === "ios" && <VSpace size={12} />}
          <SignInWithGoogleButton />
          <VSpace size={32} />
          <BaseButton onPress={onPressSignUp}>
            <Text>
              Don't have an account yet? <Text type="highlight">Sign up</Text>
            </Text>
          </BaseButton>
        </View>
      </TrueSheet>
    );
  },
);

const styles = StyleSheet.create(() => ({
  content: {
    paddingHorizontal: 24,
    alignItems: "center",
  },
  textAlignCenter: {
    textAlign: "center",
  },
}));
