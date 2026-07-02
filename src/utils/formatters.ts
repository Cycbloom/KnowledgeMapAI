/**
 * 时长格式化工具
 *
 * 统一处理项目中重复的 formatDuration 实现。
 * 提供三种输入单位（秒 / 分钟 / 毫秒）与多种输出格式。
 */

import i18next from 'i18next';

/** 时长输出格式 */
export type DurationFormat = 'zh' | 'zh-spaced' | 'compact';

/** formatDuration / formatDurationMinutes 的可选配置 */
export interface FormatDurationOptions {
  /** 输出格式，默认 'zh' */
  format?: DurationFormat;
  /** 当输入为 0 / undefined / null 时返回的文本，默认 '--' */
  emptyText?: string;
  /** 是否使用 Math.round 而非 Math.floor 计算分钟，默认 false */
  round?: boolean;
}

/**
 * 将秒数格式化为可读时长字符串。
 *
 * @param seconds - 时长（秒）。0 / undefined / null 会返回 emptyText。
 * @param options - 可选配置
 * @returns 格式化后的字符串
 *
 * @example
 *   formatDuration(30)                       // "30分钟"（30秒 < 60，minutes=0，返回 "0分钟"）
 *   formatDuration(60)                       // "1分钟"
 *   formatDuration(3600)                     // "1小时"
 *   formatDuration(5400)                     // "1小时30分钟"
 *   formatDuration(undefined)                // "--"
 *   formatDuration(0, { emptyText: '' })     // ""
 *   formatDuration(3600, { format: 'compact' })           // "1h 0m"
 *   formatDuration(5400, { format: 'compact' })           // "1h 30m"
 *   formatDuration(60, { format: 'zh-spaced' })           // "1 分钟"
 *   formatDuration(5400, { format: 'zh-spaced' })         // "1 小时 30 分钟"
 *   formatDuration(30, { round: true })     // "1分钟"（Math.round(30/60)=1）
 */
export function formatDuration(
  seconds: number | undefined | null,
  options?: FormatDurationOptions,
): string {
  const { format = 'zh', emptyText = '--', round = false } = options ?? {};
  if (!seconds) return emptyText;

  const minutes = round
    ? Math.round(seconds / 60)
    : Math.floor(seconds / 60);

  return formatMinutesInternal(minutes, format);
}

/**
 * 将分钟数格式化为可读时长字符串。
 *
 * 与 {@link formatDuration} 行为一致，但输入单位为分钟。
 *
 * @param minutes - 时长（分钟）。0 / undefined / null 会返回 emptyText。
 * @param options - 可选配置
 * @returns 格式化后的字符串
 *
 * @example
 *   formatDurationMinutes(30)                          // "30分钟"
 *   formatDurationMinutes(60)                          // "1小时"
 *   formatDurationMinutes(90)                          // "1小时30分钟"
 *   formatDurationMinutes(undefined)                   // "--"
 *   formatDurationMinutes(0, { emptyText: '0h' })      // "0h"
 *   formatDurationMinutes(90, { format: 'compact' })   // "1h 30m"
 *   formatDurationMinutes(90, { format: 'zh-spaced' }) // "1 小时 30 分钟"
 */
export function formatDurationMinutes(
  minutes: number | undefined | null,
  options?: FormatDurationOptions,
): string {
  const { format = 'zh', emptyText = '--' } = options ?? {};
  if (!minutes) return emptyText;

  return formatMinutesInternal(minutes, format);
}

/**
 * 将毫秒数格式化为可读时长字符串，用于 AI 性能监控等需要毫秒级精度的场景。
 *
 * @param ms - 时长（毫秒）
 * @returns 格式化后的字符串，如 "120ms" / "1.5s" / "2.3min"
 *
 * @example
 *   formatDurationMs(500)    // "500ms"
 *   formatDurationMs(1500)   // "1.5s"
 *   formatDurationMs(90000)  // "1.5min"
 */
