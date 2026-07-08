import { describe, it, expect, beforeEach } from "vitest";
import { SubtaskKnowledgeSyncService } from "../subtaskKnowledgeSync";
import type { LearningState } from "../../../../shared/types/scheduler";

describe("SubtaskKnowledgeSyncService", () => {
  let service: SubtaskKnowledgeSyncService;

  beforeEach(() => {
    service = new SubtaskKnowledgeSyncService();
  });

  describe("determineLearningState - 通过私有方法测试", () => {
    const testCases = [
      { mastery: 0.0, expected: "learning" as LearningState },
      { mastery: 0.1, expected: "learning" as LearningState },
      { mastery: 0.29, expected: "learning" as LearningState },
      { mastery: 0.3, expected: "review" as LearningState },
      { mastery: 0.4, expected: "review" as LearningState },
      { mastery: 0.49, expected: "review" as LearningState },
      { mastery: 0.5, expected: "practice" as LearningState },
      { mastery: 0.6, expected: "practice" as LearningState },
      { mastery: 0.69, expected: "practice" as LearningState },
      { mastery: 0.7, expected: "quiz" as LearningState },
      { mastery: 0.9, expected: "quiz" as LearningState },
      { mastery: 1.0, expected: "quiz" as LearningState },
    ];

    testCases.forEach(({ mastery, expected }) => {
      it(`掌握度 ${mastery} 映射到 ${expected}`, () => {
        const result = (service as any).determineLearningState(mastery);
        expect(result).toBe(expected);
      });
    });
  });

  describe("updateStateHistory - 通过私有方法测试", () => {
    it("正确记录状态变更历史", () => {
      const history: Array<{
        from_state: LearningState;
        to_state: LearningState;
        changed_at: string;
        mastery_level_before: number;
        mastery_level_after: number;
        reason?: string;
      }> = [];

      const newHistory = (service as any).updateStateHistory(
        history,
        "learning",
        "review",
        0.2,
        0.4,
      );

      expect(newHistory).toHaveLength(1);
      expect(newHistory[0].from_state).toBe("learning");
      expect(newHistory[0].to_state).toBe("review");
      expect(newHistory[0].mastery_level_before).toBe(0.2);
      expect(newHistory[0].mastery_level_after).toBe(0.4);
    });

    it("追加到现有历史记录", () => {
      const existingHistory = [
        {
          from_state: "learning" as LearningState,
          to_state: "review" as LearningState,
          changed_at: "2024-01-01T00:00:00Z",
          mastery_level_before: 0,
          mastery_level_after: 0.2,
        },
      ];

      const newHistory = (service as any).updateStateHistory(
        existingHistory,
        "review",
        "practice",
        0.2,
        0.5,
      );

      expect(newHistory).toHaveLength(2);
      expect(newHistory[0]).toEqual(existingHistory[0]);
      expect(newHistory[1].from_state).toBe("review");
      expect(newHistory[1].to_state).toBe("practice");
    });

    it("状态历史限制为50条", () => {
      const existingHistory = Array.from({ length: 60 }, (_, i) => ({
        from_state: "review" as LearningState,
        to_state: "practice" as LearningState,
        changed_at: new Date(Date.now() - i * 1000).toISOString(),
        mastery_level_before: 0.3 + i * 0.01,
        mastery_level_after: 0.4 + i * 0.01,
      }));

      const newHistory = (service as any).updateStateHistory(
        existingHistory,
        "practice",
        "quiz",
        0.7,
        0.8,
      );

      expect(newHistory.length).toBeLessThanOrEqual(50);
    });
  });

  describe("状态映射边界值测试", () => {
    it("边界值 0.3 正确映射到 review", () => {
      const result = (service as any).determineLearningState(0.3);
      expect(result).toBe("review");
    });

    it("边界值 0.5 正确映射到 practice", () => {
      const result = (service as any).determineLearningState(0.5);
      expect(result).toBe("practice");
    });

    it("边界值 0.7 正确映射到 quiz", () => {
      const result = (service as any).determineLearningState(0.7);
      expect(result).toBe("quiz");
    });

    it("接近边界值 0.299 映射到 learning", () => {
      const result = (service as any).determineLearningState(0.299);
      expect(result).toBe("learning");
    });

    it("接近边界值 0.499 映射到 review", () => {
      const result = (service as any).determineLearningState(0.499);
      expect(result).toBe("review");
    });

    it("接近边界值 0.699 映射到 practice", () => {
      const result = (service as any).determineLearningState(0.699);
      expect(result).toBe("practice");
    });
  });
});
