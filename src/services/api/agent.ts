import { request, getHeaders, getApiUrl } from "./client";

export type RelationType =
  | "prerequisite"
  | "extension"
  | "related"
  | "cross_domain";

export interface GraphRecommendation {
  id: string;
  source_graph_idx: number;
  source_graph_title: string;
  target_graph_idx: number;
  target_graph_title: string;
  relation_type: RelationType;
  reason: string;
  confidence: number;
}

export interface MergeSuggestion {
  graph_ids: string[];
  graph_titles: string[];
  similarity_score: number;
  reason: string;
  suggested_action: "merge" | "link" | "keep_separate";
  shared_concepts: string[];
}

export interface StructuredAnalysisResult {
  summary: string;
  recommendations: GraphRecommendation[];
  merge_suggestions?: MergeSuggestion[];
  graphIndex?: Record<string, string>;
}

export interface AgentSession {
  id: string;
  userId: string;
  status: "pending" | "running" | "completed" | "failed" | "interrupted" | "awaiting_confirmation";
  skillId?: string;
  graphIds?: string[];
  messages: AgentMessage[];
  toolCalls: ToolCall[];
  result?: string;
  structuredResult?: StructuredAnalysisResult;
  createdAt: string;
  updatedAt: string;
}

export interface AgentMessage {
  id: string;
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  toolResult?: unknown;
  timestamp: string;
}

export interface ToolCall {
  id: string;
  toolName: string;
  args: Record<string, unknown>;
  result?: unknown;
  status: "pending" | "running" | "completed" | "failed";
  timestamp: string;
}

export interface SkillDefinition {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  userPromptTemplate: string;
  tools: string[];
  allowWrite?: boolean;
}

export interface AnalysisGoal {
  type: string;
  description: string;
  constraints?: Record<string, unknown>;
  maxIterations?: number;
}

export interface ExecuteResult {
  success: boolean;
  session: AgentSession;
  error?: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export type PendingActionStatus =
  | "pending"
  | "confirmed"
  | "rejected"
  | "expired"
  | "executed"
  | "failed";

export type ToolCategory = "read" | "write";
export type RiskLevel = "low" | "medium" | "high";

export interface PendingAction {
  id: string;
  sessionId: string;
  toolName: string;
  args: Record<string, unknown>;
  category: ToolCategory;
  riskLevel: RiskLevel;
  description: string;
  status: PendingActionStatus;
  result?: unknown;
  createdAt: string;
  executedAt?: string;
}

export type AgentSSEEventType =
  | "tool_call_start"
  | "tool_call_result"
  | "agent_message"
  | "awaiting_confirmation"
  | "session_completed"
  | "session_failed";

export interface AgentSSEEvent {
  type: AgentSSEEventType;
  data: unknown;
}

export interface ToolCallStartData {
  toolName: string;
  args: Record<string, unknown>;
}

export interface ToolCallResultData {
  toolName: string;
  result: unknown;
}

export interface AgentMessageData {
  content: string;
}

export interface AwaitingConfirmationData {
  pendingActions: PendingAction[];
}

export interface SessionCompletedData {
  session: AgentSession;
}

export interface SessionFailedData {
  error: string;
}

async function parseSSEStream(
  response: Response,
  onEvent: (event: AgentSSEEvent) => void,
): Promise<void> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("No response body");
  }

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        try {
          const event: AgentSSEEvent = JSON.parse(line.slice(6));
          onEvent(event);
        } catch {
          // Skip malformed events
        }
      }
    }
  }

  // Process remaining buffer
  if (buffer.startsWith("data: ")) {
    try {
      const event: AgentSSEEvent = JSON.parse(buffer.slice(6));
      onEvent(event);
    } catch {
      // Skip malformed events
    }
  }
}

