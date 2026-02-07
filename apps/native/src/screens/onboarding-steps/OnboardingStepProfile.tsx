import * as ImagePicker from "expo-image-picker";
import {
  View,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
} from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { StyleSheet } from "react-native-unistyles";

import { Input } from "@/components/Input";
import { VSpace } from "@/components/Space";
import { Text } from "@/components/Text";

interface Props {
  name: string;
  setName: (name: string) => void;
  bio: string;
  setBio: (bio: string) => void;
  profileImage: string | null;
  setProfileImage: (image: string | null) => void;
  existingName?: string;
  existingImage?: string | null;
  username: string;
  setUsername: (username: string) => void;
  isUsernameAvailable: boolean | undefined;
  isCheckingUsername: boolean;
  usernameError: string | null;
  hasAttemptedSubmit: boolean;
}

export const OnboardingStepProfile = ({
  name,
  setName,
  bio,
  setBio,
  profileImage,
  setProfileImage,
  existingName = "",
  existingImage = null,
  username,
  setUsername,
  isUsernameAvailable,
  isCheckingUsername,
  usernameError,
  hasAttemptedSubmit,
}: Props) => {
  const handlePickImage = async () => {
    const permissionResult =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert(
        "Permission Required",
        "Please allow access to your photos to set a profile picture.",
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setProfileImage(result.assets[0].uri);
    }
  };

  const handleUsernameChange = (text: string) => {
    // Auto-lowercase and strip invalid chars
    const cleaned = text.toLowerCase().replace(/[^a-z0-9_]/g, "");
    setUsername(cleaned);
  };

  const displayImage = profileImage || existingImage;
  const displayInitial = (name || existingName || "?").charAt(0).toUpperCase();

  const showUsernameStatus = username.length >= 3;

  return (
    <View style={styles.container}>
      <Text type="largeTitle" style={styles.title}>
        Welcome to Cook Club!
      </Text>
      <VSpace size={12} />
      <Text type="bodyFaded" style={styles.subtitle}>
        Let's set up your profile
      </Text>
      <VSpace size={32} />

      {/* Profile Photo */}
      <View style={styles.centered}>
        <TouchableOpacity onPress={handlePickImage} activeOpacity={0.7}>
          <View style={styles.avatarContainer}>
            {displayImage ? (
              <Image source={{ uri: displayImage }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text type="title1" style={styles.avatarText}>
                  {displayInitial}
                </Text>
              </View>
            )}
            <View style={styles.editBadge}>
              <Text style={styles.editBadgeText}>Edit</Text>
            </View>
          </View>
        </TouchableOpacity>
        <VSpace size={8} />
        <Text type="caption" style={styles.photoHint}>
          Tap to add photo (optional)
        </Text>
      </View>

      <VSpace size={32} />

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
        {hasAttemptedSubmit && username.length < 3 && (
          <Animated.View
            entering={FadeIn.duration(200)}
            exiting={FadeOut.duration(150)}
            style={styles.fieldHint}
          >
            <Text style={styles.usernameUnavailable}>
              Must be at least 3 characters
            </Text>
          </Animated.View>
        )}
        {showUsernameStatus && (
          <View style={styles.usernameStatus}>
            {isCheckingUsername ? (
              <ActivityIndicator size="small" />
            ) : isUsernameAvailable ? (
              <Text style={styles.usernameAvailable}>Available</Text>
            ) : (
              <Text style={styles.usernameUnavailable}>
                {usernameError ?? "Unavailable"}
              </Text>
            )}
          </View>
        )}
      </View>

      <VSpace size={16} />

      <View>
        <Input
          label="Display name"
          value={name}
          onChangeText={setName}
          placeholder="Enter your name"
          autoCapitalize="words"
        />
        {hasAttemptedSubmit && name.trim().length === 0 && (
          <Animated.View
            entering={FadeIn.duration(200)}
            exiting={FadeOut.duration(150)}
            style={styles.fieldHint}
          >
            <Text style={styles.usernameUnavailable}>Required</Text>
          </Animated.View>
        )}
      </View>

      <VSpace size={16} />

      <Input
        label="Bio (optional)"
        value={bio}
        onChangeText={setBio}
        placeholder="Tell us about yourself"
        multiline
        numberOfLines={3}
        style={styles.bioInput}
      />
    </View>
  );
};

const styles = StyleSheet.create((theme) => ({
  container: {
    flex: 1,
  },
  title: {
    textAlign: "center",
  },
  subtitle: {
    textAlign: "center",
  },
  centered: {
    alignItems: "center",
  },
  avatarContainer: {
    position: "relative",
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: theme.colors.primary + "20",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: theme.colors.primary,
    fontSize: 48,
  },
  editBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
  },
  editBadgeText: {
    color: theme.colors.buttonText,
    fontSize: 12,
    fontFamily: theme.fonts.semiBold,
  },
  photoHint: {
    textAlign: "center",
  },
  usernameStatus: {
    marginTop: 6,
    marginLeft: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  usernameAvailable: {
    color: "#34C759",
    fontSize: 13,
    fontFamily: theme.fonts.medium,
  },
  usernameUnavailable: {
    color: theme.colors.destructive,
    fontSize: 13,
    fontFamily: theme.fonts.medium,
  },
  fieldHint: {
    marginTop: 6,
    marginLeft: 16,
  },
  bioInput: {
    height: 80,
    textAlignVertical: "top",
    paddingTop: 12,
  },
}));
