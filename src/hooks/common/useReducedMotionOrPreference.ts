import { useMemo } from 'react';
import { useReducedMotion, type Transition } from 'framer-motion';
import { usePreferencesStore } from '../../store/usePreferencesStore';

export interface UseReducedMotionOrPreferenceResult {
  /** 是否应降级动效（系统偏好或用户偏好任一为 true 即降级） */
  reduceMotion: boolean;
  /** 降级时为 { duration: 0 }，否则为 undefined，可直接传给 motion 组件的 transition prop */
  transitionOverride: Transition | undefined;
}

/**
 * 全局动效降级 hook：聚合系统级 `prefers-reduced-motion` 与用户在偏好设置中
 * 显式开启的 `reducedMotion`，任一为 true 即视为降级。
 *
 * - `reduceMotion`：用于条件分支（如禁用循环动画、隐藏粒子效果）
 * - `transitionOverride`：可直接作为 motion 组件 `transition` prop 的覆盖值，
 *   降级时将 duration 收敛为 0，避免逐组件手写三元
 *
 * @example
 * const { reduceMotion, transitionOverride } = useReducedMotionOrPreference();
 * <motion.div animate={{ opacity: 1 }} transition={transitionOverride} />
 */
export function useReducedMotionOrPreference(): UseReducedMotionOrPreferenceResult {
  const systemReducedMotion = useReducedMotion() ?? false;
  const userReducedMotion = usePreferencesStore((s) => s.reducedMotion);

  const reduceMotion = systemReducedMotion || userReducedMotion;

  const transitionOverride = useMemo<Transition | undefined>(() => {
    return reduceMotion ? { duration: 0 } : undefined;
  }, [reduceMotion]);

  return { reduceMotion, transitionOverride };
}
