import { View } from "react-native";
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
      <View style={styles.content}>
        <GoogleLogo size={20} />
        <Text style={styles.text}>Sign in with Google</Text>
      </View>
    </BaseButton>
  );
}

const styles = StyleSheet.create((theme) => ({
  container: {
    backgroundColor: theme.colors.inputBackground,
    width: "100%",
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  text: {
    fontSize: 17,
    fontFamily: theme.fonts.semiBold,
    color: theme.colors.text,
  },
}));
