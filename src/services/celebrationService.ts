/**
 * Celebration Service
 *
 * 提供庆祝效果（confetti 爆发）的预设配置与节流能力。
 * 实际渲染由 CelebrationOverlay 组件订阅 frontendEventBus 的 "celebration_burst" 事件完成，
 * 本服务仅负责生成配置与控制触发频率。
 */

export type CelebrationPreset =
  | "task-completed"
  | "achievement-unlocked"
  | "review-finished"
  | "streak-milestone";

export interface CelebrationConfig {
  particleCount: number;
  /** 角度（度） */
  spread: number;
  /** 0-1，0.5/0.5 为屏幕中心 */
  origin: { x: number; y: number };
  colors: string[];
  startVelocity: number;
  /** 默认 true，开启时若用户偏好减少动效则不渲染 */
  disableForReducedMotion: boolean;
}

/**
 * 预设配置：保持轻量，每个预设粒子数 15-25，
 * 时长 ~600ms 通过 startVelocity 控制。
 */
export const CELEBRATION_PRESETS: Record<CelebrationPreset, CelebrationConfig> = {
  // 中等规模，蓝色/绿色（与 primary 色调一致），origin 中心偏上
  "task-completed": {
    particleCount: 20,
    spread: 45,
    origin: { x: 0.5, y: 0.4 },
    colors: ["#3b82f6", "#10b981"],
    startVelocity: 35,
    disableForReducedMotion: true,
  },
  // 大规模，金色/橙色，origin 中心
  "achievement-unlocked": {
    particleCount: 25,
    spread: 60,
    origin: { x: 0.5, y: 0.5 },
    colors: ["#fbbf24", "#f97316"],
    startVelocity: 45,
    disableForReducedMotion: true,
  },
  // 小规模，紫色，origin 中心
  "review-finished": {
    particleCount: 15,
    spread: 30,
    origin: { x: 0.5, y: 0.5 },
    colors: ["#a855f7", "#c084fc"],
    startVelocity: 30,
    disableForReducedMotion: true,
  },
  // 大规模，红色/橙色，origin 顶部
  "streak-milestone": {
    particleCount: 25,
    spread: 90,
    origin: { x: 0.5, y: 0.3 },
    colors: ["#ef4444", "#f97316"],
    startVelocity: 50,
    disableForReducedMotion: true,
  },
};

/**
 * 根据预设获取庆祝配置。
 */
export function getCelebrationConfig(
  preset: CelebrationPreset,
): CelebrationConfig {
  return CELEBRATION_PRESETS[preset];
}

/**
 * 创建节流器：throttleMs 时间窗口内多次触发合并为一次（leading-edge）。
 *
 * 节流是跨预设全局共享的：不同 preset 在窗口内也会被节流，
 * 以避免连续多种庆祝叠加造成视觉过载。
 *
 * @param throttleMs 节流时间（毫秒），默认 1000
 * @returns (preset) => boolean，true 表示已触发，false 表示被节流
 */
export function createCelebrationThrottler(
  throttleMs = 1000,
): (preset: CelebrationPreset) => boolean {
  let lastTriggeredAt = 0;
  return (_preset: CelebrationPreset): boolean => {
    const now = Date.now();
    if (now - lastTriggeredAt >= throttleMs) {
      lastTriggeredAt = now;
      return true;
    }
    return false;
  };
}
