import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { useState } from "react";
import { View, Alert } from "react-native";
import { StyleSheet } from "react-native-unistyles";

import { SafeAreaView } from "@/components/SafeAreaView";
import { VSpace } from "@/components/Space";
import { Text } from "@/components/Text";
import { BaseButton } from "@/components/buttons/BaseButton";
import { PrimaryButton } from "@/components/buttons/PrimaryButton";
import { authClient } from "@/lib/authClient";

type EmailVerificationParams = {
  EmailVerification: {
    email: string;
  };
};

export const EmailVerificationScreen = () => {
  const navigation = useNavigation();
  const route = useRoute<EmailVerificationParams>("EmailVerification");
  const { email } = route.params;
  const [isResending, setIsResending] = useState(false);

  const handleResend = async () => {
    setIsResending(true);
    try {
      const result = await authClient.sendVerificationEmail({
        email,
        callbackURL: "cookclub://",
      });
      if (result.error) {
        Alert.alert(
          "Error",
          result.error.message ?? "Failed to resend verification email.",
        );
      } else {
        Alert.alert("Sent", "A new verification email has been sent.");
      }
    } catch {
      Alert.alert(
        "Error",
        "Failed to resend verification email. Please try again.",
      );
    } finally {
      setIsResending(false);
    }
  };

  const handleBackToSignIn = () => {
    navigation.goBack();
  };

  return (
    <SafeAreaView edges={["top", "bottom"]} style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons name="mail-outline" size={64} style={styles.icon} />
        </View>

        <VSpace size={24} />

        <Text type="title1" style={styles.title}>
          Check your email
        </Text>

        <VSpace size={12} />

        <Text type="bodyFaded" style={styles.subtitle}>
          We sent a verification link to
        </Text>
        <Text type="headline" style={styles.email}>
          {email}
        </Text>

        <VSpace size={8} />

        <Text type="bodyFaded" style={styles.subtitle}>
          Click the link in your email to verify your account and get started.
        </Text>

        <VSpace size={32} />

        <PrimaryButton onPress={handleResend} disabled={isResending}>
          {isResending ? "Sending..." : "Resend verification email"}
        </PrimaryButton>

        <VSpace size={16} />

        <BaseButton onPress={handleBackToSignIn}>
          <Text type="bodyFaded">Back to sign in</Text>
        </BaseButton>
      </View>
    </SafeAreaView>
  );
};
const styles = StyleSheet.create((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: theme.colors.primary + "20",
    justifyContent: "center",
    alignItems: "center",
  },
  icon: {
    color: theme.colors.primary,
  },
  title: {
    textAlign: "center",
  },
  subtitle: {
    textAlign: "center",
  },
  email: {
    textAlign: "center",
    marginTop: 4,
  },
}));
