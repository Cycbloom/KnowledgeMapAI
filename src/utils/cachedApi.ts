import { dataCache, CacheKeys } from "./dataCache";
import { request } from "../services/api";

interface CachedApiOptions {
  ttl?: number;
  forceRefresh?: boolean;
  tags?: string[];
}

const DEFAULT_TTL = 5 * 60 * 1000;

export const createCachedApi = <T>(
  key: string,
  fetchFn: () => Promise<T>,
  options: CachedApiOptions = {},
): Promise<T> => {
  const { ttl = DEFAULT_TTL, forceRefresh = false, tags } = options;

  if (forceRefresh) {
    dataCache.delete(key);
  }

  return dataCache.getOrFetch(key, fetchFn, ttl, tags);
};

export const cachedApi = {
  graphs: {
    list: (options?: CachedApiOptions) => {
      const userId = localStorage.getItem("userId") || "anonymous";
      const tags = [`user:${userId}`];
      return createCachedApi(
        CacheKeys.USER_GRAPHS(userId),
        async () => {
          return request("/graphs", {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
          });
        },
        { tags, ...options },
      );
    },

    get: (id: string, options?: CachedApiOptions) => {
      const tags = [`graph:${id}`];
      return createCachedApi(
        CacheKeys.GRAPH(id),
        async () => {
          return request(`/graphs/${id}`, {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
          });
        },
        { tags, ...options },
      );
    },

    getNodes: (id: string, options?: CachedApiOptions) => {
      const tags = [`graph:${id}`];
      return createCachedApi(
        CacheKeys.GRAPH_NODES(id),
        async () => {
          return request(`/graphs/${id}/nodes`, {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
          });
        },
        { tags, ...options },
      );
    },

    invalidate: (graphId: string) => {
      dataCache.deleteByTags([`graph:${graphId}`]);
      
      const userId = localStorage.getItem("userId") || "anonymous";
      dataCache.delete(CacheKeys.USER_GRAPHS(userId));
    },
  },

  templates: {
    list: (options?: CachedApiOptions) => {
      const tags = ['templates'];
      return createCachedApi(
        CacheKeys.TEMPLATES(),
        async () => {
          return request("/templates", {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
          });
        },
        { ttl: 30 * 60 * 1000, tags, ...options },
      );
    },

    get: (id: string, options?: CachedApiOptions) => {
      const tags = [`template:${id}`, 'templates'];
      return createCachedApi(
        CacheKeys.TEMPLATE(id),
        async () => {
          return request(`/templates/${id}`, {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
          });
        },
        { ttl: 30 * 60 * 1000, tags, ...options },
      );
    },

    invalidate: () => {
      dataCache.deleteByTags(['templates']);
    },
  },

  user: {
    getProfile: (userId: string, options?: CachedApiOptions) => {
      const tags = [`user:${userId}`];
      return createCachedApi(
        CacheKeys.USER_PROFILE(userId),
        async () => {
          return request("/auth/user", {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
          });
        },
        { tags, ...options },
      );
    },

    invalidate: (userId: string) => {
      dataCache.deleteByTags([`user:${userId}`]);
    },
  },

  study: {
    getCards: (graphId: string, options?: CachedApiOptions) => {
      const tags = [`graph:${graphId}`, 'study'];
      return createCachedApi(
        CacheKeys.STUDY_CARDS(graphId),
        async () => {
          return request(`/study/cards?graph_id=${graphId}`, {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
          });
        },
        { tags, ...options },
      );
    },

    getLearningPath: (graphId: string, options?: CachedApiOptions) => {
      const tags = [`graph:${graphId}`, 'study'];
      return createCachedApi(
        CacheKeys.LEARNING_PATH(graphId),
        async () => {
          return request(`/learning-path/${graphId}`, {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
          });
        },
        { tags, ...options },
      );
    },

    invalidate: (graphId: string) => {
      dataCache.deleteByTags([`graph:${graphId}`]);
    },
  },
};

export const invalidateAllCaches = () => {
  dataCache.clear();
};

export const prefetchGraphData = async (graphId: string): Promise<void> => {
  await Promise.all([
    cachedApi.graphs.get(graphId),
    cachedApi.graphs.getNodes(graphId),
  ]);
};
