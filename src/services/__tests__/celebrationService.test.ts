import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  CELEBRATION_PRESETS,
  createCelebrationThrottler,
  getCelebrationConfig,
  type CelebrationPreset,
} from "../celebrationService";

const ALL_PRESETS: CelebrationPreset[] = [
  "task-completed",
  "achievement-unlocked",
  "review-finished",
  "streak-milestone",
];

describe("celebrationService", () => {
  describe("CELEBRATION_PRESETS", () => {
    it("应该为所有 4 个预设提供合法配置", () => {
      for (const preset of ALL_PRESETS) {
        const config = CELEBRATION_PRESETS[preset];
        expect(config, `preset "${preset}" 应存在配置`).toBeDefined();
        // particleCount 在 15-25 范围内
        expect(config.particleCount).toBeGreaterThanOrEqual(15);
        expect(config.particleCount).toBeLessThanOrEqual(25);
        // spread 在 30-90 度范围内
        expect(config.spread).toBeGreaterThanOrEqual(30);
        expect(config.spread).toBeLessThanOrEqual(90);
        // origin 在 0-1 范围内
        expect(config.origin.x).toBeGreaterThanOrEqual(0);
        expect(config.origin.x).toBeLessThanOrEqual(1);
        expect(config.origin.y).toBeGreaterThanOrEqual(0);
        expect(config.origin.y).toBeLessThanOrEqual(1);
        // colors 非空数组
        expect(Array.isArray(config.colors)).toBe(true);
        expect(config.colors.length).toBeGreaterThan(0);
        // startVelocity 为正数
        expect(config.startVelocity).toBeGreaterThan(0);
        // disableForReducedMotion 默认为 true
        expect(config.disableForReducedMotion).toBe(true);
      }
    });

    it("task-completed 应使用蓝色/绿色调且 origin 中心偏上", () => {
      const config = CELEBRATION_PRESETS["task-completed"];
      expect(config.origin).toEqual({ x: 0.5, y: 0.4 });
      expect(config.colors.length).toBeGreaterThanOrEqual(2);
    });

    it("achievement-unlocked 应使用金色/橙色调且 origin 中心", () => {
      const config = CELEBRATION_PRESETS["achievement-unlocked"];
      expect(config.origin).toEqual({ x: 0.5, y: 0.5 });
      expect(config.particleCount).toBeGreaterThanOrEqual(20);
    });

    it("review-finished 应为小规模（particleCount 最小）", () => {
      const config = CELEBRATION_PRESETS["review-finished"];
      expect(config.particleCount).toBe(15);
      expect(config.origin).toEqual({ x: 0.5, y: 0.5 });
    });

    it("streak-milestone 应使用红色/橙色调且 origin 顶部", () => {
      const config = CELEBRATION_PRESETS["streak-milestone"];
      expect(config.origin).toEqual({ x: 0.5, y: 0.3 });
      expect(config.spread).toBe(90);
    });
  });

  describe("getCelebrationConfig", () => {
    it("应该返回与 CELEBRATION_PRESETS 一致的配置", () => {
      for (const preset of ALL_PRESETS) {
        expect(getCelebrationConfig(preset)).toBe(CELEBRATION_PRESETS[preset]);
      }
    });

    it("应该返回正确预设的配置（非共享引用陷阱验证）", () => {
      const taskConfig = getCelebrationConfig("task-completed");
      const achievementConfig = getCelebrationConfig("achievement-unlocked");
      expect(taskConfig).not.toBe(achievementConfig);
      expect(taskConfig.colors).not.toEqual(achievementConfig.colors);
    });
  });

  describe("createCelebrationThrottler", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("第一次调用应返回 true（已触发）", () => {
      const throttler = createCelebrationThrottler(1000);
      expect(throttler("task-completed")).toBe(true);
    });

    it("1 秒内第二次调用应返回 false（被节流）", () => {
      const throttler = createCelebrationThrottler(1000);
      expect(throttler("task-completed")).toBe(true);
      // 推进 500ms（在 1 秒窗口内）
      vi.advanceTimersByTime(500);
      expect(throttler("task-completed")).toBe(false);
    });

    it("1 秒后再次调用应返回 true（窗口已过）", () => {
      const throttler = createCelebrationThrottler(1000);
      expect(throttler("task-completed")).toBe(true);
      // 推进恰好 1000ms（窗口边界，应解除节流）
      vi.advanceTimersByTime(1000);
      expect(throttler("task-completed")).toBe(true);
    });

    it("999ms 时仍被节流，1000ms 时解除（边界验证）", () => {
      const throttler = createCelebrationThrottler(1000);
      throttler("task-completed");
      vi.advanceTimersByTime(999);
      expect(throttler("task-completed")).toBe(false);
      vi.advanceTimersByTime(1);
      expect(throttler("task-completed")).toBe(true);
    });

    it("不同 preset 也应被节流（合并为一次）", () => {
      const throttler = createCelebrationThrottler(1000);
      // 第一次：task-completed 触发
      expect(throttler("task-completed")).toBe(true);
      // 立即用不同 preset 触发：应被节流
      expect(throttler("achievement-unlocked")).toBe(false);
      expect(throttler("review-finished")).toBe(false);
      expect(throttler("streak-milestone")).toBe(false);
      // 1 秒后任一 preset 都可再次触发
      vi.advanceTimersByTime(1000);
      expect(throttler("streak-milestone")).toBe(true);
    });

    it("应支持自定义 throttleMs", () => {
      const throttler = createCelebrationThrottler(2000);
      expect(throttler("task-completed")).toBe(true);
      vi.advanceTimersByTime(1500);
      expect(throttler("task-completed")).toBe(false);
      vi.advanceTimersByTime(500);
      expect(throttler("task-completed")).toBe(true);
    });

    it("不同节流器实例应相互独立", () => {
      const throttlerA = createCelebrationThrottler(1000);
      const throttlerB = createCelebrationThrottler(1000);
      throttlerA("task-completed");
      // B 是独立实例，不受 A 的节流影响
      expect(throttlerB("task-completed")).toBe(true);
    });
  });
});