export const agentApi = {
  createSession: (options?: {
    skill_id?: string;
    graph_ids?: string[];
    custom_prompt?: string;
  }): Promise<{ session: AgentSession }> =>
    request("/agent/sessions", {
      method: "POST",
      body: JSON.stringify(options || {}),
    }),

  getSession: (sessionId: string): Promise<{ session: AgentSession }> =>
    request(`/agent/sessions/${sessionId}`),

  executeSession: (
    sessionId: string,
    customPrompt?: string,
  ): Promise<{ session: AgentSession }> =>
    request(`/agent/sessions/${sessionId}/execute`, {
      method: "POST",
      body: JSON.stringify({ custom_prompt: customPrompt }),
    }),

  getSkills: (): Promise<{ skills: SkillDefinition[] }> =>
    request("/agent/skills"),

  applyRecommendations: (
    recommendations: GraphRecommendation[],
    graphIndex?: Record<string, string>,
  ): Promise<{ success: boolean; created: number }> =>
    request("/agent/recommendations/apply", {
      method: "POST",
      body: JSON.stringify({ recommendations, graphIndex }),
    }),

  mergeGraphs: (
    graphIds: string[],
    targetTitle?: string,
  ): Promise<{ success: boolean; merged_graph_id: string }> =>
    request("/graphs/merge", {
      method: "POST",
      body: JSON.stringify({ graph_ids: graphIds, target_title: targetTitle }),
    }),

  linkGraphs: (
    graphIds: string[],
    relationType?: RelationType,
  ): Promise<{ success: boolean; created: number }> =>
    request("/graphs/batch-link", {
      method: "POST",
      body: JSON.stringify({
        graph_ids: graphIds,
        relation_type: relationType || "related",
      }),
    }),

  dismissMergeSuggestion: (graphIds: string[]): Promise<{ success: boolean }> =>
    request("/agent/merge-suggestions/dismiss", {
      method: "POST",
      body: JSON.stringify({ graph_ids: graphIds }),
    }),

  getTools: (): Promise<{ tools: ToolDefinition[] }> => request("/agent/tools"),

  executeAutonomous: (
    sessionId: string,
    goal: AnalysisGoal,
  ): Promise<ExecuteResult> =>
    request(`/agent/sessions/${sessionId}/autonomous`, {
      method: "POST",
      body: JSON.stringify({ goal }),
    }),

  getPendingActions: (
    sessionId: string,
  ): Promise<{ pendingActions: PendingAction[] }> =>
    request(`/agent/sessions/${sessionId}/pending-actions`),

  confirmAction: (
    sessionId: string,
    actionId: string,
  ): Promise<{ success: boolean; result?: unknown; needsResume?: boolean }> =>
    request(`/agent/sessions/${sessionId}/actions/${actionId}/confirm`, {
      method: "POST",
    }),

  rejectAction: (
    sessionId: string,
    actionId: string,
  ): Promise<{ success: boolean; needsResume?: boolean }> =>
    request(`/agent/sessions/${sessionId}/actions/${actionId}/reject`, {
      method: "POST",
    }),

  batchConfirmActions: (
    sessionId: string,
    actionIds: string[],
  ): Promise<{
    success: boolean;
    results: Array<{
      actionId: string;
      success: boolean;
      result?: unknown;
      error?: string;
    }>;
  }> =>
    request(`/agent/sessions/${sessionId}/actions/batch-confirm`, {
      method: "POST",
      body: JSON.stringify({ action_ids: actionIds }),
    }),

  batchRejectActions: (
    sessionId: string,
    actionIds: string[],
  ): Promise<{
    success: boolean;
    results: Array<{
      actionId: string;
      success: boolean;
      error?: string;
    }>;
  }> =>
    request(`/agent/sessions/${sessionId}/actions/batch-reject`, {
      method: "POST",
      body: JSON.stringify({ action_ids: actionIds }),
    }),

  executeSessionStream: async (
    sessionId: string,
    customPrompt: string | undefined,
    onEvent: (event: AgentSSEEvent) => void,
    onError?: (error: Error) => void,
    onComplete?: () => void,
  ): Promise<AbortController> => {
    const controller = new AbortController();
    const baseUrl = await getApiUrl();

    fetch(`${baseUrl}/agent/sessions/${sessionId}/execute`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getHeaders(),
      },
      body: JSON.stringify({ custom_prompt: customPrompt }),
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`HTTP error: ${response.status}`);
        }
        await parseSSEStream(response, onEvent);
        onComplete?.();
      })
      .catch((error) => {
        if (error.name !== "AbortError") {
          onError?.(error);
        }
      });

    return controller;
  },

  resumeSessionStream: async (
    sessionId: string,
    onEvent: (event: AgentSSEEvent) => void,
    onError?: (error: Error) => void,
    onComplete?: () => void,
  ): Promise<AbortController> => {
    const controller = new AbortController();
    const baseUrl = await getApiUrl();

    fetch(`${baseUrl}/agent/sessions/${sessionId}/resume`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getHeaders(),
      },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`HTTP error: ${response.status}`);
        }
        await parseSSEStream(response, onEvent);
        onComplete?.();
      })
      .catch((error) => {
        if (error.name !== "AbortError") {
          onError?.(error);
        }
      });

    return controller;
  },

  getSessions: async (): Promise<{ sessions: AgentSession[] }> => {
    const baseUrl = await getApiUrl();
    const response = await fetch(`${baseUrl}/agent/sessions`, {
      headers: getHeaders(),
    });
    return response.json();
  },

  deleteSession: async (sessionId: string): Promise<void> => {
    const baseUrl = await getApiUrl();
    await fetch(`${baseUrl}/agent/sessions/${sessionId}`, {
      method: "DELETE",
      headers: getHeaders(),
    });
  },
};
