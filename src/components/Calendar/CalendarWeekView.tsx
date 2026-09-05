import React, { useMemo, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Clock, Move, Calendar as CalendarIcon } from "lucide-react";
import { useTheme } from "../../hooks";
import {
  CalendarEvent,
  ExecutionEvent,
  EventDropInfo,
} from "../../types/calendar";
import { CalendarSubtaskStack } from "./CalendarSubtaskStack";
import { formatDate } from "../../utils/formatters";
import {
  formatBandRange,
  getStageBgColor,
  getStageHoverColor,
  getStageStatusStyle,
  getStageStatusLabel,
  computeStageIndices,
  buildStageTooltip,
} from "../../utils/stageBandStyle";
import type { TaskSubtask } from "@shared/types";

interface CalendarWeekViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  executions: ExecutionEvent[];
  stageWindowBands?: CalendarEvent[];
  onDateSelect: (date: Date) => void;
  onEventClick: (event: CalendarEvent) => void;
  onAddEvent: (date: Date, hour?: number) => void;
  onEventDrop?: (dropInfo: EventDropInfo) => void;
  showSubtasks?: boolean;
  onSubtaskClick?: (subtask: TaskSubtask, parentEvent: CalendarEvent) => void;
}

const WEEKDAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
const HOURS = Array.from({ length: 24 }, (_, i) => i);

