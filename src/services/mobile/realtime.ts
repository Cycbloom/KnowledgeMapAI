import { getMobileSupabaseClient } from '@/lib/supabase';
import type { GraphNodeRow } from '@shared/types/database';
import type { Graph, Edge } from '@shared/types/graph';

type RealtimeCallback<T> = (payload: {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: T | null;
  old: T | null;
}) => void;

type Subscription = {
  unsubscribe: () => void;
};

export const mobileRealtimeApi = {
  subscribeToGraphs: (callback: RealtimeCallback<Graph>): Subscription => {
    const client = getMobileSupabaseClient();
    if (!client) {
      return { unsubscribe: () => {} };
    }

    const channel = client
      .channel('graphs-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'knowledge_graphs',
        },
        (payload) => {
          callback({
            eventType: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
            new: payload.new as Graph | null,
            old: payload.old as Graph | null,
          });
        },
      )
      .subscribe();

    return {
      unsubscribe: () => {
        channel.unsubscribe();
      },
    };
  },

  subscribeToGraph: (graphId: string, callback: RealtimeCallback<Graph>): Subscription => {
    const client = getMobileSupabaseClient();
    if (!client) {
      return { unsubscribe: () => {} };
    }

    const channel = client
      .channel(`graph-${graphId}-changes`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'knowledge_graphs',
          filter: `id=eq.${graphId}`,
        },
        (payload) => {
          callback({
            eventType: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
            new: payload.new as Graph | null,
            old: payload.old as Graph | null,
          });
        },
      )
      .subscribe();

    return {
      unsubscribe: () => {
        channel.unsubscribe();
      },
    };
  },

  subscribeToNodes: (graphId: string, callback: RealtimeCallback<GraphNodeRow>): Subscription => {
    const client = getMobileSupabaseClient();
    if (!client) {
      return { unsubscribe: () => {} };
    }

    const channel = client
      .channel(`nodes-${graphId}-changes`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'graph_nodes',
          filter: `graph_id=eq.${graphId}`,
        },
        (payload) => {
          callback({
            eventType: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
            new: payload.new as GraphNodeRow | null,
            old: payload.old as GraphNodeRow | null,
          });
        },
      )
      .subscribe();

    return {
      unsubscribe: () => {
        channel.unsubscribe();
      },
    };
  },

  subscribeToEdges: (graphId: string, callback: RealtimeCallback<Edge>): Subscription => {
    const client = getMobileSupabaseClient();
    if (!client) {
      return { unsubscribe: () => {} };
    }

    const channel = client
      .channel(`edges-${graphId}-changes`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'edges',
          filter: `graph_id=eq.${graphId}`,
        },
        (payload) => {
          callback({
            eventType: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
            new: payload.new as Edge | null,
            old: payload.old as Edge | null,
          });
        },
      )
      .subscribe();

    return {
      unsubscribe: () => {
        channel.unsubscribe();
      },
    };
  },

  subscribeToGraphData: (graphId: string, callback: RealtimeCallback<GraphNodeRow | Edge>): Subscription => {
    const client = getMobileSupabaseClient();
    if (!client) {
      return { unsubscribe: () => {} };
    }

    const channel = client
      .channel(`graph-data-${graphId}-changes`);

    channel
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'graph_nodes',
          filter: `graph_id=eq.${graphId}`,
        },
        (payload) => {
          callback({
            eventType: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
            new: payload.new as GraphNodeRow | null,
            old: payload.old as GraphNodeRow | null,
          });
        },
      );

    channel
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'edges',
          filter: `graph_id=eq.${graphId}`,
        },
        (payload) => {
          callback({
            eventType: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
            new: payload.new as Edge | null,
            old: payload.old as Edge | null,
          });
        },
      );

    channel.subscribe();

    return {
      unsubscribe: () => {
        channel.unsubscribe();
      },
    };
  },
};
