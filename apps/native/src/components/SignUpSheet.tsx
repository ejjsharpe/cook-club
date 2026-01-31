import { TrueSheet } from "@lodev09/react-native-true-sheet";
import { forwardRef, useState, useImperativeHandle, useRef } from "react";
import { Platform, View } from "react-native";
import { StyleSheet, UnistylesRuntime } from "react-native-unistyles";

import { useSignUpWithEmail } from "@/api/auth";
import { Input } from "@/components/Input";
import { VSpace } from "@/components/Space";
import { Text } from "@/components/Text";
import { BaseButton } from "@/components/buttons/BaseButton";
import { PrimaryButton } from "@/components/buttons/PrimaryButton";
import { SignInWithAppleButton } from "@/components/buttons/SignInWithAppleButton";
import { SignInWithGoogleButton } from "@/components/buttons/SignInWithGoogleButton";

export interface SignUpSheetProps {
  onSwitchToSignIn?: () => void;
}

export interface SignUpSheetRef {
  present: () => void;
  dismiss: () => Promise<void>;
}

export const SignUpSheet = forwardRef<SignUpSheetRef, SignUpSheetProps>(
  ({ onSwitchToSignIn }, ref) => {
    const theme = UnistylesRuntime.getTheme();
    const sheetRef = useRef<TrueSheet>(null);
    const [email, setEmail] = useState("");
    const [name, setName] = useState("");
    const [password, setPassword] = useState("");
    const { mutate: signUpWithEmail } = useSignUpWithEmail();

    useImperativeHandle(ref, () => ({
      present: () => sheetRef.current?.present(),
      dismiss: () => sheetRef.current?.dismiss() ?? Promise.resolve(),
    }));

    const onPressSignUpWithEmail = () =>
      signUpWithEmail({ email, password, name });

    const onPressSignIn = async () => {
      await sheetRef.current?.dismiss();
      onSwitchToSignIn?.();
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
          <Text type="title1">Sign up</Text>
          <VSpace size={12} />
          <Text style={styles.textAlignCenter} type="bodyFaded">
            Sign up now to find your next favourite meal.
          </Text>
          <VSpace size={32} />
          <Input
            label="Name"
            autoComplete="name"
            onChangeText={setName}
            placeholder="Gordon Ramsey"
          />
          <VSpace size={12} />
          <Input
            label="Email"
            autoComplete="email"
            onChangeText={setEmail}
            placeholder="gordon@superchef.com"
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <VSpace size={12} />
          <Input
            label="Password"
            autoComplete="new-password"
            onChangeText={setPassword}
            placeholder="••••••••••••"
            secureTextEntry
          />
          <VSpace size={12} />
          <PrimaryButton onPress={onPressSignUpWithEmail}>
            Sign up
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
          <BaseButton onPress={onPressSignIn}>
            <Text>
              Already have an account? <Text type="highlight">Sign in</Text>
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
