import { useState } from "react";
import { Platform, View } from "react-native";
import ActionSheet, {
  SheetManager,
  registerSheet,
  SheetDefinition,
  SheetProps,
} from "react-native-actions-sheet";
import { StyleSheet } from "react-native-unistyles";

import { useSignUpWithEmail } from "@/api/auth";
import { Input } from "@/components/Input";
import { VSpace } from "@/components/Space";
import { Text } from "@/components/Text";
import { BaseButton } from "@/components/buttons/BaseButton";
import { PrimaryButton } from "@/components/buttons/PrimaryButton";
import { SignInWithAppleButton } from "@/components/buttons/SignInWithAppleButton";
import { SignInWithGoogleButton } from "@/components/buttons/SignInWithGoogleButton";

declare module "react-native-actions-sheet" {
  interface Sheets {
    "sign-up-sheet": SheetDefinition;
  }
}

const SignUpSheet = (props: SheetProps<"sign-up-sheet">) => {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const { mutate: signUpWithEmail } = useSignUpWithEmail();

  const onPressSignUpWithEmail = () =>
    signUpWithEmail({ email, password, name });

  const onPressSignIn = () => {
    SheetManager.hide("sign-up-sheet");
    setTimeout(() => {
      SheetManager.show("sign-in-sheet");
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
        <PrimaryButton onPress={onPressSignUpWithEmail}>Sign up</PrimaryButton>
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
        <VSpace size={24} />
      </View>
    </ActionSheet>
  );
};

registerSheet("sign-up-sheet", SignUpSheet);

export { SignUpSheet };

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
