export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  start: string;
  end?: string;
  type: 'task' | 'study' | 'review' | 'other';
  color?: string;
  allDay?: boolean;
  estimated_duration?: number;
}

export interface ExecutionEvent {
  id: string;
  task_id: string;
  task_title: string;
  started_at: string;
  ended_at?: string;
  duration?: number;
  status?: string;
}

export interface EventDropInfo {
  eventId: string;
  newStart: Date;
  newEnd?: Date;
}
