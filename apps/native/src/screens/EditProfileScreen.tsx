import { useNavigation } from "@react-navigation/native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useState, useEffect } from "react";
import { View, TouchableOpacity, Alert, ActivityIndicator } from "react-native";
import { StyleSheet } from "react-native-unistyles";

import { useUser, useUpdateProfile } from "@/api/user";
import { Input } from "@/components/Input";
import { SafeAreaView } from "@/components/SafeAreaView";
import { VSpace } from "@/components/Space";
import { Text } from "@/components/Text";
import { BackButton } from "@/components/buttons/BackButton";
import { PrimaryButton } from "@/components/buttons/PrimaryButton";
import { useAvatarUpload } from "@/hooks/useAvatarUpload";
import { getImageUrl } from "@/utils/imageUrl";

export const EditProfileScreen = () => {
  const navigation = useNavigation();
  const { data: currentUser } = useUser();
  const { mutateAsync: updateProfile, isPending: isUpdatingProfile } =
    useUpdateProfile();
  const {
    upload: uploadAvatar,
    isUploading: isUploadingAvatar,
    progress: uploadProgress,
  } = useAvatarUpload({
    onError: (error) => {
      Alert.alert("Upload Failed", error.message);
    },
  });

  const [name, setName] = useState("");
  const [localImage, setLocalImage] = useState<string | null>(null);

  // Initialize name from current user
  useEffect(() => {
    if (currentUser?.user?.name && !name) {
      setName(currentUser.user.name);
    }
  }, [currentUser?.user?.name]);

  const userImage = currentUser?.user?.image;
  const userName = currentUser?.user?.name ?? "";
  const isSaving = isUploadingAvatar || isUpdatingProfile;

  const hasChanges =
    localImage !== null || name !== (currentUser?.user?.name ?? "");

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setLocalImage(result.assets[0].uri);
    }
  };

  const handleSave = async () => {
    if (!hasChanges) {
      navigation.goBack();
      return;
    }

    try {
      // Upload avatar if changed
      if (localImage) {
        await uploadAvatar(localImage);
      }

      // Update name if changed
      if (name !== currentUser?.user?.name) {
        await updateProfile({ name });
      }

      navigation.goBack();
    } catch (error) {
      // Error is already handled in useAvatarUpload
      console.error("Failed to save profile:", error);
    }
  };

  // Determine which image to display
  const displayImage = localImage ?? getImageUrl(userImage, "avatar-lg");

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
          <TouchableOpacity
            onPress={handlePickImage}
            activeOpacity={0.7}
            disabled={isSaving}
          >
            <View style={styles.avatarContainer}>
              {displayImage ? (
                <Image source={{ uri: displayImage }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text type="largeTitle" style={styles.avatarText}>
                    {userName.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              {isUploadingAvatar ? (
                <View style={styles.uploadingOverlay}>
                  <ActivityIndicator size="small" color="#fff" />
                  <Text style={styles.uploadingText}>{uploadProgress}%</Text>
                </View>
              ) : (
                <View style={styles.editOverlay}>
                  <Text style={styles.editOverlayText}>Edit</Text>
                </View>
              )}
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
              editable={!isSaving}
            />
          </View>

          <VSpace size={32} />

          <PrimaryButton
            onPress={handleSave}
            disabled={isSaving || !hasChanges}
          >
            {isSaving ? "Saving..." : "Save Changes"}
          </PrimaryButton>
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
  uploadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
  },
  uploadingText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 4,
  },
  inputContainer: {
    width: "100%",
  },
  label: {
    fontWeight: "500",
  },
}));
