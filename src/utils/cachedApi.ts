import { dataCache, CacheKeys } from "./dataCache";
import { request } from "../services/api";

interface CachedApiOptions {
  ttl?: number;
  forceRefresh?: boolean;
}

const DEFAULT_TTL = 5 * 60 * 1000;

export const createCachedApi = <T>(
  key: string,
  fetchFn: () => Promise<T>,
  options: CachedApiOptions = {},
): Promise<T> => {
  const { ttl = DEFAULT_TTL, forceRefresh = false } = options;

  if (forceRefresh) {
    dataCache.delete(key);
  }

  return dataCache.getOrFetch(key, fetchFn, ttl);
};

export const cachedApi = {
  graphs: {
    list: (options?: CachedApiOptions) => {
      const userId = localStorage.getItem("userId") || "anonymous";
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
        options,
      );
    },

    get: (id: string, options?: CachedApiOptions) => {
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
        options,
      );
    },

    getNodes: (id: string, options?: CachedApiOptions) => {
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
        options,
      );
    },

    invalidate: (graphId: string) => {
      dataCache.delete(CacheKeys.GRAPH(graphId));
      dataCache.delete(CacheKeys.GRAPH_NODES(graphId));
      dataCache.delete(CacheKeys.GRAPH_EDGES(graphId));
      dataCache.delete(CacheKeys.STUDY_CARDS(graphId));
      dataCache.delete(CacheKeys.LEARNING_PATH(graphId));

      const userId = localStorage.getItem("userId") || "anonymous";
      dataCache.delete(CacheKeys.USER_GRAPHS(userId));
    },
  },

  templates: {
    list: (options?: CachedApiOptions) => {
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
        { ttl: 30 * 60 * 1000, ...options },
      );
    },

    get: (id: string, options?: CachedApiOptions) => {
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
        { ttl: 30 * 60 * 1000, ...options },
      );
    },

    invalidate: () => {
      dataCache.delete(CacheKeys.TEMPLATES());
    },
  },

  user: {
    getProfile: (userId: string, options?: CachedApiOptions) => {
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
        options,
      );
    },

    invalidate: (userId: string) => {
      dataCache.delete(CacheKeys.USER_PROFILE(userId));
      dataCache.delete(CacheKeys.USER_GRAPHS(userId));
    },
  },

  study: {
    getCards: (graphId: string, options?: CachedApiOptions) => {
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
        options,
      );
    },

    getLearningPath: (graphId: string, options?: CachedApiOptions) => {
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
        options,
      );
    },

    invalidate: (graphId: string) => {
      dataCache.delete(CacheKeys.STUDY_CARDS(graphId));
      dataCache.delete(CacheKeys.LEARNING_PATH(graphId));
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
