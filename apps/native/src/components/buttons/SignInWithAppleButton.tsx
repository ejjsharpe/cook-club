import { View } from "react-native";
import { StyleSheet, UnistylesRuntime } from "react-native-unistyles";

import { BaseButton } from "./BaseButton";
import { Text } from "../Text";
import { AppleLogo } from "../svg/AppleLogo";

import { useSignInWithSocial } from "@/api/auth";

export const SignInWithAppleButton = () => {
  const { colors } = UnistylesRuntime.getTheme();
  const { mutate: signInWithSocial } = useSignInWithSocial();
  const onPress = () => signInWithSocial({ provider: "apple" });

  return (
    <BaseButton style={styles.container} onPress={onPress}>
      <View style={styles.content}>
        <AppleLogo size={20} color={colors.buttonText} />
        <Text style={styles.text}>Sign in with Apple</Text>
      </View>
    </BaseButton>
  );
};

const styles = StyleSheet.create((theme) => ({
  container: {
    backgroundColor: "#000000",
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
    fontFamily: theme.fonts.albertSemiBold,
    color: "#FFFFFF",
  },
}));
