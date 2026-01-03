import { Ionicons } from "@expo/vector-icons";
import { useEffect } from "react";
import { TouchableOpacity, Modal, Pressable, Dimensions } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { StyleSheet } from "react-native-unistyles";

import { Text } from "./Text";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export interface DropdownMenuItem {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  destructive?: boolean;
  onPress: () => void;
}

interface DropdownMenuProps {
  visible: boolean;
  onClose: () => void;
  items: DropdownMenuItem[];
  anchorPosition?: { top: number; right: number };
}

export const DropdownMenu = ({
  visible,
  onClose,
  items,
  anchorPosition = { top: 60, right: 20 },
}: DropdownMenuProps) => {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.9);
  const translateY = useSharedValue(-8);

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, {
        duration: 150,
        easing: Easing.out(Easing.ease),
      });
      scale.value = withTiming(1, {
        duration: 150,
        easing: Easing.out(Easing.ease),
      });
      translateY.value = withTiming(0, {
        duration: 150,
        easing: Easing.out(Easing.ease),
      });
    } else {
      opacity.value = withTiming(0, { duration: 100 });
      scale.value = withTiming(0.9, { duration: 100 });
      translateY.value = withTiming(-8, { duration: 100 });
    }
  }, [visible, opacity, scale, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }, { translateY: translateY.value }],
  }));

  const handleItemPress = (item: DropdownMenuItem) => {
    onClose();
    // Small delay to allow the menu to close before action
    setTimeout(() => {
      item.onPress();
    }, 100);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Animated.View
          style={[
            styles.menu,
            { top: anchorPosition.top, right: anchorPosition.right },
            animatedStyle,
          ]}
        >
          {items.map((item, index) => (
            <TouchableOpacity
              key={item.key}
              style={[
                styles.menuItem,
                index === items.length - 1 && styles.menuItemLast,
              ]}
              onPress={() => handleItemPress(item)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={item.icon}
                size={20}
                style={[
                  styles.menuIcon,
                  item.destructive && styles.destructive,
                ]}
              />
              <Text
                style={[
                  styles.menuLabel,
                  item.destructive && styles.destructive,
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </Animated.View>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create((theme) => ({
  backdrop: {
    flex: 1,
    backgroundColor: "transparent",
  },
  menu: {
    position: "absolute",
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.medium,
    minWidth: 200,
    maxWidth: SCREEN_WIDTH - 40,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  menuItemLast: {
    borderBottomWidth: 0,
  },
  menuIcon: {
    color: theme.colors.text,
    marginRight: 12,
  },
  menuLabel: {
    fontSize: 16,
    color: theme.colors.text,
  },
  destructive: {
    color: "#DC2626",
  },
}));
