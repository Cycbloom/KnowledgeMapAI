import { describe, it, expect } from 'vitest';
import {
  LEVEL_ORDER,
  LEVEL_WEIGHTS,
  getNextLevel,
  getPreviousLevel,
  getLevelIndex,
} from '../levelUtils';

describe('levelUtils', () => {
  describe('LEVEL_ORDER', () => {
    it('按 root→core→sub→normal→leaf 排序', () => {
      expect(LEVEL_ORDER).toEqual(['root', 'core', 'sub', 'normal', 'leaf']);
    });
  });

  describe('getNextLevel', () => {
    it('root 的下一级是 core', () => {
      expect(getNextLevel('root')).toBe('core');
    });

    it('sub 的下一级是 normal', () => {
      expect(getNextLevel('sub')).toBe('normal');
    });

    it('leaf 已是最低级，返回 leaf', () => {
      expect(getNextLevel('leaf')).toBe('leaf');
    });

    it('未知层级返回 leaf', () => {
      expect(getNextLevel('unknown')).toBe('leaf');
    });
  });

  describe('getPreviousLevel', () => {
    it('core 的上一级是 root', () => {
      expect(getPreviousLevel('core')).toBe('root');
    });

    it('normal 的上一级是 sub', () => {
      expect(getPreviousLevel('normal')).toBe('sub');
    });

    it('root 已是最高级，返回 root', () => {
      expect(getPreviousLevel('root')).toBe('root');
    });

    it('未知层级返回 root', () => {
      expect(getPreviousLevel('unknown')).toBe('root');
    });
  });

  describe('getLevelIndex', () => {
    it('返回正确索引', () => {
      expect(getLevelIndex('root')).toBe(0);
      expect(getLevelIndex('sub')).toBe(2);
      expect(getLevelIndex('leaf')).toBe(4);
    });

    it('未知层级返回 -1', () => {
      expect(getLevelIndex('unknown')).toBe(-1);
    });
  });

  describe('LEVEL_WEIGHTS', () => {
    it('覆盖全部层级且权重从 root 到 leaf 递减', () => {
      expect(Object.keys(LEVEL_WEIGHTS)).toHaveLength(LEVEL_ORDER.length);
      for (let i = 0; i < LEVEL_ORDER.length - 1; i++) {
        expect(LEVEL_WEIGHTS[LEVEL_ORDER[i]]).toBeGreaterThan(
          LEVEL_WEIGHTS[LEVEL_ORDER[i + 1]],
        );
      }
    });
  });
});
