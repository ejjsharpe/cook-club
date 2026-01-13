import { View } from "react-native";
import { StyleSheet } from "react-native-unistyles";

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
  const dayName = DAY_NAMES[date.getDay()];
  const monthName = MONTH_NAMES[date.getMonth()];
  const dayNumber = date.getDate();

  return (
    <View style={styles.container}>
      <View style={styles.dateContainer}>
        <Text type="headline" style={isToday ? styles.todayText : undefined}>
          {dayName}
        </Text>
        <Text type="subheadline" style={styles.fullDate}>
          {monthName} {dayNumber}
        </Text>
      </View>
      {isToday && (
        <View style={styles.todayBadge}>
          <Text type="caption" style={styles.todayBadgeText}>
            Today
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create((theme) => ({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: theme.colors.background,
  },
  dateContainer: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
  },
  fullDate: {
    color: theme.colors.textSecondary,
  },
  todayText: {
    color: theme.colors.primary,
  },
  todayBadge: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.full,
  },
  todayBadgeText: {
    color: "#fff",
    fontWeight: "600",
  },
}));
