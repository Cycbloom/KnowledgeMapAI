import { describe, it, expect } from 'vitest';
import {
  reciprocalRankFusion,
  type RankedItem,
} from '../../utils/rrf';

/** 辅助函数：快速创建 RankedItem */
function item(id: string, score: number, data?: string): RankedItem<string> {
  return { id, score, data: data ?? id };
}

describe('reciprocalRankFusion', () => {
  describe('两路融合', () => {
    it('路 A 有 [id1, id2, id3]，路 B 有 [id3, id4]，验证融合排序正确', () => {
      // 路 A：id1 排名1, id2 排名2, id3 排名3
      const listA = [item('id1', 0.9), item('id2', 0.8), item('id3', 0.7)];
      // 路 B：id3 排名1, id4 排名2
      const listB = [item('id3', 0.85), item('id4', 0.6)];

      const result = reciprocalRankFusion([listA, listB]);

      // 计算 RRF 分数（k=60）：
      // id1: 1/(60+1) = 1/61 ≈ 0.01639
      // id2: 1/(60+2) = 1/62 ≈ 0.01613
      // id3: 1/(60+3) + 1/(60+1) = 1/63 + 1/61 ≈ 0.01587 + 0.01639 = 0.03226
      // id4: 1/(60+2) = 1/62 ≈ 0.01613
      // 排序：id3 > id1 > id2 ≈ id4（id2 和 id4 的 RRF 分数相同，均为 1/62）
      expect(result.length).toBe(4);
      expect(result[0].id).toBe('id3'); // id3 在两路均出现，RRF 分数最高
    });
  });

  describe('三路融合', () => {
    it('三路均有结果，验证融合正确', () => {
      const listA = [item('id1', 0.9), item('id2', 0.8)];
      const listB = [item('id2', 0.85), item('id3', 0.75)];
      const listC = [item('id1', 0.88), item('id3', 0.7)];

      const result = reciprocalRankFusion([listA, listB, listC]);

      // RRF 分数（k=60）：
      // id1: 1/(60+1) + 1/(60+1) = 2/61 ≈ 0.03279（路A排名1 + 路C排名1）
      // id2: 1/(60+2) + 1/(60+1) = 1/62 + 1/61 ≈ 0.03252（路A排名2 + 路B排名1）
      // id3: 1/(60+2) + 1/(60+2) = 2/62 ≈ 0.03226（路B排名2 + 路C排名2）
      expect(result.length).toBe(3);
      expect(result[0].id).toBe('id1'); // id1 RRF 分数最高
      expect(result[1].id).toBe('id2');
      expect(result[2].id).toBe('id3');
    });
  });

  describe('空路处理', () => {
    it('某路为空，其余路正常融合', () => {
      const listA = [item('id1', 0.9), item('id2', 0.8)];
      const listB: RankedItem<string>[] = []; // 空路
      const listC = [item('id3', 0.7)];

      const result = reciprocalRankFusion([listA, listB, listC]);

      // 空路不参与计算，等同于两路融合
      expect(result.length).toBe(3);
      // id1: 1/61, id2: 1/62, id3: 1/61
      // id1 和 id3 的 RRF 分数相同（均为 1/61），id2 为 1/62
      expect(result[result.length - 1].id).toBe('id2');
    });

    it('中间路为空不影响其他路', () => {
      const listA = [item('id1', 0.9)];
      const listB: RankedItem<string>[] = [];
      const listC = [item('id1', 0.8)];

      const result = reciprocalRankFusion([listA, listB, listC]);

      // id1 在路A排名1 + 路C排名1：RRF = 2/61
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('id1');
    });
  });

  describe('去重', () => {
    it('同一 id 在多路出现，RRF 分数为各路之和', () => {
      const listA = [item('id1', 0.9), item('id2', 0.7)];
      const listB = [item('id2', 0.95), item('id1', 0.6)];

      const result = reciprocalRankFusion([listA, listB]);

      // id1: 1/(60+1) + 1/(60+2) = 1/61 + 1/62 ≈ 0.03252
      // id2: 1/(60+2) + 1/(60+1) = 1/62 + 1/61 ≈ 0.03252
      // 两者的 RRF 分数相同（对称排名），结果去重为 2 条
      expect(result.length).toBe(2);
    });

    it('去重时保留最高 score', () => {
      const listA = [item('id1', 0.9, 'dataA')];
      const listB = [item('id1', 0.95, 'dataB')];

      const result = reciprocalRankFusion([listA, listB]);

      expect(result.length).toBe(1);
      expect(result[0].score).toBe(0.95); // 保留最高 score
      expect(result[0].data).toBe('dataB'); // 保留最高 score 对应的 data
    });

    it('去重时保留最高 score 对应的完整 data', () => {
      interface TestData {
        name: string;
        value: number;
      }
      const listA: RankedItem<TestData>[] = [
        { id: 'id1', score: 0.8, data: { name: 'A', value: 1 } },
      ];
      const listB: RankedItem<TestData>[] = [
        { id: 'id1', score: 0.95, data: { name: 'B', value: 2 } },
      ];

      const result = reciprocalRankFusion([listA, listB]);

      expect(result.length).toBe(1);
      expect(result[0].score).toBe(0.95);
      expect(result[0].data).toEqual({ name: 'B', value: 2 });
    });
  });

  describe('单路', () => {
    it('只有一路结果，RRF 排序与原始排序一致', () => {
      const listA = [item('id1', 0.9), item('id2', 0.8), item('id3', 0.7)];

      const result = reciprocalRankFusion([listA]);

      // 单路时 RRF 分数 = 1/(k+rank)，排名越高分数越大，顺序不变
      expect(result.length).toBe(3);
      expect(result[0].id).toBe('id1');
      expect(result[1].id).toBe('id2');
      expect(result[2].id).toBe('id3');
    });
  });

  describe('全空', () => {
    it('所有路为空，返回空数组', () => {
      const result = reciprocalRankFusion([[], [], []]);
      expect(result).toEqual([]);
    });

    it('传入空数组，返回空数组', () => {
      const result = reciprocalRankFusion([]);
      expect(result).toEqual([]);
    });
  });

  describe('自定义 k 值', () => {
    it('使用自定义 k 值计算 RRF 分数', () => {
      const listA = [item('id1', 0.9)];
      const listB = [item('id1', 0.8)];

      // k=1 时：id1 的 RRF = 1/(1+1) + 1/(1+1) = 1.0
      const result = reciprocalRankFusion([listA, listB], { k: 1 });
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('id1');
    });

    it('k 值越大，排名差异对 RRF 分数的影响越小', () => {
      const listA = [item('id1', 0.9), item('id2', 0.8)];
      // k=1 时：id1 = 1/2 = 0.5, id2 = 1/3 ≈ 0.333，差异明显
      // k=1000 时：id1 = 1/1001 ≈ 0.001, id2 = 1/1002 ≈ 0.000998，差异极小
      const resultSmallK = reciprocalRankFusion([listA], { k: 1 });
      const resultLargeK = reciprocalRankFusion([listA], { k: 1000 });

      // 两种情况下排序一致，但 k 越大排名影响越平缓
      expect(resultSmallK[0].id).toBe('id1');
      expect(resultLargeK[0].id).toBe('id1');
    });
  });

  describe('默认 k 值', () => {
    it('默认 k=60', () => {
      const listA = [item('id1', 0.9)];
      const result = reciprocalRankFusion([listA]);
      // 验证函数不报错，且结果正确
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('id1');
    });
  });
});