export const CalendarWeekView: React.FC<CalendarWeekViewProps> = ({
  currentDate,
  events,
  executions,
  stageWindowBands = [],
  onDateSelect,
  onEventClick,
  onAddEvent,
  onEventDrop,
  showSubtasks = false,
  onSubtaskClick,
}) => {
  const { isDark } = useTheme();
  const { t } = useTranslation();
  const getWeekdayName = (index: number) =>
    t(`calendar.weekdays.${WEEKDAY_KEYS[index] ?? "sun"}`);
  const [draggedEvent, setDraggedEvent] = useState<CalendarEvent | null>(null);
  const [dragOverCell, setDragOverCell] = useState<{
    dayIndex: number;
    hour: number;
  } | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const dragRef = useRef<HTMLDivElement>(null);
  const [editingDateEventId, setEditingDateEventId] = useState<string | null>(
    null,
  );
  const [pendingDateValue, setPendingDateValue] = useState<string>("");

  // 键盘拖动相关状态
  const [draggingEventId, setDraggingEventId] = useState<string | null>(null);
  const [dropTargetDayIndex, setDropTargetDayIndex] = useState<number | null>(
    null,
  );
  const [dropTargetHour, setDropTargetHour] = useState<number | null>(null);
  const [dragAnnouncement, setDragAnnouncement] = useState<string>("");

  const weekData = useMemo(() => {
    const days: {
      date: Date;
      label: string;
      isToday: boolean;
      events: CalendarEvent[];
      executions: ExecutionEvent[];
    }[] = [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    // 预按当日零点时间戳分桶，避免为 7 天各自 filter 全量 events/executions（原为 O(7*(n+m))）
    const dayKey = (ts: Date): number => {
      const d = new Date(ts);
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    };
    const eventsByDay = new Map<number, CalendarEvent[]>();
    events.forEach((e) => {
      const key = dayKey(new Date(e.start));
      const list = eventsByDay.get(key);
      if (list) {
        list.push(e);
      } else {
        eventsByDay.set(key, [e]);
      }
    });
    const executionsByDay = new Map<number, ExecutionEvent[]>();
    executions.forEach((e) => {
      const key = dayKey(new Date(e.started_at));
      const list = executionsByDay.get(key);
      if (list) {
        list.push(e);
      } else {
        executionsByDay.set(key, [e]);
      }
    });

    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(date.getDate() + i);

      const dayEvents = eventsByDay.get(date.getTime()) || [];
      const dayExecutions = executionsByDay.get(date.getTime()) || [];

      days.push({
        date,
        label: `${date.getMonth() + 1}/${date.getDate()}`,
        isToday: date.getTime() === today.getTime(),
        events: dayEvents,
        executions: dayExecutions,
      });
    }

    return days;
  }, [currentDate, events, executions]);

  // 阶段条（周窗口甘特条）：只保留与本周相交的窗口，按 7 列（周日~周六）坐标计算横跨位置
  // 同一路径内检测重叠区间并分层（lane），重叠色块分到不同行，避免互相覆盖
  const weekBands = (() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const date = currentDate.getDate();
    const day = currentDate.getDay();
    const weekStart = new Date(year, month, date - day, 0, 0, 0, 0);
    const weekEnd = new Date(year, month, date - day + 6, 0, 0, 0, 0);

    const parseDay = (iso: string): Date => {
      const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
      return new Date(y, m - 1, d, 0, 0, 0, 0);
    };
    const dayMs = 24 * 60 * 60 * 1000;

    const stageIndices = computeStageIndices(stageWindowBands);

    const items = stageWindowBands.flatMap((band) => {
      if (!band.start || !band.end) return [];
      const bandStart = parseDay(band.start);
      const bandEnd = parseDay(band.end);
      const start = bandStart < weekStart ? weekStart : bandStart;
      const end = bandEnd > weekEnd ? weekEnd : bandEnd;
      if (start > end) return [];
      const startCol = Math.round((start.getTime() - weekStart.getTime()) / dayMs);
      const endCol = Math.round((end.getTime() - weekStart.getTime()) / dayMs);
      return [
        {
          band,
          stageIndex: stageIndices.get(band.id) ?? 0,
          startCol,
          endCol,
          leftPct: (startCol / 7) * 100,
          widthPct: ((endCol - startCol + 1) / 7) * 100,
        },
      ];
    });

    const byPath = new Map<string, typeof items>();
    items.forEach((it) => {
      const key = it.band.pathId ?? "default";
      const list = byPath.get(key);
      if (list) list.push(it);
      else byPath.set(key, [it]);
    });

    // 层叠分配：同一路径内按 startCol 升序，贪心放入第一个空闲层（startCol > 已占用 endCol 视为不重叠）
    return Array.from(byPath.values()).map((list) => {
      const sorted = list.slice().sort((a, b) => a.startCol - b.startCol);
      const laneEnds: number[] = [];
      const withLane = sorted.map((it) => {
        const laneIdx = laneEnds.findIndex((end) => it.startCol > end);
        const lane = laneIdx === -1 ? laneEnds.length : laneIdx;
        laneEnds[lane] = it.endCol;
        return { ...it, lane };
      });
      const byLane = new Map<number, typeof withLane>();
      withLane.forEach((r) => {
        const laneList = byLane.get(r.lane);
        if (laneList) laneList.push(r);
        else byLane.set(r.lane, [r]);
      });
      return Array.from(byLane.values()).map((laneList) =>
        laneList.sort((a, b) => a.stageIndex - b.stageIndex),
      );
    });
  })();

  // 预构建 eventId -> event 索引，键盘拖动指示器由 O(7*events) 的 flatMap+find 降为 O(1) 的 get
  const eventById = useMemo(() => {
    const m = new Map<string, CalendarEvent>();
    weekData.forEach((d) => d.events.forEach((e) => m.set(e.id, e)));
    return m;
  }, [weekData]);

  const getEventPosition = (event: CalendarEvent) => {
    const start = new Date(event.start);
    const end = event.end
      ? new Date(event.end)
      : new Date(start.getTime() + 60 * 60 * 1000);
    const startHour = start.getHours() + start.getMinutes() / 60;
    const endHour = end.getHours() + end.getMinutes() / 60;
    const duration = endHour - startHour;

    return {
      top: `${startHour * 60}px`,
      height: `${Math.max(duration * 60, 30)}px`,
    };
  };

  const getEventColor = (event: CalendarEvent) => {
    switch (event.type) {
      case "task":
        return "bg-primary-500 border-primary-600";
      case "study":
        return "bg-primary-500 border-primary-600";
      case "review":
        return "bg-green-500 border-green-600";
      case "path_schedule":
        return "bg-purple-500 border-purple-600";
      case "review_projection":
        return "bg-orange-500 border-orange-600";
      case "stage_window":
        return "bg-indigo-500 border-indigo-600";
      default:
        return "bg-gray-500 border-gray-600";
    }
  };

  const getExecutionPosition = (execution: ExecutionEvent) => {
    const start = new Date(execution.started_at);
    const startHour = start.getHours() + start.getMinutes() / 60;
    const duration = (execution.duration || 30) / 60;

    return {
      top: `${startHour * 60}px`,
      height: `${Math.max(duration * 60, 20)}px`,
    };
  };

  const handleDragStart = (e: React.DragEvent, event: CalendarEvent) => {
    setDraggedEvent(event);
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const clickY = e.clientY - rect.top;
    const offsetHours = clickY / 60;
    setDragOffset(offsetHours);

    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", event.id);

    const dragImage = document.createElement("div");
    dragImage.className = "opacity-50";
    e.dataTransfer.setDragImage(dragImage, 0, 0);
  };

  const handleDragOver = (
    e: React.DragEvent,
    dayIndex: number,
    hour: number,
  ) => {
    e.preventDefault();
    if (draggedEvent) {
      setDragOverCell({ dayIndex, hour });
    }
  };

  const handleDragLeave = () => {
    setDragOverCell(null);
  };

  const handleDrop = (e: React.DragEvent, dayIndex: number, hour: number) => {
    e.preventDefault();

    if (draggedEvent && onEventDrop) {
      const newStart = new Date(weekData[dayIndex].date);
      const adjustedHour = hour - Math.floor(dragOffset);
      newStart.setHours(adjustedHour, (dragOffset % 1) * 60, 0, 0);

      const originalStart = new Date(draggedEvent.start);
      const originalEnd = draggedEvent.end ? new Date(draggedEvent.end) : null;
      let newEnd: Date | undefined;

      if (originalEnd) {
        const duration = originalEnd.getTime() - originalStart.getTime();
        newEnd = new Date(newStart.getTime() + duration);
      }

      onEventDrop({
        eventId: draggedEvent.id,
        newStart,
        newEnd,
      });
    }

    setDraggedEvent(null);
    setDragOverCell(null);
    setDragOffset(0);
  };

  const handleDragEnd = () => {
    setDraggedEvent(null);
    setDragOverCell(null);
    setDragOffset(0);
  };

  const toDateInputValue = (date: Date): string => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const day = date.getDate().toString().padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const handleOpenChangeDate = (event: CalendarEvent) => {
    setEditingDateEventId(event.id);
    setPendingDateValue(toDateInputValue(new Date(event.start)));
  };

  const handleDateInputChange = (
    event: CalendarEvent,
    newValue: string,
  ) => {
    if (!newValue) {
      setEditingDateEventId(null);
      return;
    }
    if (!onEventDrop) {
      setEditingDateEventId(null);
      return;
    }
    const parts = newValue.split("-");
    if (parts.length !== 3) {
      setEditingDateEventId(null);
      return;
    }
    const year = parseInt(parts[0] ?? "0", 10);
    const month = parseInt(parts[1] ?? "0", 10) - 1;
    const day = parseInt(parts[2] ?? "0", 10);

    const originalStart = new Date(event.start);
    const newStart = new Date(originalStart);
    newStart.setFullYear(year, month, day);

    const originalEnd = event.end ? new Date(event.end) : null;
    let newEnd: Date | undefined;
    if (originalEnd) {
      const duration = originalEnd.getTime() - originalStart.getTime();
      newEnd = new Date(newStart.getTime() + duration);
    }

    onEventDrop({
      eventId: event.id,
      newStart,
      newEnd,
    });
    setEditingDateEventId(null);
  };

  const handleCardKeyDown = (
    e: React.KeyboardEvent,
    event: CalendarEvent,
  ) => {
    // 当前正有事件处于键盘拖动模式
    if (draggingEventId !== null) {
      // 其他事件正在被拖动：忽略
      if (draggingEventId !== event.id) {
        return;
      }

      if (
        e.key === "ArrowLeft" &&
        dropTargetDayIndex !== null &&
        dropTargetDayIndex > 0
      ) {
        e.preventDefault();
        const newDayIndex = dropTargetDayIndex - 1;
        setDropTargetDayIndex(newDayIndex);
        const targetDate = weekData[newDayIndex]?.date;
        if (targetDate) {
          setDragAnnouncement(
            `${t("calendar.drag.targetDate", { date: formatDate(targetDate, "month-day-weekday") })}. ${t("calendar.drag.moveHintWeek")}`,
          );
        }
      } else if (
        e.key === "ArrowRight" &&
        dropTargetDayIndex !== null &&
        dropTargetDayIndex < weekData.length - 1
      ) {
        e.preventDefault();
        const newDayIndex = dropTargetDayIndex + 1;
        setDropTargetDayIndex(newDayIndex);
        const targetDate = weekData[newDayIndex]?.date;
        if (targetDate) {
          setDragAnnouncement(
            `${t("calendar.drag.targetDate", { date: formatDate(targetDate, "month-day-weekday") })}. ${t("calendar.drag.moveHintWeek")}`,
          );
        }
      } else if (e.key === "ArrowUp" && dropTargetHour !== null) {
        e.preventDefault();
        const newHour = Math.max(0, dropTargetHour - 1);
        setDropTargetHour(newHour);
        setDragAnnouncement(
          `${t("calendar.drag.targetHour", { hour: newHour })}. ${t("calendar.drag.moveHintWeek")}`,
        );
      } else if (e.key === "ArrowDown" && dropTargetHour !== null) {
        e.preventDefault();
        const newHour = Math.min(23, dropTargetHour + 1);
        setDropTargetHour(newHour);
        setDragAnnouncement(
          `${t("calendar.drag.targetHour", { hour: newHour })}. ${t("calendar.drag.moveHintWeek")}`,
        );
      } else if (
        e.key === "Enter" &&
        dropTargetDayIndex !== null &&
        dropTargetHour !== null
      ) {
        e.preventDefault();
        e.stopPropagation();
        if (onEventDrop && dropTargetDayIndex !== null) {
          const targetDate = weekData[dropTargetDayIndex]?.date;
          if (targetDate) {
            const newStart = new Date(targetDate);
            newStart.setHours(dropTargetHour, 0, 0, 0);

            const originalStart = new Date(event.start);
            const originalEnd = event.end ? new Date(event.end) : null;
            let newEnd: Date | undefined;
            if (originalEnd) {
              const duration =
                originalEnd.getTime() - originalStart.getTime();
              newEnd = new Date(newStart.getTime() + duration);
            }

            onEventDrop({
              eventId: event.id,
              newStart,
              newEnd,
            });
          }
        }
        setDragAnnouncement(
          t("calendar.drag.confirm", { hour: dropTargetHour }),
        );
        setDraggingEventId(null);
        setDropTargetDayIndex(null);
        setDropTargetHour(null);
      } else if (e.key === "Escape") {
        e.preventDefault();
        setDraggingEventId(null);
        setDropTargetDayIndex(null);
        setDropTargetHour(null);
        setDragAnnouncement(t("calendar.drag.cancel"));
      }
      return;
    }

    // 非拖动模式：Ctrl+Space / Shift+Space 进入键盘拖动模式
    if (
      (e.key === " " && (e.ctrlKey || e.shiftKey)) &&
      onEventDrop
    ) {
      e.preventDefault();
      e.stopPropagation();
      const eventStart = new Date(event.start);
      const startHour = eventStart.getHours();
      // 计算事件所在当前周的 dayIndex
      const startOfWeek = new Date(currentDate);
      startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      const dayDiff = Math.round(
        (eventStart.getTime() - startOfWeek.getTime()) /
          (24 * 60 * 60 * 1000),
      );
      const startIndex =
        dayDiff >= 0 && dayDiff < 7 ? dayDiff : 0;
      setDraggingEventId(event.id);
      setDropTargetDayIndex(startIndex);
      setDropTargetHour(startHour);
      setDragAnnouncement(
        `${t("calendar.drag.start", { title: event.title, hour: startHour })}. ${t("calendar.drag.moveHintWeek")}`,
      );
      return;
    }

    // 默认行为：Enter/Space 触发点击
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      e.stopPropagation();
      onEventClick(event);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <span aria-live="polite" className="sr-only">
        {dragAnnouncement}
      </span>
      {/* Header */}
      <div className="flex border-b border-slate-200 dark:border-slate-500">
        <div className="w-16 flex-shrink-0" />
        {weekData.map((day, index) => (
          <div
            key={index}
            className={`flex-1 text-center py-2 border-l border-slate-200 dark:border-slate-500 cursor-pointer ${
              day.isToday ? "bg-primary-50 dark:bg-primary-500/10" : ""
            }`}
            onClick={() => onDateSelect(day.date)}
          >
            <div
              className={`text-xs ${isDark ? "text-slate-400" : "text-gray-500"}`}
            >
              {getWeekdayName(index)}
            </div>
            <div
              className={`text-sm font-medium ${day.isToday ? "text-primary-500" : isDark ? "text-white" : "text-gray-900"}`}
            >
              {day.label}
            </div>
          </div>
        ))}
      </div>

      {/* Stage window bands (all-day area) */}
      {weekBands.length > 0 && (
        <div className="border-b border-slate-200 dark:border-slate-500 px-2 py-1.5">
          <div className="text-[10px] uppercase tracking-wide text-gray-400 mb-1">
            {t("calendar.stageWindowBands")}
          </div>
          <div className="ml-16 space-y-1">
            {weekBands.map((pathGroup, groupIdx) => (
              <div key={groupIdx} className="space-y-1">
                {pathGroup.map((row, rowIdx) => (
                  <div key={rowIdx} className="relative h-6">
                    {row.map(({ band, stageIndex, leftPct, widthPct }) => {
                      const statusStyle = getStageStatusStyle(band.status);
                      const statusLabel = getStageStatusLabel(band.status);
                      const bgColor = getStageBgColor(stageIndex, isDark);
                      const hoverColor = getStageHoverColor(stageIndex, isDark);
                      return (
                        <button
                          key={band.id}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEventClick(band);
                          }}
                          className={`absolute top-0 h-full text-white text-[10px] px-1.5 rounded text-left cursor-pointer transition-colors flex items-center gap-1 overflow-hidden ${statusStyle.opacity} ${statusStyle.pulse ? "animate-pulse" : ""}`}
                          style={{
                            left: `${leftPct}%`,
                            width: `calc(${widthPct}% - 1px)`,
                            backgroundColor: bgColor,
                          }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.backgroundColor = hoverColor;
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.backgroundColor = bgColor;
                          }}
                          title={buildStageTooltip(band, stageIndex)}
                        >
                          <span className="flex-shrink-0 w-3.5 h-3.5 rounded-full bg-white/25 flex items-center justify-center text-[9px] font-bold leading-none">
                            {stageIndex + 1}
                          </span>
                          {statusLabel && (
                            <span className="flex-shrink-0 text-[9px]">{statusLabel}</span>
                          )}
                          <span className={`truncate ${statusStyle.textDecor}`}>{band.title}</span>
                          <span className="opacity-80 flex-shrink-0">{formatBandRange(band.start, band.end)}</span>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Time grid */}
      <div className="flex-1 overflow-y-auto">
        <div className="flex relative" style={{ minHeight: "1440px" }}>
          {/* Time labels */}
          <div className="w-16 flex-shrink-0">
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="h-[60px] text-xs text-right pr-2 text-slate-400"
                style={{ height: "60px" }}
              >
                {hour.toString().padStart(2, "0")}:00
              </div>
            ))}
          </div>

          {/* Day columns */}
          {weekData.map((day, dayIndex) => (
            <div
              key={dayIndex}
              className={`flex-1 relative border-l border-slate-200 dark:border-slate-500 ${
                day.isToday ? "bg-primary-50/30 dark:bg-primary-500/5" : ""
              }`}
            >
              {/* Hour lines */}
              {HOURS.map((hour) => (
                <div
                  key={hour}
                  role="button"
                  aria-label={`${hour.toString().padStart(2, "0")}:00`}
                  tabIndex={0}
                  className={`absolute w-full border-t ${
                    isDark ? "border-slate-700/50" : "border-gray-100"
                  } ${(dragOverCell?.dayIndex === dayIndex && dragOverCell?.hour === hour) || (draggingEventId !== null && dropTargetDayIndex === dayIndex && dropTargetHour === hour) ? "bg-primary-100/50 dark:bg-primary-500/20" : ""}`}
                  style={{ top: `${hour * 60}px`, height: "60px" }}
                  onDragOver={(e) => handleDragOver(e, dayIndex, hour)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, dayIndex, hour)}
                  onClick={() => !draggedEvent && onAddEvent(day.date, hour)}
                  onKeyDown={(e) => {
                    if ((e.key === "Enter" || e.key === " ") && !draggedEvent) {
                      e.preventDefault();
                      onAddEvent(day.date, hour);
                    }
                  }}
                />
              ))}

              {/* Executions (background) */}
              {day.executions.map((execution, i) => {
                const position = getExecutionPosition(execution);
                return (
                  <div
                    key={`exec-${i}`}
                    className="absolute left-1 right-1 bg-green-200/50 dark:bg-green-500/20 border-l-2 border-green-500 rounded-r"
                    style={position}
                    title={t("calendar.executionTitle", {
                      title: execution.task_title,
                      minutes: Math.round((execution.duration || 0) / 60),
                    })}
                  >
                    <div className="p-1 text-xs text-green-700 dark:text-green-300 truncate">
                      ✓ {execution.task_title}
                    </div>
                  </div>
                );
              })}

              {/* Events (foreground) */}
              {day.events.map((event, i) => {
                const position = getEventPosition(event);
                const isDragging = draggedEvent?.id === event.id;
                const isKeyboardDragging = draggingEventId === event.id;
                const hasEnoughHeight =
                  position.height && parseInt(position.height) > 80;
                const isEditingDate = editingDateEventId === event.id;
                return (
                  <div
                    key={`event-${i}`}
                    ref={dragRef}
                    draggable={!!onEventDrop && !isEditingDate}
                    onDragStart={(e) => handleDragStart(e, event)}
                    onDragEnd={handleDragEnd}
                    role="button"
                    tabIndex={0}
                    aria-roledescription={t("calendar.a11y.draggableTask")}
                    aria-label={`${event.title}, ${formatDate(event.start, "long-date")}`}
                    aria-grabbed={
                      isDragging || isKeyboardDragging ? "true" : "false"
                    }
                    onKeyDown={(e) => handleCardKeyDown(e, event)}
                    className={`absolute left-1 right-1 ${getEventColor(event)} text-white rounded shadow-sm cursor-pointer hover:opacity-90 overflow-hidden ${
                      isDragging ? "opacity-50" : ""
                    } ${onEventDrop ? "cursor-grab active:cursor-grabbing" : ""}`}
                    style={position}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEventClick(event);
                    }}
                  >
                    <div className="p-1 text-xs font-medium truncate flex items-center gap-1">
                      {onEventDrop && <Move size={10} className="opacity-50" />}
                      {event.title}
                      {event.has_subtasks && event.subtask_count && (
                        <span className="ml-auto opacity-75 text-[10px]">
                          {event.subtask_completed || 0}/{event.subtask_count}
                        </span>
                      )}
                      {onEventDrop && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenChangeDate(event);
                          }}
                          className={`p-0.5 rounded hover:bg-white/20 focus:outline-none focus:ring-1 focus:ring-white/50 flex-shrink-0 ${
                            event.has_subtasks && event.subtask_count
                              ? ""
                              : "ml-auto"
                          }`}
                          aria-label={t("calendar.a11y.changeDate")}
                          title={t("calendar.a11y.changeDate")}
                        >
                          <CalendarIcon size={10} />
                        </button>
                      )}
                    </div>
                    {isEditingDate && (
                      <input
                        type="date"
                        value={pendingDateValue}
                        onChange={(e) =>
                          handleDateInputChange(event, e.target.value)
                        }
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                        className="mx-1 mb-1 text-xs text-slate-900 bg-white rounded px-1 py-0.5 w-[calc(100%-0.5rem)]"
                        aria-label={t("calendar.a11y.changeDate")}
                      />
                    )}
                    {position.height && parseInt(position.height) > 40 && (
                      <div className="px-1 text-xs opacity-80 flex items-center gap-1">
                        <Clock size={10} />
                        {formatDate(event.start, "time")}
                      </div>
                    )}
                    {showSubtasks &&
                      hasEnoughHeight &&
                      event.subtasks &&
                      event.subtasks.length > 0 && (
                        <div className="px-1 pb-1">
                          <CalendarSubtaskStack
                            subtasks={event.subtasks}
                            maxVisible={2}
                            compact={true}
                            onSubtaskClick={(subtask) => {
                              onSubtaskClick?.(subtask, event);
                            }}
                          />
                        </div>
                      )}
                  </div>
                );
              })}

              {/* Drop indicator */}
              {dragOverCell?.dayIndex === dayIndex && draggedEvent && (
                <div
                  className="absolute left-1 right-1 bg-primary-400/30 border-2 border-primary-400 border-dashed rounded pointer-events-none"
                  style={{
                    top: `${(dragOverCell.hour - Math.floor(dragOffset)) * 60}px`,
                    height: `${getEventPosition(draggedEvent).height}`,
                  }}
                >
                  <div className="flex items-center justify-center h-full text-primary-500 text-xs font-medium">
                    <Move size={14} className="mr-1" />
                    {t('calendar.weekView.moveTo', { hour: dragOverCell.hour })}
                  </div>
                </div>
              )}

              {/* 键盘拖动 drop indicator */}
              {draggingEventId !== null &&
                dropTargetDayIndex === dayIndex &&
                dropTargetHour !== null &&
                (() => {
                  const draggedKeyEvent = eventById.get(draggingEventId);
                  const indicatorHeight = draggedKeyEvent
                    ? getEventPosition(draggedKeyEvent).height
                    : "60px";
                  return (
                    <div
                      aria-hidden="true"
                      className="absolute left-1 right-1 bg-primary-400/30 border-2 border-primary-400 border-dashed rounded pointer-events-none"
                      style={{
                        top: `${(dropTargetHour ?? 0) * 60}px`,
                        height: `${indicatorHeight}`,
                      }}
                    >
                      <div className="flex items-center justify-center h-full text-primary-500 text-xs font-medium">
                        <Move size={14} className="mr-1" />
                        {t("calendar.drag.targetHour", { hour: dropTargetHour })}
                      </div>
                    </div>
                  );
                })()}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
