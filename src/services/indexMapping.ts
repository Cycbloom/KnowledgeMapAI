import { isIndexValue, resolveId, buildIndexMap, buildIndexMapFromTitles } from '../../shared/utils/indexMapping';

export interface GraphIndexData {
  id: string;
  title: string;
}

export interface NodeIndexData {
  id: string;
  title?: string;
}

class FrontendIndexMappingService {
  private graphIndexCache: Map<string, Map<number, string>> = new Map();
  private graphTitleCache: Map<string, Record<string, string>> = new Map();
  private cacheExpiry: Map<string, number> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000;

  isIndex(value: string | number): boolean {
    return isIndexValue(value);
  }

  resolveGraphId(
    idxOrId: string | number,
    indexMap: Map<number, string> | Record<string, string>
  ): string {
    return resolveId(idxOrId, indexMap);
  }

  buildIndexMapFromData<T extends { id: string }>(items: T[]): Map<number, string> {
    return buildIndexMap(items);
  }

  buildTitleMapFromData<T extends { id: string; title: string }>(items: T[]): Record<string, string> {
    return buildIndexMapFromTitles(items);
  }

  buildGraphIndexMap(graphs: GraphIndexData[]): Map<number, string> {
    return buildIndexMap(graphs);
  }

  buildNodeIndexMap(nodes: NodeIndexData[]): Map<number, string> {
    return buildIndexMap(nodes);
  }

  getCachedGraphIndexMap(cacheKey: string): Map<number, string> | undefined {
    if (this.isCacheValid(cacheKey)) {
      return this.graphIndexCache.get(cacheKey);
    }
    return undefined;
  }

  setCachedGraphIndexMap(cacheKey: string, indexMap: Map<number, string>): void {
    this.graphIndexCache.set(cacheKey, indexMap);
    this.cacheExpiry.set(cacheKey, Date.now() + this.CACHE_TTL);
  }

  getCachedTitleMap(cacheKey: string): Record<string, string> | undefined {
    if (this.isCacheValid(cacheKey)) {
      return this.graphTitleCache.get(cacheKey);
    }
    return undefined;
  }

  setCachedTitleMap(cacheKey: string, titleMap: Record<string, string>): void {
    this.graphTitleCache.set(cacheKey, titleMap);
    this.cacheExpiry.set(cacheKey, Date.now() + this.CACHE_TTL);
  }

  clearCache(cacheKey?: string): void {
    if (cacheKey) {
      this.graphIndexCache.delete(cacheKey);
      this.graphTitleCache.delete(cacheKey);
      this.cacheExpiry.delete(cacheKey);
    } else {
      this.graphIndexCache.clear();
      this.graphTitleCache.clear();
      this.cacheExpiry.clear();
    }
  }

  createGraphIdToIdxMap(graphs: GraphIndexData[]): Map<string, number> {
    const map = new Map<string, number>();
    graphs.forEach((graph, idx) => {
      map.set(graph.id, idx);
    });
    return map;
  }

  createGraphIdxToTitleMap(graphs: GraphIndexData[]): Record<string, string> {
    return buildIndexMapFromTitles(graphs);
  }

  private isCacheValid(cacheKey: string): boolean {
    const expiry = this.cacheExpiry.get(cacheKey);
    if (!expiry) return false;
    return Date.now() < expiry;
  }
}

export const indexMappingService = new FrontendIndexMappingService();

export { isIndexValue, resolveId, buildIndexMap, buildIndexMapFromTitles };
