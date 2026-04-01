export const isIndexValue = (value: string | number): boolean => {
  if (typeof value === 'number') return true;
  if (typeof value === 'string') return /^\d+$/.test(value) && value.length < 10;
  return false;
};

export const resolveId = (
  idxOrId: string | number,
  indexMap: Map<number, string> | Record<string, string>
): string => {
  if (!isIndexValue(idxOrId)) {
    return String(idxOrId);
  }

  const idx = typeof idxOrId === 'number' ? idxOrId : parseInt(idxOrId, 10);

  if (indexMap instanceof Map) {
    return indexMap.get(idx) || String(idxOrId);
  }

  return indexMap[String(idx)] || String(idxOrId);
};

export const buildIndexMap = <T extends { id: string }>(
  items: T[]
): Map<number, string> => {
  const map = new Map<number, string>();
  items.forEach((item, idx) => map.set(idx, item.id));
  return map;
};

export const buildEntityIndexMap = <T extends { id: string }>(
  items: T[]
): Map<number, string> => {
  return buildIndexMap(items);
};

export const buildIndexMapFromTitles = <T extends { id: string; title: string }>(
  items: T[]
): Record<string, string> => {
  const map: Record<string, string> = {};
  items.forEach((item, idx) => {
    map[idx] = item.title;
  });
  return map;
};

export const buildReverseIndexMap = <T extends { id: string }>(
  items: T[]
): Map<string, number> => {
  const map = new Map<string, number>();
  items.forEach((item, idx) => map.set(item.id, idx));
  return map;
};

export const resolveMultipleIds = (
  ids: Array<string | number>,
  indexMap: Map<number, string> | Record<string, string>
): string[] => {
  return ids.map(id => resolveId(id, indexMap));
};

export const convertToIndexedResponse = <T extends { id: string }>(
  items: T[],
  getIdField: (item: T) => string = (item) => item.id
): {
  items: Array<Omit<T, 'id'> & { idx: number; id?: string }>;
  indexMap: Map<number, string>;
  reverseIndexMap: Map<string, number>;
} => {
  const indexMap = buildIndexMap(items);
  const reverseIndexMap = buildReverseIndexMap(items);
  
  const indexedItems = items.map((item, idx) => {
    const { id, ...rest } = item as any;
    return {
      ...rest,
      idx,
      id: getIdField(item)
    };
  });

  return {
    items: indexedItems,
    indexMap,
    reverseIndexMap
  };
};

export const mapRecordToMap = (record: Record<string, string>): Map<number, string> => {
  const map = new Map<number, string>();
  Object.entries(record).forEach(([key, value]) => {
    const idx = parseInt(key, 10);
    if (!isNaN(idx)) {
      map.set(idx, value);
    }
  });
  return map;
};

export const mapMapToRecord = (map: Map<number, string>): Record<string, string> => {
  const record: Record<string, string> = {};
  map.forEach((value, key) => {
    record[String(key)] = value;
  });
  return record;
};
