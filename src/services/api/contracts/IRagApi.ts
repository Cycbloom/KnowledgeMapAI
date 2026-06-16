export interface IRagApi {
  chat(data: {
    message: string;
    graph_id?: string;
    current_node_id?: string;
    history?: Array<{ role: "user" | "assistant"; content: string }>;
    provider?: string;
    model?: string;
    language?: string;
    session_id?: string;
    use_graph_context?: boolean;
    graph_hops?: number;
  }): Promise<unknown>;

  chatStream(
    data: {
      message: string;
      graph_id?: string;
      current_node_id?: string;
      history?: Array<{ role: "user" | "assistant"; content: string }>;
      provider?: string;
      model?: string;
      language?: string;
      session_id?: string;
      use_graph_context?: boolean;
      graph_hops?: number;
    },
    onChunk: (content: string) => void,
    onSources?: (sources: Array<{ id: string; title: string; content: string; similarity: number }>) => void,
  ): Promise<void>;

  search(data: {
    query: string;
    graph_id?: string;
    match_threshold?: number;
    match_count?: number;
    use_graph_context?: boolean;
    graph_hops?: number;
  }): Promise<unknown>;

  analyzeGaps(graphId: string): Promise<unknown>;
}
