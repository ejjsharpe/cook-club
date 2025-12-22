import { StyleSheet } from "react-native-unistyles";

import { BaseButton } from "./BaseButton";
import { Text } from "../Text";
import { GoogleLogo } from "../svg/GoogleLogo";

import { useSignInWithSocial } from "@/api/auth";

export function SignInWithGoogleButton() {
  const { mutate: signInWithSocial } = useSignInWithSocial();
  const onPress = () => {
    signInWithSocial({ provider: "google" });
  };

  return (
    <BaseButton onPress={onPress} style={styles.container}>
      <GoogleLogo style={styles.logo} />
      <Text>Sign in with Google</Text>
    </BaseButton>
  );
}

const styles = StyleSheet.create((theme) => ({
  container: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: theme.colors.border,
    width: "100%",
    borderRadius: theme.borderRadius.medium,
    paddingVertical: 13,
    justifyContent: "center",
    alignItems: "center",
  },
  logo: {
    position: "absolute",
    left: 12,
  },
}));
