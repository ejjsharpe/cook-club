import { useNavigation } from "@react-navigation/native";
import { useState, useEffect } from "react";
import { View, Alert, ActivityIndicator, ScrollView } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { StyleSheet, UnistylesRuntime } from "react-native-unistyles";

import { useUser, useUpdateProfile, useCheckUsername } from "@/api/user";
import { Input } from "@/components/Input";
import { NavigationHeader } from "@/components/NavigationHeader";
import { SafeAreaView } from "@/components/SafeAreaView";
import { VSpace } from "@/components/Space";
import { Text } from "@/components/Text";
import { PrimaryButton } from "@/components/buttons/PrimaryButton";
import { authClient } from "@/lib/authClient";

export const AccountScreen = () => {
  const navigation = useNavigation();
  const { data: currentUser } = useUser();
  const { mutateAsync: updateProfile, isPending: isUpdating } =
    useUpdateProfile();
  const insets = UnistylesRuntime.insets;

  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const { data: usernameCheck, isFetching: isCheckingUsername } =
    useCheckUsername(username);

  useEffect(() => {
    if (currentUser?.user) {
      setUsername(currentUser.user.username ?? "");
      setName(currentUser.user.name);
      setEmail(currentUser.user.email);
    }
  }, [currentUser?.user]);

  const originalUsername = currentUser?.user?.username ?? "";
  const originalName = currentUser?.user?.name ?? "";
  const originalEmail = currentUser?.user?.email ?? "";

  const usernameChanged = username !== originalUsername;
  const nameChanged = name !== originalName;
  const emailChanged = email !== originalEmail;
  const hasChanges = usernameChanged || nameChanged || emailChanged;

  const isUsernameValid =
    !usernameChanged ||
    (username.length >= 3 && usernameCheck?.available !== false);

  const handleUsernameChange = (text: string) => {
    const cleaned = text.toLowerCase().replace(/[^a-z0-9_]/g, "");
    setUsername(cleaned);
  };

  const showUsernameStatus = usernameChanged && username.length >= 3;

  const handleSave = async () => {
    if (!hasChanges) return;

    if (usernameChanged && !isUsernameValid) {
      Alert.alert(
        "Invalid Username",
        usernameCheck?.reason ?? "Please choose a valid username.",
      );
      return;
    }

    if (nameChanged && name.trim().length === 0) {
      Alert.alert("Invalid Name", "Display name cannot be empty.");
      return;
    }

    setIsSaving(true);
    try {
      // Update username and/or name via tRPC
      if (usernameChanged || nameChanged) {
        await updateProfile({
          ...(usernameChanged && { username }),
          ...(nameChanged && { name: name.trim() }),
        });
      }

      // Change email via Better Auth
      if (emailChanged) {
        await authClient.changeEmail({ newEmail: email });
        Alert.alert(
          "Verification Sent",
          "A verification email has been sent to your new address. Please check your inbox.",
          [{ text: "OK", onPress: () => navigation.goBack() }],
        );
        return;
      }

      navigation.goBack();
    } catch (error: any) {
      Alert.alert("Error", error?.message ?? "Failed to save changes.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={["top"]} style={styles.container}>
        <NavigationHeader title="Account" />

        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
          keyboardShouldPersistTaps="handled"
        >
          <VSpace size={24} />

          {/* Username */}
          <View>
            <Input
              label="Username"
              value={username}
              onChangeText={handleUsernameChange}
              placeholder="your_username"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {showUsernameStatus && (
              <View style={styles.fieldStatus}>
                {isCheckingUsername ? (
                  <ActivityIndicator size="small" />
                ) : usernameCheck?.available ? (
                  <Animated.View
                    entering={FadeIn.duration(200)}
                    exiting={FadeOut.duration(150)}
                  >
                    <Text style={styles.available}>Available</Text>
                  </Animated.View>
                ) : (
                  <Animated.View
                    entering={FadeIn.duration(200)}
                    exiting={FadeOut.duration(150)}
                  >
                    <Text style={styles.unavailable}>
                      {usernameCheck?.reason ?? "Unavailable"}
                    </Text>
                  </Animated.View>
                )}
              </View>
            )}
          </View>

          <VSpace size={16} />

          {/* Display Name */}
          <Input
            label="Display name"
            value={name}
            onChangeText={setName}
            placeholder="Enter your name"
            autoCapitalize="words"
          />

          <VSpace size={16} />

          {/* Email */}
          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="your@email.com"
            autoCapitalize="none"
            keyboardType="email-address"
          />
          {emailChanged && (
            <Animated.View
              entering={FadeIn.duration(200)}
              exiting={FadeOut.duration(150)}
              style={styles.fieldHint}
            >
              <Text type="caption" style={styles.hintText}>
                A verification email will be sent to your new address
              </Text>
            </Animated.View>
          )}

          <VSpace size={32} />

          <PrimaryButton
            onPress={handleSave}
            disabled={
              !hasChanges ||
              isSaving ||
              isUpdating ||
              (usernameChanged && !isUsernameValid)
            }
          >
            {isSaving || isUpdating ? "Saving..." : "Save Changes"}
          </PrimaryButton>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create((theme) => ({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  fieldStatus: {
    marginTop: 6,
    marginLeft: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  available: {
    color: "#34C759",
    fontSize: 13,
    fontFamily: theme.fonts.medium,
  },
  unavailable: {
    color: theme.colors.destructive,
    fontSize: 13,
    fontFamily: theme.fonts.medium,
  },
  fieldHint: {
    marginTop: 6,
    marginLeft: 16,
  },
  hintText: {
    color: theme.colors.textSecondary,
  },
}));
