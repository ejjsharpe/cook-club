import { useState } from "react";
import { Platform, View } from "react-native";
import ActionSheet, {
  SheetManager,
  registerSheet,
  SheetDefinition,
  SheetProps,
} from "react-native-actions-sheet";
import { StyleSheet } from "react-native-unistyles";

import { useSignInWithEmail } from "@/api/auth";
import { Input } from "@/components/Input";
import { VSpace } from "@/components/Space";
import { Text } from "@/components/Text";
import { BaseButton } from "@/components/buttons/BaseButton";
import { PrimaryButton } from "@/components/buttons/PrimaryButton";
import { SignInWithAppleButton } from "@/components/buttons/SignInWithAppleButton";
import { SignInWithGoogleButton } from "@/components/buttons/SignInWithGoogleButton";

declare module "react-native-actions-sheet" {
  interface Sheets {
    "sign-in-sheet": SheetDefinition;
  }
}

const SignInSheet = (props: SheetProps<"sign-in-sheet">) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { mutate: signInWithEmail } = useSignInWithEmail();

  const onPressSignInWithEmail = () => signInWithEmail({ email, password });

  const onPressSignUp = () => {
    SheetManager.hide("sign-in-sheet");
    setTimeout(() => {
      SheetManager.show("sign-up-sheet");
    }, 300);
  };

  return (
    <ActionSheet
      id={props.sheetId}
      gestureEnabled
      indicatorStyle={styles.indicator}
      containerStyle={styles.container}
    >
      <View style={styles.content}>
        <VSpace size={8} />
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
        <PrimaryButton onPress={onPressSignInWithEmail}>Sign in</PrimaryButton>
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
        <VSpace size={24} />
      </View>
    </ActionSheet>
  );
};

registerSheet("sign-in-sheet", SignInSheet);

export { SignInSheet };

const styles = StyleSheet.create((theme) => ({
  indicator: {
    backgroundColor: theme.colors.border,
  },
  container: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  content: {
    paddingHorizontal: 24,
    alignItems: "center",
  },
  textAlignCenter: {
    textAlign: "center",
  },
}));
