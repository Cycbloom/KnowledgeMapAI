interface GraphData {
  graph: Record<string, unknown> | null;
  nodes: Record<string, unknown>[];
  edges: Record<string, unknown>[];
  error: unknown;
}

interface DashboardData {
  graphs: Record<string, unknown>[];
  stats: {
    graphCount: number;
    nodeCount: number;
    totalFocusTime: number;
  };
  recentActivity: Record<string, unknown>[];
  error: unknown;
}

const API_URL = '/api';

const getHeaders = (): HeadersInit => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

const fetchApi = async <T>(endpoint: string, options: RequestInit = {}): Promise<{ data: T | null; error: unknown }> => {
  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        ...getHeaders(),
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { data: null, error: errorData.error || response.statusText };
    }

    const data = await response.json();
    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
};

export const queryOptimizer = {
  async getGraphWithData(graphId: string): Promise<GraphData> {
    const [graphResult, nodesResult] = await Promise.all([
      fetchApi<Record<string, unknown>>(`/graphs/${graphId}`),
      fetchApi<Record<string, unknown>[]>(`/graphs/${graphId}/nodes`),
    ]);

    const graph = graphResult.data;
    const nodes = nodesResult.data || [];
    const edges: Record<string, unknown>[] = [];

    nodes.forEach((node: Record<string, unknown>) => {
      if (node.outgoing_edges) {
        edges.push(...(node.outgoing_edges as Record<string, unknown>[]));
      }
    });

    return {
      graph,
      nodes,
      edges,
      error: graphResult.error || nodesResult.error,
    };
  },

  async getUserDashboardData(): Promise<DashboardData> {
    const [graphsResult, statsResult] = await Promise.all([
      fetchApi<Record<string, unknown>[]>('/graphs'),
      fetchApi<Record<string, unknown>>('/dashboard/overview'),
    ]);

    return {
      graphs: graphsResult.data || [],
      stats: {
        graphCount: (statsResult.data?.totalGraphs as number) || 0,
        nodeCount: (statsResult.data?.totalNodes as number) || 0,
        totalFocusTime: (statsResult.data?.weeklyStudyTime as number) || 0,
      },
      recentActivity: [],
      error: graphsResult.error || statsResult.error,
    };
  },

  async searchNodes(query: string, limit: number = 20): Promise<{ data: Record<string, unknown>[] | null; error: unknown }> {
    return fetchApi<Record<string, unknown>[]>(`/search?q=${encodeURIComponent(query)}&limit=${limit}`);
  },

  async getStudyQueue(limit: number = 50): Promise<{ data: Record<string, unknown>[] | null; error: unknown }> {
    return fetchApi<Record<string, unknown>[]>(`/study/cards?limit=${limit}`);
  },

  createCursorPaginator<T>(
    endpoint: string,
    options: {
      pageSize?: number;
      params?: Record<string, string>;
    } = {}
  ) {
    const { pageSize = 20, params = {} } = options;

    const buildUrl = (cursor?: string): string => {
      const urlParams = new URLSearchParams(params);
      urlParams.set('limit', String(pageSize + 1));
      if (cursor) {
        urlParams.set('cursor', cursor);
      }
      return `${endpoint}?${urlParams.toString()}`;
    };

    return {
      async getFirstPage(): Promise<{ data: T[] | null; cursor: string | null; error: unknown }> {
        const result = await fetchApi<{ items: T[]; nextCursor?: string }>(buildUrl());
        
        if (result.error || !result.data) {
          return { data: null, cursor: null, error: result.error };
        }

        return {
          data: result.data.items || [],
          cursor: result.data.nextCursor || null,
          error: null,
        };
      },

      async getNextPage(cursor: string): Promise<{ data: T[] | null; cursor: string | null; error: unknown }> {
        const result = await fetchApi<{ items: T[]; nextCursor?: string }>(buildUrl(cursor));
        
        if (result.error || !result.data) {
          return { data: null, cursor: null, error: result.error };
        }

        return {
          data: result.data.items || [],
          cursor: result.data.nextCursor || null,
          error: null,
        };
      },
    };
  },
};

export const prefetchRelated = async (graphId: string): Promise<void> => {
  const cache = await caches.open('knowledge-map-v1');

  const urls = [
    `/api/graphs/${graphId}/nodes`,
    `/api/graphs/${graphId}/node-status`,
  ];

  await Promise.all(
    urls.map(url =>
      cache.add(url).catch(() => {})
    )
  );
};
