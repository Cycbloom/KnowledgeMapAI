import { describe, it, expect, beforeEach, vi } from "vitest";
import { MasteryDecayService } from "../masteryDecayService";

function daysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

describe("MasteryDecayService", () => {
  let service: MasteryDecayService;

  beforeEach(() => {
    service = new MasteryDecayService();
  });

  describe("calculateDecay", () => {
    it("刚学习完不衰减（0天后）", () => {
      const today = new Date();
      const result = service.calculateDecay(0.8, today, 2.5);
      expect(result).toBe(0.8);
    });

    it("1天后衰减计算正确", () => {
      const oneDayAgo = daysAgo(1);
      const result = service.calculateDecay(0.8, oneDayAgo, 2.5);
      expect(result).toBeLessThan(0.8);
      expect(result).toBeGreaterThan(0.7);
    });

    it("7天后衰减计算正确", () => {
      const sevenDaysAgo = daysAgo(7);
      const result = service.calculateDecay(0.8, sevenDaysAgo, 2.5);
      expect(result).toBeLessThan(0.8);
      expect(result).toBeGreaterThan(0.4);
    });

    it("30天后衰减计算正确", () => {
      const thirtyDaysAgo = daysAgo(30);
      const result = service.calculateDecay(0.8, thirtyDaysAgo, 2.5);
      expect(result).toBeLessThan(0.5);
      expect(result).toBeGreaterThanOrEqual(0);
    });

    it("easeFactor 影响衰减速度 - 高 easeFactor 衰减慢", () => {
      const sevenDaysAgo = daysAgo(7);
      const resultLowEase = service.calculateDecay(0.8, sevenDaysAgo, 1.3);
      const resultHighEase = service.calculateDecay(0.8, sevenDaysAgo, 3.0);
      expect(resultHighEase).toBeGreaterThan(resultLowEase);
    });

    it("easeFactor 影响衰减速度 - 低 easeFactor 衰减快", () => {
      const fourteenDaysAgo = daysAgo(14);
      const resultLowEase = service.calculateDecay(0.9, fourteenDaysAgo, 1.3);
      const resultHighEase = service.calculateDecay(0.9, fourteenDaysAgo, 3.0);
      expect(resultLowEase).toBeLessThan(resultHighEase);
    });

    it("掌握度边界值处理 - 负数变为0", () => {
      const today = new Date();
      const result = service.calculateDecay(-0.5, today, 2.5);
      expect(result).toBe(0);
    });

    it("掌握度边界值处理 - 大于1变为1", () => {
      const today = new Date();
      const result = service.calculateDecay(1.5, today, 2.5);
      expect(result).toBe(1);
    });

    it("easeFactor 最小值限制", () => {
      const sevenDaysAgo = daysAgo(7);
      const resultBelowMin = service.calculateDecay(0.8, sevenDaysAgo, 0.5);
      const resultAtMin = service.calculateDecay(0.8, sevenDaysAgo, 1.3);
      expect(resultBelowMin).toBe(resultAtMin);
    });

    it("长期不复习掌握度接近0", () => {
      const longTimeAgo = daysAgo(365);
      const result = service.calculateDecay(0.9, longTimeAgo, 2.5);
      expect(result).toBeLessThan(0.1);
    });
  });

  describe("needsReview", () => {
    it("掌握度低于阈值返回 true", () => {
      expect(service.needsReview(0.3, 0.5)).toBe(true);
      expect(service.needsReview(0.49, 0.5)).toBe(true);
      expect(service.needsReview(0.0, 0.5)).toBe(true);
    });

    it("掌握度高于阈值返回 false", () => {
      expect(service.needsReview(0.5, 0.5)).toBe(false);
      expect(service.needsReview(0.6, 0.5)).toBe(false);
      expect(service.needsReview(1.0, 0.5)).toBe(false);
    });

    it("使用默认阈值", () => {
      expect(service.needsReview(0.4)).toBe(true);
      expect(service.needsReview(0.6)).toBe(false);
    });
  });

  describe("calculateRetentionRate", () => {
    it("0天保留率100%", () => {
      const rate = service.calculateRetentionRate(0, 2.5);
      expect(rate).toBeCloseTo(1, 5);
    });

    it("保留率随时间递减", () => {
      const rate1 = service.calculateRetentionRate(1, 2.5);
      const rate7 = service.calculateRetentionRate(7, 2.5);
      const rate30 = service.calculateRetentionRate(30, 2.5);
      expect(rate1).toBeGreaterThan(rate7);
      expect(rate7).toBeGreaterThan(rate30);
    });

    it("高 easeFactor 有更高保留率", () => {
      const rateLow = service.calculateRetentionRate(7, 1.3);
      const rateHigh = service.calculateRetentionRate(7, 3.0);
      expect(rateHigh).toBeGreaterThan(rateLow);
    });
  });

  describe("estimateDaysUntilThreshold", () => {
    it("已低于阈值返回0", () => {
      const days = service.estimateDaysUntilThreshold(0.3, 2.5, 0.5);
      expect(days).toBe(0);
    });

    it("计算到达阈值的天数", () => {
      const days = service.estimateDaysUntilThreshold(0.8, 2.5, 0.5);
      expect(days).toBeGreaterThan(0);
      expect(typeof days).toBe("number");
    });

    it("高掌握度需要更多天数", () => {
      const daysLow = service.estimateDaysUntilThreshold(0.6, 2.5, 0.5);
      const daysHigh = service.estimateDaysUntilThreshold(0.9, 2.5, 0.5);
      expect(daysHigh).toBeGreaterThan(daysLow);
    });

    it("高 easeFactor 需要更多天数", () => {
      const daysLow = service.estimateDaysUntilThreshold(0.8, 1.3, 0.5);
      const daysHigh = service.estimateDaysUntilThreshold(0.8, 3.0, 0.5);
      expect(daysHigh).toBeGreaterThan(daysLow);
    });
  });

  describe("getDecayConfig / setDecayConfig", () => {
    it("获取默认配置", () => {
      const config = service.getDecayConfig();
      expect(config.reviewThreshold).toBe(0.5);
      expect(config.minMastery).toBe(0);
      expect(config.decayBaseFactor).toBe(10);
    });

    it("更新配置", () => {
      service.setDecayConfig({ reviewThreshold: 0.6 });
      const config = service.getDecayConfig();
      expect(config.reviewThreshold).toBe(0.6);
      expect(config.decayBaseFactor).toBe(10);
    });

    it("部分更新配置保留其他值", () => {
      service.setDecayConfig({ decayBaseFactor: 20 });
      const config = service.getDecayConfig();
      expect(config.decayBaseFactor).toBe(20);
      expect(config.reviewThreshold).toBe(0.5);
    });
  });

  describe("自定义配置构造", () => {
    it("使用自定义配置创建服务", () => {
      const customService = new MasteryDecayService({
        reviewThreshold: 0.7,
        decayBaseFactor: 15,
      });
      const config = customService.getDecayConfig();
      expect(config.reviewThreshold).toBe(0.7);
      expect(config.decayBaseFactor).toBe(15);
    });
  });

  describe("衰减算法数学验证", () => {
    it("衰减公式符合艾宾浩斯遗忘曲线", () => {
      const mastery = 0.8;
      const easeFactor = 2.5;
      const decayBaseFactor = 10;

      const retention1Day = Math.pow(
        Math.E,
        -1 / (easeFactor * decayBaseFactor),
      );
      const expected1Day = mastery * retention1Day;
      const result1Day = service.calculateDecay(
        mastery,
        daysAgo(1),
        easeFactor,
      );
      expect(result1Day).toBeCloseTo(expected1Day, 2);

      const retention7Days = Math.pow(
        Math.E,
        -7 / (easeFactor * decayBaseFactor),
      );
      const expected7Days = mastery * retention7Days;
      const result7Days = service.calculateDecay(
        mastery,
        daysAgo(7),
        easeFactor,
      );
      expect(result7Days).toBeCloseTo(expected7Days, 2);
    });

    it("衰减后掌握度不会低于最小值", () => {
      const serviceWithMinMastery = new MasteryDecayService({
        minMastery: 0.1,
      });
      const result = serviceWithMinMastery.calculateDecay(
        0.9,
        daysAgo(365),
        1.3,
      );
      expect(result).toBeGreaterThanOrEqual(0.1);
    });
  });
});
