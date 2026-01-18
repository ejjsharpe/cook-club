import { LinearGradient } from "expo-linear-gradient";
import { View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { Text } from "@/components/Text";

interface DayHeaderProps {
  date: Date;
  isToday?: boolean;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export const DayHeader = ({ date, isToday = false }: DayHeaderProps) => {
  const { theme } = useUnistyles();
  const dayName = DAY_NAMES[date.getDay()];
  const monthName = MONTH_NAMES[date.getMonth()];
  const dayNumber = date.getDate();

  return (
    <LinearGradient
      colors={[theme.colors.background, `${theme.colors.background}00`]}
      style={styles.container}
    >
      <View style={styles.content}>
        <View style={styles.dateContainer}>
          <Text type="title2" style={isToday ? styles.todayText : undefined}>
            {dayName}
          </Text>
          <Text type="callout" style={styles.fullDate}>
            {monthName} {dayNumber}
          </Text>
        </View>
        {isToday && (
          <View style={styles.todayBadge}>
            <Text type="footnote" style={styles.todayBadgeText}>
              Today
            </Text>
          </View>
        )}
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create((theme) => ({
  container: {
    paddingTop: 16,
    paddingBottom: 16,
    paddingHorizontal: 20,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dateContainer: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 10,
  },
  fullDate: {
    color: theme.colors.textSecondary,
  },
  todayText: {
    color: theme.colors.primary,
  },
  todayBadge: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: theme.borderRadius.full,
  },
  todayBadgeText: {
    color: "#fff",
    fontWeight: "600",
  },
}));
