import { powerSaveBlocker } from 'electron';
import { logger } from './logger';

/**
 * 模块级状态：reason → blockerId
 *
 * 使用顶层 Map + 纯函数式导出（与 trayManager 的 class 风格不同，
 * powerManager 是无状态的函数集合，更适合纯函数式导出）。
 */
const activeBlockers = new Map<string, number>();

/**
 * 启动一个电源阻塞器，防止系统进入睡眠/屏保。
 * 重复以同一 reason 调用不会创建新 blocker（幂等）。
 */
export function startBlocker(reason: string): void {
  if (activeBlockers.has(reason)) {
    logger.warn(`[PowerManager] Blocker already active for reason: ${reason}`);
    return;
  }

  try {
    const id = powerSaveBlocker.start('prevent-display-sleep');
    activeBlockers.set(reason, id);
    logger.info(`[PowerManager] Started blocker for reason: ${reason} (id=${id})`);
  } catch (error) {
    logger.error(`[PowerManager] Failed to start blocker for reason: ${reason}`, error);
    throw error;
  }
}

/**
 * 停止与 reason 关联的电源阻塞器。
 * 若 reason 不存在则 logger.warn 并返回（幂等）。
 */
export function stopBlocker(reason: string): void {
  if (!activeBlockers.has(reason)) {
    logger.warn(`[PowerManager] No blocker to stop for reason: ${reason}`);
    return;
  }

  const id = activeBlockers.get(reason);
  if (id !== undefined) {
    powerSaveBlocker.stop(id);
    activeBlockers.delete(reason);
    logger.info(`[PowerManager] Stopped blocker for reason: ${reason} (id=${id})`);
  }
}

/** 返回当前活跃的 reason 列表（用于调试与状态查询）。 */
export function getActiveReasons(): string[] {
  return Array.from(activeBlockers.keys());
}

/** 重置所有活跃 blocker（仅在 app 退出或测试时调用）。 */
export function resetAllBlockers(): void {
  for (const [reason, id] of activeBlockers) {
    powerSaveBlocker.stop(id);
    logger.info(`[PowerManager] Reset blocker for reason: ${reason} (id=${id})`);
  }
  activeBlockers.clear();
}
