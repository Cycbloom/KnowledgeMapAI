/**
 * 时长格式化工具
 *
 * 统一处理项目中重复的 formatDuration 实现。
 * 提供三种输入单位（秒 / 分钟 / 毫秒）与多种输出格式。
 */

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
    if (minutes < 60) return `${minutes} 分钟`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours} 小时 ${mins} 分钟` : `${hours} 小时`;
  }

  // 'zh'（默认）
  if (minutes < 60) return `${minutes}分钟`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}小时${mins}分钟` : `${hours}小时`;
}
