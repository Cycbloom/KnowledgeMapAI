import { describe, it, expect, vi } from "vitest";
import { createMockSupabase } from "../../../../../tests/helpers/mockFactories";
import {
  capacityService,
  DEFAULT_DAILY_CAPACITY_MINUTES,
  DEFAULT_REVIEW_BUFFER_RATIO,
  MIN_PATH_QUOTA_MINUTES,
} from "../capacityService";

describe("capacityService", () => {
  it("读取 task_settings 的全局预算与复习缓冲", async () => {
    const supabase = createMockSupabase({
      data: { daily_capacity_minutes: 90, review_buffer_ratio: 0.3 },
    });
    const settings = await capacityService.getCapacitySettings(supabase, "user-1");
    expect(settings).toEqual({ dailyCapacityMinutes: 90, reviewBufferRatio: 0.3 });
  });

  it("缺失配置回退默认值，非法比例被钳制", async () => {
    const missing = createMockSupabase({ data: null });
    const settings = await capacityService.getCapacitySettings(missing, "user-1");
    expect(settings.dailyCapacityMinutes).toBe(DEFAULT_DAILY_CAPACITY_MINUTES);
    expect(settings.reviewBufferRatio).toBe(DEFAULT_REVIEW_BUFFER_RATIO);

    const invalid = createMockSupabase({
      data: { daily_capacity_minutes: null, review_buffer_ratio: 5 },
    });
    const settings2 = await capacityService.getCapacitySettings(invalid, "user-1");
    expect(settings2.dailyCapacityMinutes).toBe(DEFAULT_DAILY_CAPACITY_MINUTES);
    expect(settings2.reviewBufferRatio).toBe(DEFAULT_REVIEW_BUFFER_RATIO);
  });

  it("getDayLoad 按日聚合 scheduled 负载", async () => {
    const supabase = createMockSupabase({
      data: [
        { scheduled_date: "2026-01-01", estimated_time: 30 },
        { scheduled_date: "2026-01-01", estimated_time: 15 },
        { scheduled_date: "2026-01-02", estimated_time: 45 },
      ],
    });
    const load = await capacityService.getDayLoad(supabase, "user-1", "2026-01-01");
    expect(load.get("2026-01-01")).toBe(45);
    expect(load.get("2026-01-02")).toBe(45);
    expect(load.get("2026-01-03")).toBeUndefined();
  });

  it("allocateQuotas 按 priority → target_date → created_at 排序依次分配", () => {
    const quotas = capacityService.allocateQuotas(
      [
        { id: "p1", daily_minutes_target: 30, priority: 0, target_date: "2026-03-01" },
        { id: "p2", daily_minutes_target: 30, priority: 2 },
        { id: "p3", daily_minutes_target: 20, priority: 0, target_date: "2026-02-01" },
      ],
      60,
    );
    expect(quotas.get("p2")).toBe(30); // 高优先级先占
    expect(quotas.get("p3")).toBe(20); // 同级 target_date 早者优先
    expect(quotas.get("p1")).toBe(10); // 剩余预算
  });

  it("allocateQuotas 预算耗尽时保底 MIN_PATH_QUOTA_MINUTES", () => {
    const quotas = capacityService.allocateQuotas(
      [
        { id: "p1", daily_minutes_target: 60 },
        { id: "p2", daily_minutes_target: 30 },
      ],
      60,
    );
    expect(quotas.get("p1")).toBe(60);
    expect(quotas.get("p2")).toBe(MIN_PATH_QUOTA_MINUTES);
  });

  it("allocateQuotas 预算充足时各路径取自身目标", () => {
    const quotas = capacityService.allocateQuotas(
      [
        { id: "p1", daily_minutes_target: 30 },
        { id: "p2", daily_minutes_target: 20 },
      ],
      60,
    );
    expect(quotas.get("p1")).toBe(30);
    expect(quotas.get("p2")).toBe(20);
  });
});
