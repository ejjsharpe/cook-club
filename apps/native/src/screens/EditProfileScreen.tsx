import { useState } from "react";
import { View, Image, TouchableOpacity, Alert } from "react-native";
import { SafeAreaView } from "@/components/SafeAreaView";
import { StyleSheet } from "react-native-unistyles";

import { useUser } from "@/api/user";
import { Input } from "@/components/Input";
import { VSpace } from "@/components/Space";
import { Text } from "@/components/Text";
import { BackButton } from "@/components/buttons/BackButton";
import { PrimaryButton } from "@/components/buttons/PrimaryButton";

export const EditProfileScreen = () => {
  const { data: currentUser } = useUser();

  const [name, setName] = useState(currentUser?.user?.name ?? "");

  const handleSave = () => {
    // TODO: Implement profile update mutation when backend endpoint is available
    Alert.alert(
      "Coming Soon",
      "Profile editing will be available in a future update.",
    );
  };

  const handlePickImage = () => {
    // TODO: Implement image picker when backend supports image upload
    Alert.alert(
      "Coming Soon",
      "Profile image editing will be available in a future update.",
    );
  };

  const userImage = currentUser?.user?.image;
  const userName = currentUser?.user?.name ?? "";

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.container}>
        <VSpace size={8} />
        <BackButton />

        <View style={styles.content}>
          <VSpace size={32} />

          <Text type="title1" style={styles.title}>
            Edit Profile
          </Text>

          <VSpace size={32} />

          {/* Avatar with edit overlay */}
          <TouchableOpacity onPress={handlePickImage} activeOpacity={0.7}>
            <View style={styles.avatarContainer}>
              {userImage ? (
                <Image source={{ uri: userImage }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text type="largeTitle" style={styles.avatarText}>
                    {userName.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={styles.editOverlay}>
                <Text style={styles.editOverlayText}>Edit</Text>
              </View>
            </View>
          </TouchableOpacity>

          <VSpace size={32} />

          {/* Name input */}
          <View style={styles.inputContainer}>
            <Text type="body" style={styles.label}>
              Name
            </Text>
            <VSpace size={8} />
            <Input
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              autoCapitalize="words"
            />
          </View>

          <VSpace size={32} />

          <PrimaryButton onPress={handleSave}>Save Changes</PrimaryButton>
        </View>
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
    paddingHorizontal: 20,
  },
  content: {
    flex: 1,
    alignItems: "center",
  },
  title: {
    textAlign: "center",
  },
  avatarContainer: {
    position: "relative",
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: theme.colors.primary + "20",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: theme.colors.primary,
  },
  editOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    paddingVertical: 6,
    borderBottomLeftRadius: 50,
    borderBottomRightRadius: 50,
    alignItems: "center",
  },
  editOverlayText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  inputContainer: {
    width: "100%",
  },
  label: {
    fontWeight: "500",
  },
}));
