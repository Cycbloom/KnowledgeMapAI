import { getMobileSupabaseClient } from '@/lib/supabase';

type RealtimeCallback<T> = (payload: {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: T | null;
  old: T | null;
}) => void;

type Subscription = {
  unsubscribe: () => void;
};

export const mobileRealtimeApi = {
  subscribeToGraphs: (callback: RealtimeCallback<any>): Subscription => {
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
            new: payload.new,
            old: payload.old,
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

  subscribeToGraph: (graphId: string, callback: RealtimeCallback<any>): Subscription => {
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
            new: payload.new,
            old: payload.old,
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

  subscribeToNodes: (graphId: string, callback: RealtimeCallback<any>): Subscription => {
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
            new: payload.new,
            old: payload.old,
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

  subscribeToEdges: (graphId: string, callback: RealtimeCallback<any>): Subscription => {
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
            new: payload.new,
            old: payload.old,
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

  subscribeToGraphData: (graphId: string, callback: RealtimeCallback<any>): Subscription => {
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
            new: payload.new,
            old: payload.old,
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
            new: payload.new,
            old: payload.old,
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
