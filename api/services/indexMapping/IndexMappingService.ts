import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isIndexValue,
  resolveId,
  buildIndexMap,
  buildEntityIndexMap,
} from "../../../shared/utils/indexMapping";

export interface IndexContext {
  graphIndexMap: Map<number, string>;
  nodeIndexMap?: Map<number, string>;
  taskIndexMap?: Map<number, string>;
  learningPathIndexMap?: Map<number, string>;
  resolveGraphId: (idxOrId: string | number) => string;
  resolveNodeId?: (idxOrId: string | number) => string;
  resolveTaskId?: (idxOrId: string | number) => string;
  resolveLearningPathId?: (idxOrId: string | number) => string;
}

export class IndexMappingService {
  private static instance: IndexMappingService;
  private graphIndexCache: Map<string, Map<number, string>> = new Map();
  private nodeIndexCache: Map<string, Map<number, string>> = new Map();
  private taskIndexCache: Map<string, Map<number, string>> = new Map();
  private learningPathIndexCache: Map<string, Map<number, string>> = new Map();
  private cacheExpiry: Map<string, number> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000;

  private constructor() {}

  static getInstance(): IndexMappingService {
    if (!IndexMappingService.instance) {
      IndexMappingService.instance = new IndexMappingService();
    }
    return IndexMappingService.instance;
  }

  async buildGraphIndexMap(
    userId: string,
    supabase: SupabaseClient,
  ): Promise<Map<number, string>> {
    const cacheKey = `graphs:${userId}`;

    if (this.isCacheValid(cacheKey)) {
      const cached = this.graphIndexCache.get(cacheKey);
      if (cached) return cached;
    }

    const { data: graphs, error } = await supabase
      .from("knowledge_graphs")
      .select("id")
      .eq("user_id", userId)
      .is("deleted_at", null);

    if (error) {
      throw new Error(`Failed to build graph index map: ${error.message}`);
    }

    const indexMap = buildIndexMap(graphs || []);

    this.graphIndexCache.set(cacheKey, indexMap);
    this.cacheExpiry.set(cacheKey, Date.now() + this.CACHE_TTL);

    return indexMap;
  }

  async buildNodeIndexMap(
    graphId: string,
    supabase: SupabaseClient,
  ): Promise<Map<number, string>> {
    const cacheKey = `nodes:${graphId}`;

    if (this.isCacheValid(cacheKey)) {
      const cached = this.nodeIndexCache.get(cacheKey);
      if (cached) return cached;
    }

    const { data: nodes, error } = await supabase
      .from("graph_nodes")
      .select(
        `
        id,
        knowledge_points (id)
      `,
      )
      .eq("graph_id", graphId)
      .is("deleted_at", null);

    if (error) {
      throw new Error(`Failed to build node index map: ${error.message}`);
    }

    const indexMap = new Map<number, string>();
    (nodes || []).forEach((node, idx) => {
      const kp = node.knowledge_points as unknown as
        | { id: string }
        | { id: string }[]
        | null;
      const kpData = Array.isArray(kp) ? kp[0] : kp;
      if (kpData?.id) {
        indexMap.set(idx, kpData.id);
      }
    });

    this.nodeIndexCache.set(cacheKey, indexMap);
    this.cacheExpiry.set(cacheKey, Date.now() + this.CACHE_TTL);

    return indexMap;
  }

  async buildTaskIndexMap(
    userId: string,
    supabase: SupabaseClient,
  ): Promise<Map<number, string>> {
    const cacheKey = `tasks:${userId}`;

    if (this.isCacheValid(cacheKey)) {
      const cached = this.taskIndexCache.get(cacheKey);
      if (cached) return cached;
    }

    const { data: tasks, error } = await supabase
      .from("scheduled_tasks")
      .select("id")
      .eq("user_id", userId)
      .is("deleted_at", null);

    if (error) {
      throw new Error(`Failed to build task index map: ${error.message}`);
    }

    const indexMap = buildEntityIndexMap(tasks || []);

    this.taskIndexCache.set(cacheKey, indexMap);
    this.cacheExpiry.set(cacheKey, Date.now() + this.CACHE_TTL);

    return indexMap;
  }

