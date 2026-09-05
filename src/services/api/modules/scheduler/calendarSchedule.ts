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

/** 手动改期结果 */
export interface RescheduleResult {
  id: string;
  knowledgePointId: string;
  scheduledDate: string;
  merged: boolean;
}

/** 复习到期预测事件（FSRS next_review 投影，只读不落库） */
export interface ReviewProjectionEvent {
  id: string;
  title: string;
  description: string;
  start: string;
  end: string;
  allDay: boolean;
  type: "review_projection";
  color: string;
  status: string | null;
  estimated_duration: number;
  knowledgePointId: string | null;
  scheduledDate: string;
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

  /** 复习到期预测（按知识点 × 到期日聚合，只读投影） */
  getReviewProjections: (
    start?: string,
    end?: string,
  ): Promise<ReviewProjectionEvent[]> => {
    const query = new URLSearchParams();
    if (start) query.set("start", start);
    if (end) query.set("end", end);
    const qs = query.toString();
    return requestData<ReviewProjectionEvent[]>(
      `/calendar/review-projections${qs ? `?${qs}` : ""}`,
    );
  },

  /** 手动改期：把某条路径排期移动到新日期 */
  reschedule: (id: string, newDate: string): Promise<RescheduleResult> =>
    requestData<RescheduleResult>(`/calendar/schedule/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ new_date: newDate }),
    }),
};