export function formatDurationMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}min`;
}

/**
 * 将秒数格式化为 MM:SS 格式，用于计时器显示。
 *
 * @param seconds - 时长（秒）
 * @returns MM:SS 格式字符串
 *
 * @example
 *   formatTimeFromSeconds(0)    // "00:00"
 *   formatTimeFromSeconds(65)   // "01:05"
 *   formatTimeFromSeconds(3661) // "61:01"
 */
export function formatTimeFromSeconds(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * 格式化数字，添加千分位分隔符
 * @param n 数字
 * @param locale locale 字符串，默认跟随 i18next.language
 * @returns 格式化后的字符串，如 "12,345"
 */
export function formatNumber(n: number, locale?: string): string {
  const resolvedLocale = locale ?? i18next.language ?? 'zh-CN';
  return new Intl.NumberFormat(resolvedLocale).format(n);
}

/** 日期输出格式 */
export type DateFormat = 'short' | 'full' | 'relative' | 'short-datetime' | 'full-datetime';

/**
 * 将日期字符串或时间戳格式化为可读的日期/时间字符串。
 *
 * @param dateStr - ISO 日期字符串或时间戳（毫秒）
 * @param format - 输出格式，默认 'full'
 * @returns 格式化后的日期字符串
 *
 * @example
 *   formatDate('2024-03-15T14:30:00Z', 'short')          // "3月15日"
 *   formatDate('2024-03-15T14:30:00Z', 'full')           // "2024年3月15日"
 *   formatDate('2024-03-15T14:30:00Z', 'relative')       // "2天前"（取决于当前时间）
 *   formatDate('2024-03-15T14:30:00Z', 'short-datetime') // "3月15日 14:30"
 *   formatDate('2024-03-15T14:30:00Z', 'full-datetime')  // "2024年3月15日 14:30"
 */
export function formatDate(dateStr: string | number, format: DateFormat = 'full'): string {
  const date = typeof dateStr === 'number' ? new Date(dateStr) : new Date(dateStr);

  if (isNaN(date.getTime())) return '--';

  if (format === 'relative') {
    const now = Date.now();
    const diff = now - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return i18next.t('common.date.justNow');
    if (minutes < 60) return i18next.t('common.date.minutesAgo', { count: minutes });
    if (hours < 24) return i18next.t('common.date.hoursAgo', { count: hours });
    if (days < 7) return i18next.t('common.date.daysAgo', { count: days });
    // 超过7天，回退到完整日期
    return i18next.t('common.date.fullDate', {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
    });
  }

  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hour = date.getHours().toString().padStart(2, '0');
  const minute = date.getMinutes().toString().padStart(2, '0');
  const timePart = ` ${hour}:${minute}`;

  switch (format) {
    case 'short':
      return i18next.t('common.date.shortDate', { month, day });
    case 'short-datetime':
      return `${i18next.t('common.date.shortDate', { month, day })}${timePart}`;
    case 'full':
      return i18next.t('common.date.fullDate', { year, month, day });
    case 'full-datetime':
      return `${i18next.t('common.date.fullDate', { year, month, day })}${timePart}`;
    default:
      return i18next.t('common.date.fullDate', { year, month, day });
  }
}

/**
 * 内部：根据分钟数和格式输出字符串。
 * 调用前需保证 minutes > 0。
 */
function formatMinutesInternal(minutes: number, format: DurationFormat): string {
  if (format === 'compact') {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  }

  if (format === 'zh-spaced') {
    if (minutes < 60) return i18next.t('common.duration.minutes', { count: minutes });
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0
      ? i18next.t('common.duration.hoursMinutes', { hours, minutes: mins })
      : i18next.t('common.duration.hours', { count: hours });
  }

  // 'zh'（默认）
  if (minutes < 60) return i18next.t('common.duration.minutes', { count: minutes });
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0
    ? i18next.t('common.duration.hoursMinutes', { hours, minutes: mins })
    : i18next.t('common.duration.hours', { count: hours });
}
