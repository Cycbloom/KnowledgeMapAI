import { describe, it, expect, beforeEach } from "vitest";
import { SubtaskStateMachine } from "../subtaskStateMachine";
import type {
  StateHistoryEntry,
} from "../../../../shared/types/scheduler";

describe("SubtaskStateMachine", () => {
  let stateMachine: SubtaskStateMachine;

  beforeEach(() => {
    stateMachine = new SubtaskStateMachine();
  });

  describe("getNextState", () => {
    describe("从 learning 状态转换", () => {
      it("learning + mastery < 30% → review", () => {
        expect(stateMachine.getNextState("learning", 0)).toBe("review");
        expect(stateMachine.getNextState("learning", 0.1)).toBe("review");
        expect(stateMachine.getNextState("learning", 0.29)).toBe("review");
      });

      it("learning + mastery 30-70% → practice", () => {
        expect(stateMachine.getNextState("learning", 0.3)).toBe("practice");
        expect(stateMachine.getNextState("learning", 0.5)).toBe("practice");
        expect(stateMachine.getNextState("learning", 0.69)).toBe("practice");
      });

      it("learning + mastery > 70% → quiz", () => {
        expect(stateMachine.getNextState("learning", 0.7)).toBe("quiz");
        expect(stateMachine.getNextState("learning", 0.8)).toBe("quiz");
        expect(stateMachine.getNextState("learning", 1.0)).toBe("quiz");
      });
    });

    describe("从 review 状态转换", () => {
      it("review 始终转换到 practice（复习完成后进入练习）", () => {
        expect(stateMachine.getNextState("review", 0)).toBe("practice");
        expect(stateMachine.getNextState("review", 0.3)).toBe("practice");
        expect(stateMachine.getNextState("review", 0.5)).toBe("practice");
        expect(stateMachine.getNextState("review", 1.0)).toBe("practice");
      });
    });

    describe("从 practice 状态转换", () => {
      it("practice + mastery < 70% → review", () => {
        expect(stateMachine.getNextState("practice", 0)).toBe("review");
        expect(stateMachine.getNextState("practice", 0.3)).toBe("review");
        expect(stateMachine.getNextState("practice", 0.69)).toBe("review");
      });

      it("practice + mastery >= 70% → quiz", () => {
        expect(stateMachine.getNextState("practice", 0.7)).toBe("quiz");
        expect(stateMachine.getNextState("practice", 0.8)).toBe("quiz");
        expect(stateMachine.getNextState("practice", 1.0)).toBe("quiz");
      });
    });

    describe("从 quiz 状态转换", () => {
      it("quiz + mastery < 50% → review", () => {
        expect(stateMachine.getNextState("quiz", 0)).toBe("review");
        expect(stateMachine.getNextState("quiz", 0.3)).toBe("review");
        expect(stateMachine.getNextState("quiz", 0.49)).toBe("review");
      });

      it("quiz + mastery 50-85% → practice", () => {
        expect(stateMachine.getNextState("quiz", 0.5)).toBe("practice");
        expect(stateMachine.getNextState("quiz", 0.7)).toBe("practice");
        expect(stateMachine.getNextState("quiz", 0.84)).toBe("practice");
      });

      it("quiz + mastery >= 85% → quiz（继续深化）", () => {
        expect(stateMachine.getNextState("quiz", 0.85)).toBe("quiz");
        expect(stateMachine.getNextState("quiz", 0.9)).toBe("quiz");
        expect(stateMachine.getNextState("quiz", 1.0)).toBe("quiz");
      });
    });
  });

  describe("canTransition", () => {
    it("相同状态转换返回 true", () => {
      expect(stateMachine.canTransition("learning", "learning")).toBe(true);
      expect(stateMachine.canTransition("review", "review")).toBe(true);
      expect(stateMachine.canTransition("practice", "practice")).toBe(true);
      expect(stateMachine.canTransition("quiz", "quiz")).toBe(true);
    });

    describe("learning 状态转换验证", () => {
      it("learning 可以转换到 review", () => {
        expect(stateMachine.canTransition("learning", "review")).toBe(true);
      });

      it("learning 可以转换到 practice", () => {
        expect(stateMachine.canTransition("learning", "practice")).toBe(true);
      });

      it("learning 可以转换到 quiz", () => {
        expect(stateMachine.canTransition("learning", "quiz")).toBe(true);
      });
    });

    describe("review 状态转换验证", () => {
      it("review 可以转换到 practice", () => {
        expect(stateMachine.canTransition("review", "practice")).toBe(true);
      });

      it("review 不能转换到 quiz", () => {
        expect(stateMachine.canTransition("review", "quiz")).toBe(false);
      });

      it("review 不能转换到 learning", () => {
        expect(stateMachine.canTransition("review", "learning")).toBe(false);
      });
    });

    describe("practice 状态转换验证", () => {
      it("practice 可以转换到 quiz", () => {
        expect(stateMachine.canTransition("practice", "quiz")).toBe(true);
      });

      it("practice 可以转换到 review", () => {
        expect(stateMachine.canTransition("practice", "review")).toBe(true);
      });

      it("practice 不能转换到 learning", () => {
        expect(stateMachine.canTransition("practice", "learning")).toBe(false);
      });
    });

    describe("quiz 状态转换验证", () => {
      it("quiz 可以转换到 review", () => {
        expect(stateMachine.canTransition("quiz", "review")).toBe(true);
      });

      it("quiz 可以转换到 practice", () => {
        expect(stateMachine.canTransition("quiz", "practice")).toBe(true);
      });

      it("quiz 不能转换到 learning", () => {
        expect(stateMachine.canTransition("quiz", "learning")).toBe(false);
      });
    });

    describe("循环状态转换验证", () => {
      it("支持 review → practice → quiz → review 循环", () => {
        expect(stateMachine.canTransition("review", "practice")).toBe(true);
        expect(stateMachine.canTransition("practice", "quiz")).toBe(true);
        expect(stateMachine.canTransition("quiz", "review")).toBe(true);
      });

      it("支持 quiz → practice → quiz 循环", () => {
        expect(stateMachine.canTransition("quiz", "practice")).toBe(true);
        expect(stateMachine.canTransition("practice", "quiz")).toBe(true);
      });
    });
  });

  describe("recordStateHistory", () => {
    it("正确记录状态变更历史", () => {
      const history: StateHistoryEntry[] = [];
      const newHistory = stateMachine.recordStateHistory(
        history,
        "learning",
        "review",
        20,
        25,
        "初始学习完成",
      );

      expect(newHistory).toHaveLength(1);
      expect(newHistory[0].from_state).toBe("learning");
      expect(newHistory[0].to_state).toBe("review");
      expect(newHistory[0].mastery_level_before).toBe(20);
      expect(newHistory[0].mastery_level_after).toBe(25);
      expect(newHistory[0].reason).toBe("初始学习完成");
      expect(newHistory[0].changed_at).toBeDefined();
    });

    it("追加到现有历史记录", () => {
      const existingHistory: StateHistoryEntry[] = [
        {
          from_state: "learning",
          to_state: "review",
          changed_at: "2024-01-01T00:00:00Z",
          mastery_level_before: 0,
          mastery_level_after: 20,
        },
      ];

      const newHistory = stateMachine.recordStateHistory(
        existingHistory,
        "review",
        "practice",
        20,
        50,
      );

      expect(newHistory).toHaveLength(2);
      expect(newHistory[0]).toEqual(existingHistory[0]);
      expect(newHistory[1].from_state).toBe("review");
      expect(newHistory[1].to_state).toBe("practice");
    });

    it("不限制历史记录数量（由调用方控制）", () => {
      const history: StateHistoryEntry[] = [];
      let currentHistory = history;

      for (let i = 0; i < 100; i++) {
        currentHistory = stateMachine.recordStateHistory(
          currentHistory,
          "review",
          "practice",
          i,
          i + 1,
        );
      }

      expect(currentHistory).toHaveLength(100);
    });

    it("记录无 reason 的状态变更", () => {
      const history: StateHistoryEntry[] = [];
      const newHistory = stateMachine.recordStateHistory(
        history,
        "practice",
        "quiz",
        70,
        75,
      );

      expect(newHistory[0].reason).toBeUndefined();
    });
  });

  describe("getValidTransitions", () => {
    it("返回 learning 的有效转换", () => {
      const transitions = stateMachine.getValidTransitions("learning");
      expect(transitions).toContain("review");
      expect(transitions).toContain("practice");
      expect(transitions).toContain("quiz");
      expect(transitions).toContain("learning");
    });

    it("返回 review 的有效转换", () => {
      const transitions = stateMachine.getValidTransitions("review");
      expect(transitions).toContain("practice");
      expect(transitions).toContain("review");
      expect(transitions).not.toContain("quiz");
      expect(transitions).not.toContain("learning");
    });

    it("返回 practice 的有效转换", () => {
      const transitions = stateMachine.getValidTransitions("practice");
      expect(transitions).toContain("quiz");
      expect(transitions).toContain("review");
      expect(transitions).toContain("practice");
      expect(transitions).not.toContain("learning");
    });

    it("返回 quiz 的有效转换", () => {
      const transitions = stateMachine.getValidTransitions("quiz");
      expect(transitions).toContain("review");
      expect(transitions).toContain("practice");
      expect(transitions).toContain("quiz");
      expect(transitions).not.toContain("learning");
    });
  });

  describe("getTransitionDescription", () => {
    it("返回有效的转换描述", () => {
      const desc = stateMachine.getTransitionDescription("learning", "review");
      expect(desc).toBe("scheduler.subtaskState.descriptions.masteryLowToReview");
    });

    it("返回 undefined 对于无效转换", () => {
      const desc = stateMachine.getTransitionDescription("review", "quiz");
      expect(desc).toBeUndefined();
    });
  });

  describe("isLearningCompleted", () => {
    it("历史中有 learning 状态返回 true", () => {
      const history: StateHistoryEntry[] = [
        {
          from_state: "learning",
          to_state: "review",
          changed_at: "2024-01-01T00:00:00Z",
          mastery_level_before: 0,
          mastery_level_after: 20,
        },
      ];
      expect(stateMachine.isLearningCompleted(history)).toBe(true);
    });

    it("历史中无 learning 状态返回 false", () => {
      const history: StateHistoryEntry[] = [
        {
          from_state: "review",
          to_state: "practice",
          changed_at: "2024-01-01T00:00:00Z",
          mastery_level_before: 20,
          mastery_level_after: 50,
        },
      ];
      expect(stateMachine.isLearningCompleted(history)).toBe(false);
    });

    it("空历史返回 false", () => {
      expect(stateMachine.isLearningCompleted([])).toBe(false);
    });
  });

  describe("getStateCyclePosition", () => {
    it("learning 返回 -1", () => {
      expect(stateMachine.getStateCyclePosition("learning")).toBe(-1);
    });

    it("review 返回 0", () => {
      expect(stateMachine.getStateCyclePosition("review")).toBe(0);
    });

    it("practice 返回 1", () => {
      expect(stateMachine.getStateCyclePosition("practice")).toBe(1);
    });

    it("quiz 返回 2", () => {
      expect(stateMachine.getStateCyclePosition("quiz")).toBe(2);
    });
  });

  describe("getRecommendedNextState", () => {
    it("首次 learning 返回基于掌握度的状态", () => {
      const history: StateHistoryEntry[] = [];
      expect(
        stateMachine.getRecommendedNextState("learning", 0.2, history),
      ).toBe("review");
      expect(
        stateMachine.getRecommendedNextState("learning", 0.5, history),
      ).toBe("practice");
      expect(
        stateMachine.getRecommendedNextState("learning", 0.8, history),
      ).toBe("quiz");
    });

    it("已完成 learning 后使用循环逻辑", () => {
      const history: StateHistoryEntry[] = [
        {
          from_state: "learning",
          to_state: "review",
          changed_at: "2024-01-01T00:00:00Z",
          mastery_level_before: 0,
          mastery_level_after: 20,
        },
      ];
      expect(
        stateMachine.getRecommendedNextState("learning", 20, history),
      ).toBe("review");
    });
  });

  describe("calculateMasteryProgress", () => {
    it("计算掌握度提升", () => {
      const result = stateMachine.calculateMasteryProgress(
        "review",
        "practice",
        30,
        50,
      );
      expect(result.improved).toBe(true);
      expect(result.improvementAmount).toBe(20);
      expect(result.stateProgress).toBe(1);
    });

    it("计算掌握度下降", () => {
      const result = stateMachine.calculateMasteryProgress(
        "practice",
        "review",
        50,
        30,
      );
      expect(result.improved).toBe(false);
      expect(result.improvementAmount).toBe(-20);
      expect(result.stateProgress).toBe(-1);
    });

    it("从 learning 到循环状态", () => {
      const result = stateMachine.calculateMasteryProgress(
        "learning",
        "review",
        0,
        20,
      );
      expect(result.improved).toBe(true);
      expect(result.improvementAmount).toBe(20);
      expect(result.stateProgress).toBe(1);
    });
  });

  describe("validateTransition", () => {
    it("learning → learning 无效", () => {
      const result = stateMachine.validateTransition(
        "learning",
        "learning",
        50,
      );
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Learning state can only occur once");
    });

    it("无效转换返回错误", () => {
      const result = stateMachine.validateTransition("review", "quiz", 50);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Invalid transition");
    });

    it("预期转换与实际不符时返回警告", () => {
      const result = stateMachine.validateTransition("learning", "review", 80);
      expect(result.valid).toBe(true);
      expect(result.warning).toContain("Expected transition to quiz");
    });

    it("有效转换无错误无警告", () => {
      const result = stateMachine.validateTransition("learning", "quiz", 80);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
      expect(result.warning).toBeUndefined();
    });
  });
});
