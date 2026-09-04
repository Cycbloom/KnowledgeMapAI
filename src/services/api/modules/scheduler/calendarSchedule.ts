import { requestData } from "../../client";

/** 路径排课事件（学习路径知识点排期，供日历「路径排课」图层） */
export interface CalendarScheduleEvent {
  id: string;
  title: string;
  description: string;
  start: string;
  end: string;
  allDay: boolean;
  type: "path_schedule";
  color: string;
  status: string | null;
  knowledgePointId: string | null;
  scheduledDate: string | null;
}

export const calendarScheduleApi = {
  getScheduleEvents: (
    start?: string,
    end?: string,
  ): Promise<CalendarScheduleEvent[]> => {
    const query = new URLSearchParams();
    if (start) query.set("start", start);
    if (end) query.set("end", end);
    const qs = query.toString();
    return requestData<CalendarScheduleEvent[]>(
      `/calendar/schedule${qs ? `?${qs}` : ""}`,
    );
  },
};