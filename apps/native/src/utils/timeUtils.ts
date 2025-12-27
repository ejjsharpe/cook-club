import { formatDuration, intervalToDuration } from "date-fns";

/**
 * Internal representation for TimePicker component
 */
export interface TimeValue {
  hours: number;
  minutes: number;
}

/**
 * Format minutes into a human-readable string
 * e.g., 15 -> "15 minutes", 60 -> "1 hour", 90 -> "1 hour 30 minutes"
 */
export function formatMinutes(minutes: number | null | undefined): string {
  if (!minutes || minutes <= 0) {
    return "";
  }

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  return formatDuration(
    { hours, minutes: mins },
    {
      format:
        hours > 0 && mins > 0
          ? ["hours", "minutes"]
          : hours > 0
            ? ["hours"]
            : ["minutes"],
      delimiter: " ",
    },
  );
}

/**
 * Get total minutes from TimeValue
 */
export function getTotalMinutes(time: TimeValue): number {
  return time.hours * 60 + time.minutes;
}

/**
 * Create TimeValue from total minutes
 */
export function fromTotalMinutes(totalMinutes: number): TimeValue {
  const duration = intervalToDuration({
    start: 0,
    end: totalMinutes * 60 * 1000,
  });

  return {
    hours: duration.hours || 0,
    minutes: duration.minutes || 0,
  };
}
