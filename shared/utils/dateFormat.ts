/**
 * 纯日期格式化工具（前后端共用，无 i18n 依赖）
 *
 * 仅收录跨端复用的纯函数：
 * - toLocalDateString：本地时区当日 YYYY-MM-DD（notesService 与 NotesListPage 的跳转标记键等）
 * - toIcsUtcTimestamp：iCalendar UTC 基本格式（calendarService ICS 导出）
 *
 * 带 i18n 的展示级格式化（如 formatDate('full')）仍留在前端 src/utils/formatters.ts。
 */

/**
 * 获取本时区当日的 YYYY-MM-DD 字符串。
 * 使用运行环境本地日期（项目部署时区 Asia/Shanghai）。
 *
 * @example
 * toLocalDateString(new Date(2026, 7, 17)); // "2026-08-17"
 * toLocalDateString(new Date(2026, 0, 3));  // "2026-01-03"（补零）
 */
export function toLocalDateString(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * 将 Date 转为 iCalendar UTC 基本格式 `YYYYMMDDTHHMMSSZ`（RFC 5545 DATE-TIME）。
 * 用于 ICS 导出的 DTSTAMP/DTSTART/DTEND 字段。
 *
 * @example
 * toIcsUtcTimestamp(new Date("2026-08-17T12:30:45.123Z")); // "20260817T123045Z"
 */
export function toIcsUtcTimestamp(date: Date): string {
  return `${date.toISOString().replace(/[-:]/g, "").split(".")[0]}Z`;
}
