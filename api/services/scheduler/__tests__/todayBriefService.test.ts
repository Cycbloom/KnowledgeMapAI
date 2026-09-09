import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockSupabase,
  type MockSupabaseClient,
} from "../../../../tests/helpers/mockFactories";

vi.mock("../schedulerDecisionService", () => ({
  schedulerDecisionService: {
    decideBigLoop: vi.fn(),
  },
}));

vi.mock("../planning/capacityService", () => ({
  capacityService: {
    getCapacitySettings: vi.fn(),
  },
}));

vi.mock("../planning/stageWindowPlannerService", () => ({
  stageWindowPlannerService: {
    getLaggingWindows: vi.fn(),
  },
}));

import { todayBriefService } from "../todayBriefService";
import { schedulerDecisionService } from "../schedulerDecisionService";
import { capacityService } from "../planning/capacityService";
import { stageWindowPlannerService } from "../planning/stageWindowPlannerService";

function buildMockSupabase(dataByFrom: Record<string, unknown>): MockSupabaseClient {
  const inner = createMockSupabase() as unknown as MockSupabaseClient;
  inner.from.mockImplementation((table: string) => {
    const data = dataByFrom[table] ?? null;
    const chainClient = createMockSupabase({ data }) as unknown as MockSupabaseClient;
    return chainClient._queryChain;
  });
  return inner;
}

describe("TodayBriefService", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(capacityService.getCapacitySettings).mockResolvedValue({
      dailyCapacityMinutes: 240,
      reviewBufferRatio: 0.2,
    });
    vi.mocked(stageWindowPlannerService.getLaggingWindows).mockResolvedValue([]);
    vi.mocked(schedulerDecisionService.decideBigLoop).mockResolvedValue({
      type: "empty",
      interrupted: false,
      reason: "当前没有到期复习，也没有进行中的学习大任务",
      overdueReviewCount: 0,
    } as never);
  });

  it("复习概览排除从未复习的新卡，只统计真正到期的复习卡", async () => {
    const supabase = buildMockSupabase({
      learning_path_schedule: [],
      study_cards: [
        { next_review: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), fsrs_state: "Review" },
        { next_review: new Date().toISOString(), fsrs_state: "Learning" },
        { next_review: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), fsrs_state: "New" },
        { next_review: new Date().toISOString(), fsrs_state: "New" },
      ],
    });

    const brief = await todayBriefService.getTodayBrief(supabase as never, "user-1");

    // Review 卡（逾期 1）+ Learning 卡（今日到期 1），两张 New 卡均不计入
    expect(brief.reviews).toEqual({ dueToday: 1, overdue: 1 });
  });
});
