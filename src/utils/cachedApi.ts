import { dataCache, CacheKeys } from './dataCache';

interface CachedApiOptions {
  ttl?: number;
  forceRefresh?: boolean;
}

const DEFAULT_TTL = 5 * 60 * 1000;

export const createCachedApi = <T>(
  key: string,
  fetchFn: () => Promise<T>,
  options: CachedApiOptions = {}
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
      const userId = localStorage.getItem('userId') || 'anonymous';
      return createCachedApi(
        CacheKeys.USER_GRAPHS(userId),
        async () => {
          const response = await fetch('/api/graphs', {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${localStorage.getItem('token')}`,
            },
          });
          if (!response.ok) throw new Error('Failed to fetch graphs');
          return response.json();
        },
        options
      );
    },

    get: (id: string, options?: CachedApiOptions) => {
      return createCachedApi(
        CacheKeys.GRAPH(id),
        async () => {
          const response = await fetch(`/api/graphs/${id}`, {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${localStorage.getItem('token')}`,
            },
          });
          if (!response.ok) throw new Error('Failed to fetch graph');
          return response.json();
        },
        options
      );
    },

    getNodes: (id: string, options?: CachedApiOptions) => {
      return createCachedApi(
        CacheKeys.GRAPH_NODES(id),
        async () => {
          const response = await fetch(`/api/graphs/${id}/nodes`, {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${localStorage.getItem('token')}`,
            },
          });
          if (!response.ok) throw new Error('Failed to fetch nodes');
          return response.json();
        },
        options
      );
    },

    invalidate: (graphId: string) => {
      dataCache.delete(CacheKeys.GRAPH(graphId));
      dataCache.delete(CacheKeys.GRAPH_NODES(graphId));
      dataCache.delete(CacheKeys.GRAPH_EDGES(graphId));
      dataCache.delete(CacheKeys.STUDY_CARDS(graphId));
      dataCache.delete(CacheKeys.LEARNING_PATH(graphId));

      const userId = localStorage.getItem('userId') || 'anonymous';
      dataCache.delete(CacheKeys.USER_GRAPHS(userId));
    },
  },

  templates: {
    list: (options?: CachedApiOptions) => {
      return createCachedApi(
        CacheKeys.TEMPLATES(),
        async () => {
          const response = await fetch('/api/templates', {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${localStorage.getItem('token')}`,
            },
          });
          if (!response.ok) throw new Error('Failed to fetch templates');
          return response.json();
        },
        { ttl: 30 * 60 * 1000, ...options }
      );
    },

    get: (id: string, options?: CachedApiOptions) => {
      return createCachedApi(
        CacheKeys.TEMPLATE(id),
        async () => {
          const response = await fetch(`/api/templates/${id}`, {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${localStorage.getItem('token')}`,
            },
          });
          if (!response.ok) throw new Error('Failed to fetch template');
          return response.json();
        },
        { ttl: 30 * 60 * 1000, ...options }
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
          const response = await fetch('/api/auth/user', {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${localStorage.getItem('token')}`,
            },
          });
          if (!response.ok) throw new Error('Failed to fetch profile');
          return response.json();
        },
        options
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
          const response = await fetch(`/api/study/cards?graph_id=${graphId}`, {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${localStorage.getItem('token')}`,
            },
          });
          if (!response.ok) throw new Error('Failed to fetch study cards');
          return response.json();
        },
        options
      );
    },

    getLearningPath: (graphId: string, options?: CachedApiOptions) => {
      return createCachedApi(
        CacheKeys.LEARNING_PATH(graphId),
        async () => {
          const response = await fetch(`/api/learning-path/${graphId}`, {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${localStorage.getItem('token')}`,
            },
          });
          if (!response.ok) throw new Error('Failed to fetch learning path');
          return response.json();
        },
        options
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
