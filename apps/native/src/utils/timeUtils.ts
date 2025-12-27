import { intervalToDuration, formatDuration } from "date-fns";

export interface TimeValue {
  hours: number;
  minutes: number;
}

/**
 * Parse various duration formats into hours and minutes
 */
export function parseDuration(duration: string): TimeValue {
  if (!duration || typeof duration !== "string") {
    return { hours: 0, minutes: 0 };
  }

  // Handle simple formats like "10 mins", "1 hour", "30 minutes"
  const simplePatterns = [
    {
      pattern: /^(\d+)\s*h(?:ours?)?(?:\s+(\d+)\s*m(?:ins?|inutes?)?)?$/i,
      hours: 1,
      minutes: 2,
    },
    { pattern: /^(\d+)\s*m(?:ins?|inutes?)$/i, hours: 0, minutes: 1 },
    { pattern: /^(\d+)\s+hours?$/i, hours: 1, minutes: 0 },
    { pattern: /^(\d+)\s+minutes?$/i, hours: 0, minutes: 1 },
  ];

  for (const { pattern, hours: hIndex, minutes: mIndex } of simplePatterns) {
    const match = duration.match(pattern);
    if (match) {
      const hours =
        hIndex > 0 && match[hIndex] ? parseInt(match[hIndex], 10) || 0 : 0;
      const minutes =
        mIndex > 0 && match[mIndex] ? parseInt(match[mIndex], 10) || 0 : 0;
      return { hours, minutes };
    }
  }

  // Handle ISO 8601 duration format (PT10M, PT1H30M, PT2H)
  if (duration.startsWith("PT")) {
    const iso8601Pattern = /^PT(?:(\d+)H)?(?:(\d+)M)?$/i;
    const match = duration.match(iso8601Pattern);

    if (match) {
      const hours = match[1] ? parseInt(match[1], 10) || 0 : 0;
      const minutes = match[2] ? parseInt(match[2], 10) || 0 : 0;
      return { hours, minutes };
    }
  }

  // Handle formats like "1:30", "0:45"
  const colonPattern = /^(\d+):(\d+)$/;
  const colonMatch = duration.match(colonPattern);
  if (colonMatch && colonMatch[1] && colonMatch[2]) {
    const hours = parseInt(colonMatch[1]) || 0;
    const minutes = parseInt(colonMatch[2]) || 0;
    return { hours, minutes };
  }

  // Fallback: try to extract just numbers
  const numberMatch = duration.match(/(\d+)/);
  if (numberMatch && numberMatch[1]) {
    const value = parseInt(numberMatch[1]);
    if (value < 60) {
      return { hours: 0, minutes: value };
    } else {
      // Convert minutes to hours and minutes
      const hours = Math.floor(value / 60);
      const minutes = value % 60;
      return { hours, minutes };
    }
  }

  return { hours: 0, minutes: 0 };
}

/**
 * Format time value into a human-readable string using date-fns
 */
export function formatTime(time: TimeValue): string {
  const { hours, minutes } = time;

  if (hours === 0 && minutes === 0) {
    return "";
  }

  // Create a duration object for date-fns
  const duration = { hours, minutes };

  // Use date-fns formatDuration with custom format
  return formatDuration(duration, {
    format:
      hours > 0 && minutes > 0
        ? ["hours", "minutes"]
        : hours > 0
          ? ["hours"]
          : ["minutes"],
    delimiter: " ",
  });
}

/**
 * Format time value into ISO 8601 duration string
 */
export function formatDurationISO(time: TimeValue): string {
  const { hours, minutes } = time;

  if (hours === 0 && minutes === 0) {
    return "";
  }

  let result = "PT";
  if (hours > 0) {
    result += `${hours}H`;
  }
  if (minutes > 0) {
    result += `${minutes}M`;
  }

  return result;
}

/**
 * Get total minutes from time value
 */
export function getTotalMinutes(time: TimeValue): number {
  return time.hours * 60 + time.minutes;
}

/**
 * Create time value from total minutes using date-fns
 */
export function fromTotalMinutes(totalMinutes: number): TimeValue {
  // Use date-fns to create duration from milliseconds
  const duration = intervalToDuration({
    start: 0,
    end: totalMinutes * 60 * 1000, // Convert minutes to milliseconds
  });

  return {
    hours: duration.hours || 0,
    minutes: duration.minutes || 0,
  };
}
