import {
  TrueSheet,
  type TrueSheetProps,
} from "@lodev09/react-native-true-sheet";
import { forwardRef, type ReactNode, useCallback, useRef } from "react";
import { TouchableOpacity, View } from "react-native";
import { StyleSheet, UnistylesRuntime } from "react-native-unistyles";

import { Text } from "./Text";

import { Ionicons } from "@/components/Ionicons";

export interface AppSheetProps
  extends Omit<TrueSheetProps, "children" | "header"> {
  title: string;
  subtitle?: string | null;
  children: ReactNode;
  closeDisabled?: boolean;
  leading?: ReactNode;
  headerContent?: TrueSheetProps["header"];
  onClosePress?: () => void;
}

export const AppSheet = forwardRef<TrueSheet, AppSheetProps>(
  (
    {
      title,
      subtitle,
      children,
      closeDisabled,
      leading,
      headerContent,
      onClosePress,
      grabber = false,
      backgroundColor,
      ...sheetProps
    },
    ref,
  ) => {
    const theme = UnistylesRuntime.getTheme();
    const sheetRef = useRef<TrueSheet | null>(null);

    const setRefs = useCallback(
      (node: TrueSheet | null) => {
        sheetRef.current = node;

        if (typeof ref === "function") {
          ref(node);
        } else if (ref) {
          ref.current = node;
        }
      },
      [ref],
    );

    const handleClose = () => {
      if (closeDisabled) return;
      onClosePress?.();
      sheetRef.current?.dismiss();
    };

    const defaultHeader = (
      <View style={styles.header}>
        <View style={styles.headerSide}>{leading}</View>
        <View style={styles.headerCenter}>
          <View style={styles.titleRow}>
            <Text type="headline" numberOfLines={1} style={styles.headerTitle}>
              {title}
            </Text>
          </View>
          {subtitle ? (
            <View style={styles.subtitleRow}>
              <Text
                type="caption"
                style={styles.headerSubtitle}
                numberOfLines={1}
              >
                {subtitle}
              </Text>
            </View>
          ) : null}
        </View>
        <TouchableOpacity
          onPress={handleClose}
          disabled={closeDisabled}
          style={styles.closeButton}
        >
          <View style={styles.closeButtonCircle}>
            <Ionicons name="close" size={16} style={styles.closeIcon} />
          </View>
        </TouchableOpacity>
      </View>
    );

    return (
      <TrueSheet
        ref={setRefs}
        grabber={grabber}
        backgroundColor={backgroundColor ?? theme.colors.background}
        header={headerContent ?? defaultHeader}
        {...sheetProps}
      >
        {children}
      </TrueSheet>
    );
  },
);

const styles = StyleSheet.create((theme) => ({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerSide: {
    width: 30,
    height: 38,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 8,
  },
  titleRow: {
    height: 38,
    justifyContent: "center",
  },
  headerTitle: {
    textAlign: "center",
  },
  subtitleRow: {
    minHeight: 16,
    justifyContent: "center",
  },
  headerSubtitle: {
    color: theme.colors.textSecondary,
    textAlign: "center",
  },
  closeButton: {
    padding: 4,
  },
  closeButtonCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: theme.colors.inputBackground,
    justifyContent: "center",
    alignItems: "center",
  },
  closeIcon: {
    color: theme.colors.textSecondary,
  },
}));
