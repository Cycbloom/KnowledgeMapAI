import { describe, it, expect } from 'vitest';
import {
  isIndexValue,
  resolveId,
  buildIndexMap,
  buildEntityIndexMap,
  buildIndexMapFromTitles,
  buildReverseIndexMap,
  resolveMultipleIds,
  convertToIndexedResponse,
  mapRecordToMap,
  mapMapToRecord,
} from '../indexMapping';

describe('indexMapping', () => {
  describe('isIndexValue', () => {
    it('数字返回 true', () => {
      expect(isIndexValue(0)).toBe(true);
      expect(isIndexValue(1)).toBe(true);
      expect(isIndexValue(100)).toBe(true);
    });

    it('纯数字字符串（长度 < 10）返回 true', () => {
      expect(isIndexValue('0')).toBe(true);
      expect(isIndexValue('1')).toBe(true);
      expect(isIndexValue('123')).toBe(true);
      expect(isIndexValue('123456789')).toBe(true); // 9 位
    });

    it('纯数字字符串长度 >= 10 返回 false', () => {
      expect(isIndexValue('1234567890')).toBe(false); // 10 位
      expect(isIndexValue('12345678901')).toBe(false); // 11 位
    });

    it('非数字字符串返回 false', () => {
      expect(isIndexValue('abc')).toBe(false);
      expect(isIndexValue('1a2b')).toBe(false);
      expect(isIndexValue('')).toBe(false);
      expect(isIndexValue('node-1')).toBe(false);
    });

    it('UUID 返回 false', () => {
      expect(isIndexValue('550e8400-e29b-41d4-a716-446655440000')).toBe(false);
    });
  });

  describe('buildIndexMap', () => {
    it('从 items 构建索引→id 映射', () => {
      const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
      const map = buildIndexMap(items);
      expect(map.get(0)).toBe('a');
      expect(map.get(1)).toBe('b');
      expect(map.get(2)).toBe('c');
    });

    it('空数组返回空 Map', () => {
      const map = buildIndexMap([]);
      expect(map.size).toBe(0);
    });

    it('保留重复 id（不去重）', () => {
      const items = [{ id: 'a' }, { id: 'a' }];
      const map = buildIndexMap(items);
      expect(map.size).toBe(2);
      expect(map.get(0)).toBe('a');
      expect(map.get(1)).toBe('a');
    });
  });

  describe('buildEntityIndexMap', () => {
    it('与 buildIndexMap 行为一致', () => {
      const items = [{ id: 'x' }, { id: 'y' }];
      const map = buildEntityIndexMap(items);
      expect(map.get(0)).toBe('x');
      expect(map.get(1)).toBe('y');
    });
  });

  describe('buildIndexMapFromTitles', () => {
    it('从 items 构建索引→title 映射', () => {
      const items = [
        { id: 'a', title: '标题A' },
        { id: 'b', title: '标题B' },
      ];
      const record = buildIndexMapFromTitles(items);
      expect(record['0']).toBe('标题A');
      expect(record['1']).toBe('标题B');
    });

    it('空数组返回空对象', () => {
      const record = buildIndexMapFromTitles([]);
      expect(Object.keys(record)).toHaveLength(0);
    });
  });

  describe('buildReverseIndexMap', () => {
    it('从 items 构建 id→索引 映射', () => {
      const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
      const map = buildReverseIndexMap(items);
      expect(map.get('a')).toBe(0);
      expect(map.get('b')).toBe(1);
      expect(map.get('c')).toBe(2);
    });

    it('空数组返回空 Map', () => {
      const map = buildReverseIndexMap([]);
      expect(map.size).toBe(0);
    });

    it('重复 id 后者覆盖前者索引', () => {
      const items = [{ id: 'a' }, { id: 'a' }];
      const map = buildReverseIndexMap(items);
      expect(map.size).toBe(1);
      expect(map.get('a')).toBe(1); // 后者覆盖
    });
  });

  describe('resolveId', () => {
    it('数字索引在 Map 中解析为对应 id', () => {
      const map = new Map<number, string>([[0, 'a'], [1, 'b']]);
      expect(resolveId(0, map)).toBe('a');
      expect(resolveId(1, map)).toBe('b');
    });

    it('数字字符串索引在 Map 中解析为对应 id', () => {
      const map = new Map<number, string>([[0, 'a'], [1, 'b']]);
      expect(resolveId('0', map)).toBe('a');
      expect(resolveId('1', map)).toBe('b');
    });

    it('数字索引在 Record 中解析为对应 id', () => {
      const record: Record<string, string> = { '0': 'a', '1': 'b' };
      expect(resolveId(0, record)).toBe('a');
      expect(resolveId(1, record)).toBe('b');
    });

    it('非索引值（UUID）直接返回字符串形式', () => {
      const map = new Map<number, string>();
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      expect(resolveId(uuid, map)).toBe(uuid);
    });

    it('索引不在 Map 中时返回原值的字符串形式', () => {
      const map = new Map<number, string>([[0, 'a']]);
      expect(resolveId(99, map)).toBe('99');
      expect(resolveId('99', map)).toBe('99');
    });

    it('索引不在 Record 中时返回原值的字符串形式', () => {
      const record: Record<string, string> = { '0': 'a' };
      expect(resolveId(99, record)).toBe('99');
    });

    it('长度 >= 10 的数字字符串视为 id 而非索引', () => {
      const map = new Map<number, string>();
      const longNum = '1234567890'; // 10 位
      expect(resolveId(longNum, map)).toBe('1234567890');
    });
  });

  describe('resolveMultipleIds', () => {
    it('批量解析索引为 id', () => {
      const map = new Map<number, string>([[0, 'a'], [1, 'b'], [2, 'c']]);
      const result = resolveMultipleIds([0, 1, 2], map);
      expect(result).toEqual(['a', 'b', 'c']);
    });

    it('混合索引与 id', () => {
      const map = new Map<number, string>([[0, 'a'], [1, 'b']]);
      const result = resolveMultipleIds([0, 'uuid-1', 1], map);
      expect(result).toEqual(['a', 'uuid-1', 'b']);
    });

    it('空数组返回空数组', () => {
      const map = new Map<number, string>();
      expect(resolveMultipleIds([], map)).toEqual([]);
    });
  });

  describe('convertToIndexedResponse', () => {
    it('将 items 转换为带 idx 的响应', () => {
      const items = [
        { id: 'a', name: 'A' },
        { id: 'b', name: 'B' },
      ];
      const result = convertToIndexedResponse(items);
      expect(result.items).toHaveLength(2);
      expect(result.items[0].idx).toBe(0);
      expect(result.items[1].idx).toBe(1);
      // id 字段保留（由 getIdField 默认返回 item.id）
      expect(result.items[0].id).toBe('a');
      expect(result.items[1].id).toBe('b');
    });

    it('构建 indexMap 与 reverseIndexMap', () => {
      const items = [{ id: 'a' }, { id: 'b' }];
      const result = convertToIndexedResponse(items);
      expect(result.indexMap.get(0)).toBe('a');
      expect(result.indexMap.get(1)).toBe('b');
      expect(result.reverseIndexMap.get('a')).toBe(0);
      expect(result.reverseIndexMap.get('b')).toBe(1);
    });

    it('空数组返回空 items 与空 map', () => {
      const result = convertToIndexedResponse([]);
      expect(result.items).toHaveLength(0);
      expect(result.indexMap.size).toBe(0);
      expect(result.reverseIndexMap.size).toBe(0);
    });

    it('自定义 getIdField', () => {
      const items = [
        { id: 'a', code: 'X001' },
        { id: 'b', code: 'X002' },
      ];
      const result = convertToIndexedResponse(items, (item) => item.code);
      expect(result.items[0].id).toBe('X001');
      expect(result.items[1].id).toBe('X002');
      // indexMap 仍使用原 id
      expect(result.indexMap.get(0)).toBe('a');
    });
  });

  describe('mapRecordToMap', () => {
    it('将 Record 转为 Map', () => {
      const record: Record<string, string> = { '0': 'a', '1': 'b', '2': 'c' };
      const map = mapRecordToMap(record);
      expect(map.get(0)).toBe('a');
      expect(map.get(1)).toBe('b');
      expect(map.get(2)).toBe('c');
    });

    it('空 Record 返回空 Map', () => {
      const map = mapRecordToMap({});
      expect(map.size).toBe(0);
    });

    it('忽略非数字 key', () => {
      const record: Record<string, string> = {
        '0': 'a',
        abc: 'b',
        '1': 'c',
      };
      const map = mapRecordToMap(record);
      expect(map.size).toBe(2);
      expect(map.get(0)).toBe('a');
      expect(map.get(1)).toBe('c');
    });
  });

  describe('mapMapToRecord', () => {
    it('将 Map 转为 Record', () => {
      const map = new Map<number, string>([[0, 'a'], [1, 'b'], [2, 'c']]);
      const record = mapMapToRecord(map);
      expect(record['0']).toBe('a');
      expect(record['1']).toBe('b');
      expect(record['2']).toBe('c');
    });

    it('空 Map 返回空对象', () => {
      const record = mapMapToRecord(new Map<number, string>());
      expect(Object.keys(record)).toHaveLength(0);
    });
  });

  describe('Record 与 Map 互转', () => {
    it('Record → Map → Record 往返一致', () => {
      const original: Record<string, string> = {
        '0': 'a',
        '1': 'b',
        '2': 'c',
      };
      const map = mapRecordToMap(original);
      const roundTrip = mapMapToRecord(map);
      expect(roundTrip).toEqual(original);
    });

    it('Map → Record → Map 往返一致', () => {
      const original = new Map<number, string>([
        [0, 'a'],
        [1, 'b'],
        [2, 'c'],
      ]);
      const record = mapMapToRecord(original);
      const roundTrip = mapRecordToMap(record);
      expect(roundTrip.get(0)).toBe('a');
      expect(roundTrip.get(1)).toBe('b');
      expect(roundTrip.get(2)).toBe('c');
      expect(roundTrip.size).toBe(original.size);
    });
  });
});
