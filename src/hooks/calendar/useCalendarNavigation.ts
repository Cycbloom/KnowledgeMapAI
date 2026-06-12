import { useState, useCallback } from "react";

export type ViewType = "month" | "week" | "day" | "schedule";

export function useCalendarNavigation(initialViewType: ViewType = "month") {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewType, setViewType] = useState<ViewType>(initialViewType);

  const navigate = useCallback(
    (direction: number) => {
      setCurrentDate((prev) => {
        const next = new Date(prev);
        switch (viewType) {
          case "month":
            next.setMonth(next.getMonth() + direction);
            break;
          case "week":
            next.setDate(next.getDate() + direction * 7);
            break;
          case "day":
          case "schedule":
            next.setDate(next.getDate() + direction);
            break;
        }
        return next;
      });
    },
    [viewType],
  );

  const goToToday = useCallback(() => {
    setCurrentDate(new Date());
  }, []);

  return {
    currentDate,
    setCurrentDate,
    viewType,
    setViewType,
    navigate,
    goToToday,
  };
}