  async buildLearningPathIndexMap(
    userId: string,
    supabase: SupabaseClient,
  ): Promise<Map<number, string>> {
    const cacheKey = `learningPaths:${userId}`;

    if (this.isCacheValid(cacheKey)) {
      const cached = this.learningPathIndexCache.get(cacheKey);
      if (cached) return cached;
    }

    const { data: learningPaths, error } = await supabase
      .from("learning_paths")
      .select("id")
      .eq("user_id", userId);

    if (error) {
      throw new Error(`Failed to build learning path index map: ${error.message}`);
    }

    const indexMap = buildEntityIndexMap(learningPaths || []);

    this.learningPathIndexCache.set(cacheKey, indexMap);
    this.cacheExpiry.set(cacheKey, Date.now() + this.CACHE_TTL);

    return indexMap;
  }

  resolveGraphId(
    idxOrUuid: string | number,
    indexMap: Map<number, string>,
  ): string {
    return resolveId(idxOrUuid, indexMap);
  }

  resolveNodeId(
    idxOrUuid: string | number,
    indexMap: Map<number, string>,
  ): string {
    return resolveId(idxOrUuid, indexMap);
  }

  resolveTaskId(
    idxOrUuid: string | number,
    indexMap: Map<number, string>,
  ): string {
    return resolveId(idxOrUuid, indexMap);
  }

  resolveLearningPathId(
    idxOrUuid: string | number,
    indexMap: Map<number, string>,
  ): string {
    return resolveId(idxOrUuid, indexMap);
  }

  isIndex(value: string | number): boolean {
    return isIndexValue(value);
  }

  clearCache(userId?: string): void {
    if (userId) {
      const keysToDelete: string[] = [];

      this.graphIndexCache.forEach((_, key) => {
        if (key.includes(userId)) keysToDelete.push(key);
      });

      this.nodeIndexCache.forEach((_, key) => {
        if (key.includes(userId)) keysToDelete.push(key);
      });

      this.taskIndexCache.forEach((_, key) => {
        if (key.includes(userId)) keysToDelete.push(key);
      });

      this.learningPathIndexCache.forEach((_, key) => {
        if (key.includes(userId)) keysToDelete.push(key);
      });

      keysToDelete.forEach((key) => {
        this.graphIndexCache.delete(key);
        this.nodeIndexCache.delete(key);
        this.taskIndexCache.delete(key);
        this.learningPathIndexCache.delete(key);
        this.cacheExpiry.delete(key);
      });
    } else {
      this.graphIndexCache.clear();
      this.nodeIndexCache.clear();
      this.taskIndexCache.clear();
      this.learningPathIndexCache.clear();
      this.cacheExpiry.clear();
    }
  }

  private isCacheValid(cacheKey: string): boolean {
    const expiry = this.cacheExpiry.get(cacheKey);
    if (!expiry) return false;
    return Date.now() < expiry;
  }

  async createIndexContext(
    userId: string,
    supabase: SupabaseClient,
    options?: {
      graphId?: string;
      includeTasks?: boolean;
      includeLearningPaths?: boolean;
    },
  ): Promise<IndexContext> {
    const graphIndexMap = await this.buildGraphIndexMap(userId, supabase);

    const context: IndexContext = {
      graphIndexMap,
      resolveGraphId: (idxOrId) => this.resolveGraphId(idxOrId, graphIndexMap),
    };

    if (options?.graphId) {
      const nodeIndexMap = await this.buildNodeIndexMap(options.graphId, supabase);
      context.nodeIndexMap = nodeIndexMap;
      context.resolveNodeId = (idxOrId) =>
        this.resolveNodeId(idxOrId, nodeIndexMap);
    }

    if (options?.includeTasks) {
      const taskIndexMap = await this.buildTaskIndexMap(userId, supabase);
      context.taskIndexMap = taskIndexMap;
      context.resolveTaskId = (idxOrId) =>
        this.resolveTaskId(idxOrId, taskIndexMap);
    }

    if (options?.includeLearningPaths) {
      const learningPathIndexMap = await this.buildLearningPathIndexMap(userId, supabase);
      context.learningPathIndexMap = learningPathIndexMap;
      context.resolveLearningPathId = (idxOrId) =>
        this.resolveLearningPathId(idxOrId, learningPathIndexMap);
    }

    return context;
  }
}

export const indexMappingService = IndexMappingService.getInstance();
