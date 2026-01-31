import { useCallback, useMemo, useRef, useState } from "react";

// Constants
const DATES_TO_LOAD = 14;

// Layout heights for FlashList item types
const DAY_HEADER_HEIGHT = 56;
const DAY_CONTENT_HEIGHT = 218; // 3 MealSlots (72px) + 2 separators (1px)
const DAY_FOOTER_HEIGHT = 16;

// FlashList item types
interface HeaderItem {
  type: "header";
  id: string;
  date: Date;
  dateString: string;
  isToday: boolean;
}

interface ContentItem {
  type: "content";
  id: string;
  date: Date;
  dateString: string;
  isToday: boolean;
}

interface FooterItem {
  type: "footer";
  id: string;
  dateString: string;
}

type MealPlanListItem = HeaderItem | ContentItem | FooterItem;

// Legacy type for backwards compatibility during migration
interface DaySection {
  date: Date;
  dateString: string;
  isToday: boolean;
  data: [{ date: Date; dateString: string; isToday: boolean }];
}

// Helper to format date as YYYY-MM-DD
const formatDateString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

// Helper to check if two dates are the same day
const isSameDay = (a: Date, b: Date): boolean => {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
};

// Generate array of dates for a given range
const generateDateRange = (startDate: Date, days: number): Date[] => {
  const dates: Date[] = [];
  for (let i = 0; i < days; i++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);
    dates.push(date);
  }
  return dates;
};

interface UseMealPlanDatesProps {
  initialPastDays?: number;
  initialFutureDays?: number;
}

export const useMealPlanDates = ({
  initialPastDays = 7,
  initialFutureDays = 14,
}: UseMealPlanDatesProps = {}) => {
  // Dynamic date range for infinite scroll
  const [dateRange, setDateRange] = useState({
    pastDays: initialPastDays,
    futureDays: initialFutureDays,
  });

  // Track scroll offset for header animations
  const currentScrollOffsetRef = useRef(0);

  // Loading gate to prevent rapid-fire loading
  const isLoadingRef = useRef(false);

  // Calculate date range based on dynamic state
  const today = useMemo(() => new Date(), []);

  const startDate = useMemo(() => {
    const date = new Date(today);
    date.setDate(today.getDate() - dateRange.pastDays);
    return date;
  }, [today, dateRange.pastDays]);

  const endDate = useMemo(() => {
    const date = new Date(today);
    date.setDate(today.getDate() + dateRange.futureDays);
    return date;
  }, [today, dateRange.futureDays]);

  const totalDays = dateRange.pastDays + dateRange.futureDays + 1;

  // Build sections for SectionList (legacy - kept for compatibility)
  const sections: DaySection[] = useMemo(() => {
    const dates = generateDateRange(startDate, totalDays);
    return dates.map((date) => ({
      date,
      dateString: formatDateString(date),
      isToday: isSameDay(date, today),
      data: [
        {
          date,
          dateString: formatDateString(date),
          isToday: isSameDay(date, today),
        },
      ],
    }));
  }, [startDate, totalDays, today]);

  // Find index of today's section (legacy)
  const todaySectionIndex = useMemo(() => {
    return sections.findIndex((s) => s.isToday);
  }, [sections]);

  // Flattened data for FlashList - each day becomes 3 items: header, content, footer
  const flattenedData: MealPlanListItem[] = useMemo(() => {
    const dates = generateDateRange(startDate, totalDays);
    const items: MealPlanListItem[] = [];

    dates.forEach((date) => {
      const dateString = formatDateString(date);
      const isToday = isSameDay(date, today);

      items.push({
        type: "header",
        id: `header-${dateString}`,
        date,
        dateString,
        isToday,
      });

      items.push({
        type: "content",
        id: `content-${dateString}`,
        date,
        dateString,
        isToday,
      });

      items.push({
        type: "footer",
        id: `footer-${dateString}`,
        dateString,
      });
    });

    return items;
  }, [startDate, totalDays, today]);

  // Index of today's header for scroll-to-today
  const todayHeaderIndex = useMemo(() => {
    return flattenedData.findIndex(
      (item) => item.type === "header" && item.isToday,
    );
  }, [flattenedData]);

  // Load more past dates
  const loadMorePast = useCallback(() => {
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;

    setDateRange((prev) => ({
      ...prev,
      pastDays: prev.pastDays + DATES_TO_LOAD,
    }));

    // Clear loading flag after content settles
    setTimeout(() => {
      isLoadingRef.current = false;
    }, 300);
  }, []);

  // Load more future dates
  const loadMoreFuture = useCallback(() => {
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;

    setDateRange((prev) => ({
      ...prev,
      futureDays: prev.futureDays + DATES_TO_LOAD,
    }));

    // Clear loading flag after content settles
    setTimeout(() => {
      isLoadingRef.current = false;
    }, 300);
  }, []);

  // Update current scroll offset (called from scroll handler)
  const updateScrollOffset = useCallback((offset: number) => {
    currentScrollOffsetRef.current = offset;
  }, []);

  return {
    startDate,
    endDate,
    startDateString: formatDateString(startDate),
    endDateString: formatDateString(endDate),
    sections,
    todaySectionIndex,
    loadMorePast,
    loadMoreFuture,
    updateScrollOffset,
    // FlashList data
    flattenedData,
    todayHeaderIndex,
    DAY_HEADER_HEIGHT,
    DAY_CONTENT_HEIGHT,
    DAY_FOOTER_HEIGHT,
  };
};

export {
  formatDateString,
  isSameDay,
  DAY_HEADER_HEIGHT,
  DAY_CONTENT_HEIGHT,
  DAY_FOOTER_HEIGHT,
};
export type {
  DaySection,
  MealPlanListItem,
  HeaderItem,
  ContentItem,
  FooterItem,
};
