import { useStore } from "@/store/useStore";
import { createErrorFromResponse, AppError, SharedErrorCodes } from "@/utils/errors";
import { getAIConfig, injectAIConfig } from "../api/client";
import type { AIAction, TutorMode, BranchSuggestion } from "@shared/types";
import type { Keyword } from "@shared/types/graph";
import type { IAiApi, IAiActionsApi } from "../api/contracts/IAiApi";
import { mobileAIService } from "../ai";
import { isCapacitorMobile } from "@/config/mobileApiConfig";
import { getAILanguage } from "@/hooks/ai/useAILanguage";
import { getMobileSupabaseClient } from "@/utils/supabase";
import {
  createStreamHandler,
} from "../shared/streamHandler";
import { logger } from "@/utils/logger";

const getCloudApiBaseUrl = (): string => {
  return import.meta.env.VITE_API_URL || "";
};

const baseURL = getCloudApiBaseUrl() || "/api/v1";

const buildHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {
    "x-mobile-client": "true",
    "Content-Type": "application/json",
  };
  const token = useStore.getState().token;
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
};

const request = async <T>(
  method: string,
  url: string,
  body?: unknown,
): Promise<T> => {
  const fullUrl = url.startsWith("http") ? url : `${baseURL}${url}`;
  const init: RequestInit = {
    method,
    credentials: "include",
    headers: buildHeaders(),
  };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }

  let response: Response;
  try {
    response = await fetch(fullUrl, init);
  } catch (error) {
    throw createErrorFromResponse({
      status: 0,
      statusText: error instanceof Error ? error.message : String(error),
    });
  }

  let data: unknown = undefined;
  const text = await response.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    throw createErrorFromResponse({
      status: response.status,
      statusText: response.statusText,
      data: data as
        | {
            message?: string;
            error?: string;
            code?: string;
            details?: Array<{ field: string; message: string }>;
          }
        | undefined,
    });
  }

  return data as T;
};

const get = <T>(url: string): Promise<T> => request<T>("GET", url);
const post = <T>(url: string, body?: unknown): Promise<T> =>
  request<T>("POST", url, body);
const put = <T>(url: string, body?: unknown): Promise<T> =>
  request<T>("PUT", url, body);
const del = <T>(url: string): Promise<T> => request<T>("DELETE", url);

const createMobileStreamHandler = async (
  url: string,
  payload: unknown,
  onChunk: (content: string) => void,
) => {
  // 基址 / 鉴权 / CSRF / 移动端标识头统一由流式出口内部处理
  await createStreamHandler(url, payload, onChunk);
};

export const mobileAiApi: IAiApi & { aiActions: IAiActionsApi } = {
  status: () =>
    get<{ available: boolean; enabled?: boolean; providers: string[] }>(
      "/ai/status",
    ),

  generateContent: (data: {
    topic: string;
    context?: string;
    provider?: string;
    model?: string;
  }) => {
    const payload = injectAIConfig(data, "text");
    return post<{ content: string }>("/ai/generate-content", payload);
  },

  generateContentStream: async (
    data: {
      topic: string;
      context?: string;
      level?: string;
      provider?: string;
      model?: string;
    },
    onChunk: (content: string) => void,
  ) => {
    const payload = injectAIConfig(data, "text");
    await createStreamHandler("/ai/generate-content-stream", payload, onChunk);
  },

  annotateTerms: (data: {
    node_id: string;
    node_content: string;
    graph_id: string;
    provider?: string;
    model?: string;
  }) => {
    const payload = injectAIConfig(data, "text");
    return post<{ terms: Array<{ term: string; definition: string }> }>(
      "/ai/annotate-terms",
      payload,
    );
  },

  generateLearningMaterial: async (data: {
    topic: string;
    context?: string;
    level?: string;
    graph_id?: string;
    provider?: string;
    model?: string;
    language?: string;
  }) => {
    const isMobile = isCapacitorMobile();
    const isConfigured = mobileAIService.isConfigured();
    const language = data.language || getAILanguage();

    if (isMobile && isConfigured) {
      try {
        const result = await mobileAIService.generateLearningMaterial(
          data.topic,
          data.context || "",
          { level: data.level, language },
        );
        return result;
      } catch (error) {
        logger.error("[Mobile API] generateLearningMaterial 本地服务失败:", {
          error: error instanceof Error ? error.message : String(error),
          topic: data.topic,
        });
        throw error;
      }
    }

    const payload = injectAIConfig({ ...data, language }, "text");
    return post<{
      content: string;
      keywords?: Keyword[];
      sections?: Array<{ title: string; content: string }>;
    }>("/ai/learning-material", payload);
  },

  assistLearningSchema: async (data: {
    mode: "generate" | "optimize";
    topic: string;
    goal?: string;
    existing_sections?: Array<{
      title: string;
      instruction: string;
      min_words?: number;
      max_words?: number;
    }>;
    graph_id?: string;
    provider?: string;
    model?: string;
    language?: string;
  }) => {
    const payload = injectAIConfig(
      { ...data, language: data.language || getAILanguage() },
      "text",
    );
    return post<{
      sections: Array<{
        title: string;
        instruction: string;
        min_words?: number;
        max_words?: number;
      }>;
    }>("/ai/learning-material-schema/assist", payload);
  },

  expand: async (data: {
    node_title: string;
    node_content?: string;
    existing_titles?: string[];
    current_children?: string[];
    node_level?: string;
    expand_prompt?: string;
    graph_id?: string;
    provider?: string;
    model?: string;
  }) => {
    const isMobile = isCapacitorMobile();
    const isConfigured = mobileAIService.isConfigured();

    if (isMobile && isConfigured) {
      try {
        const result = await mobileAIService.expandKnowledge(
          data.node_title,
          data.node_content,
          data.existing_titles,
          data.current_children,
          {
            contextLevel: data.node_level,
            expandPrompt: data.expand_prompt,
          },
        );
        return result;
      } catch (error) {
        logger.error("[Mobile API] expand 本地服务失败:", {
          error: error instanceof Error ? error.message : String(error),
          node_title: data.node_title,
        });
        throw error;
      }
    }

    const payload = injectAIConfig(data, "text");
    return post<{
      suggestions: Array<{ title: string; description?: string; level?: string }>;
    }>("/ai/expand-knowledge", payload);
  },

  getBranchSuggestions: (data: {
    node_title: string;
    node_content?: string;
    existing_nodes?: unknown[];
    child_nodes?: unknown[];
    context_level?: string;
    provider?: string;
    model?: string;
  }) => {
    const payload = injectAIConfig(data, "text");
    return post<{ suggestions: BranchSuggestion[] }>("/ai/branch-suggestions", payload);
  },

  generateCards: (data: {
    node_title: string;
    node_content?: string;
    count?: number;
    types?: string[];
    provider?: string;
    model?: string;
  }) => {
    const payload = injectAIConfig(data, "text");
    return post<{
      cards: Array<{
        id?: string;
        question: string;
        answer: string;
        type: string;
        difficulty: string;
        explanation?: string;
        options?: string[];
      }>;
    }>("/ai/generate-cards", payload);
  },
  batchGenerateCards: async (
    node_ids: string[],
    config: {
      types?: string[];
      count?: number;
      pack_template?: string;
      provider?: string;
      model?: string;
    },
  ) => {
    const isMobile = isCapacitorMobile();

    if (isMobile) {
      if (!mobileAIService.isConfigured()) {
        throw new AppError(
          "请先在设置中配置 AI API Key",
          SharedErrorCodes.AI_PROVIDER_NOT_CONFIGURED,
          500,
        );
      }

      const client = getMobileSupabaseClient();
      if (!client) {
        throw new AppError(
          "Supabase client not initialized",
          SharedErrorCodes.SYSTEM_CONFIGURATION_ERROR,
          500,
        );
      }

      const { data: graphNodes } = await client
        .from("graph_nodes")
        .select(
          `
          knowledge_point_id,
          graph_id,
          knowledge_points (
            id,
            title,
            content
          )
        `,
        )
        .in("knowledge_point_id", node_ids)
        .is("deleted_at", null);

      if (!graphNodes || graphNodes.length === 0) {
        return { success: true, taskIds: [], message: "No nodes found" };
      }

      const results: { nodeId: string; success: boolean; count: number }[] = [];

      for (const gn of graphNodes as unknown as Array<{
        knowledge_point_id: string;
        graph_id: string;
        knowledge_points?: {
          id: string;
          title?: string | null;
          content?: string | null;
        } | null;
      }>) {
        try {
          const result = await mobileAIService.generateAndSaveCards(
            gn.knowledge_points?.title || "",
            gn.knowledge_points?.content || "",
            gn.knowledge_point_id,
            gn.graph_id,
            {
              types: config.types,
              count: config.count,
            },
          );
          results.push({
            nodeId: gn.knowledge_point_id,
            success: result.success,
            count: result.savedCount,
          });
        } catch (error) {
          logger.error(
            `Failed to generate cards for node ${gn.knowledge_point_id}:`,
            error,
          );
          results.push({
            nodeId: gn.knowledge_point_id,
            success: false,
            count: 0,
          });
        }
      }

      // 单趟统计 success 并收集 taskIds，替代 filter + map 的 O(2*results) 重复扫描
      let successCount = 0;
      const taskIds: string[] = [];
      for (const r of results) {
        taskIds.push(r.nodeId);
        if (r.success) successCount++;
      }
      return {
        success: true,
        taskIds,
        message: `Successfully generated cards for ${successCount}/${results.length} nodes`,
        results,
      };
    }

    const payloadConfig = injectAIConfig(config, "text");
    const payload = { node_ids, config: payloadConfig };

    try {
      return await post<{
        success: boolean;
        taskIds: string[];
        message: string;
        error?: string;
        results?: Array<{ nodeId: string; success: boolean; count: number }>;
      }>("/ai/batch-generate-cards", payload);
    } catch (error) {
      logger.error("[Mobile API] batchGenerateCards 失败:", {
        error,
        message: error instanceof Error ? error.message : String(error),
        statusCode: error instanceof AppError ? error.statusCode : undefined,
        context: error instanceof AppError ? error.context : undefined,
      });
      throw error;
    }
  },

  batchExpandGraph: (node_ids: string[]) =>
    post<{ success: boolean; taskIds: string[]; message: string }>(
      "/ai/batch-expand-graph",
      { node_ids },
    ),

  getTaskStatus: (id: string) =>
    get<{ status: string; progress?: number; result?: unknown }>(
      `/ai/tasks/${id}`,
    ),

  textToGraph: (data: {
    text?: string;
    graph_id: string;
    action?: "analyze" | "save";
    nodes?: unknown[];
    edges?: unknown[];
    provider?: string;
    model?: string;
  }) => {
    const payload = injectAIConfig(data, "text");
    return post<{
      nodes: Array<{
        id?: string;
        title: string;
        content?: string;
        level?: string;
      }>;
      edges: Array<{ source: string; target: string; type: string }>;
    }>("/ai/text-to-graph", payload);
  },

  documentToGraph: async (data: { graph_id: string; file: File }) => {
    const token = useStore.getState().token;
    const fetchBaseURL = getCloudApiBaseUrl() || "";
    const config = getAIConfig("text");
    const formData = new FormData();
    formData.append("graph_id", data.graph_id);
    formData.append("file", data.file);
    if (config.provider) formData.append("provider", config.provider);
    if (config.model) formData.append("model", config.model);

    const fullUrl = fetchBaseURL
      ? `${fetchBaseURL}/ai/document-to-graph`
      : "/ai/document-to-graph";
    const response = await fetch(fullUrl, {
      method: "POST",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: "include",
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new AppError(
        errorText || "Document to graph failed",
        SharedErrorCodes.AI_PROVIDER_ERROR,
        502,
      );
    }

    return response.json();
  },

  imageToGraph: async (formData: FormData) => {
    const token = useStore.getState().token;
    const fetchBaseURL = getCloudApiBaseUrl() || "";
    const fullUrl = fetchBaseURL
      ? `${fetchBaseURL}/ai/image-to-graph`
      : "/ai/image-to-graph";

    const response = await fetch(fullUrl, {
      method: "POST",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: "include",
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new AppError(
        errorText || "Image to graph failed",
        SharedErrorCodes.AI_PROVIDER_ERROR,
        502,
      );
    }

    return response.json();
  },

  urlToText: (url: string) =>
    post<{ text: string; title?: string }>("/ai/url-to-text", { url }),

  recommendConnections: (data: {
    graph_id: string;
    node_title: string;
    node_content?: string;
  }) =>
    post<{
      connections: Array<{
        target_title: string;
        relationship: string;
        reason: string;
      }>;
    }>("/ai/recommend-connections", data),

  chatStream: async (
    data: {
      message: string;
      graph_id: string;
      history?: unknown[];
      context_node_ids?: string[];
      provider?: string;
      model?: string;
    },
    onChunk: (content: string) => void,
  ) => {
    const payload = injectAIConfig(data, "text");
    await createMobileStreamHandler("/ai/chat", payload, onChunk);
  },

  tutorChatStream: async (
    data: {
      message: string;
      graph_id?: string;
      history?: unknown[];
      context_node_ids?: string[];
      mode?: TutorMode;
      provider?: string;
      model?: string;
    },
    onChunk: (content: string) => void,
  ) => {
    const payload = injectAIConfig(data, "text");
    await createStreamHandler("/ai/tutor-chat", payload, onChunk);
  },

  gradeAnswer: (data: {
    question: string;
    card_type: string;
    reference_answer: string;
    user_answer: string;
    explanation?: string;
    difficulty?: string;
    provider?: string;
    model?: string;
  }) => {
    const payload = injectAIConfig(data, "text");
    return post<{
      success: boolean;
      data: { score: number; feedback: string; correct: boolean };
    }>("/ai/grade", payload);
  },

  extractConcepts: (data: {
    text: string;
    existing_nodes?: string[];
    max_concepts?: number;
    provider?: string;
    model?: string;
  }) => {
    const payload = injectAIConfig(data, "text");
    return post<{
      concepts: Array<{
        title: string;
        description: string;
        priority: "high" | "medium" | "low";
      }>;
    }>("/ai/extract-concepts", payload);
  },

  suggestNextTopic: (data: {
    node_title: string;
    node_content?: string;
    existing_nodes?: string[];
    user_progress?: {
      mastered_count?: number;
      due_count?: number;
      current_level?: string;
    };
    provider?: string;
    model?: string;
  }) => {
    const payload = injectAIConfig(data, "text");
    return post<{
      suggestions: Array<{
        title: string;
        description: string;
        priority: "high" | "medium" | "low";
        estimatedDifficulty: number;
      }>;
    }>("/ai/suggest-next-topic", payload);
  },

  generatePodcastScript: (
    context: string,
    language: string = "zh",
    graph_id?: string,
  ) => {
    const payload = injectAIConfig({ context, language, graph_id }, "text");
    return post<{
      script: string;
      segments: Array<{ speaker: string; text: string }>;
    }>("/ai/podcast/script", payload);
  },

  analyzeCrossGraphConnections: (data: {
    graph1_id: string;
    graph1_title?: string;
    graph1_nodes: Array<{ id: string; title: string; content?: string }>;
    graph2_id: string;
    graph2_title?: string;
    graph2_nodes: Array<{ id: string; title: string; content?: string }>;
    provider?: string;
    model?: string;
  }) => {
    const payload = injectAIConfig(data, "text");
    return post<{
      connections: Array<{
        source: string;
        target: string;
        type: string;
        description: string;
      }>;
    }>("/ai/cross-graph-connections", payload);
  },

  suggestNodeStyles: (data: {
    nodes: Array<{ id: string; title: string; content?: string; level?: string }>;
    language?: string;
  }) => {
    const payload = injectAIConfig(data, "text");
    return post<{
      suggestions: Array<{
        node_id: string;
        color: string;
        icon: string;
        reason: string;
      }>;
      usedDefault: boolean;
    }>("/ai/suggest-node-styles", payload);
  },

  translateNodes: (data: {
    nodes: Array<{ id: string; title: string; content?: string }>;
    target_language: string;
  }) => {
    const payload = injectAIConfig(
      { ...data, language: data.target_language },
      "text",
    );
    return post<{
      translations: Array<{
        node_id: string;
        title: string;
        content?: string;
      }>;
      usedDefault: boolean;
    }>("/ai/translate-nodes", payload);
  },

  aiActions: {
    list: (graphId?: string) =>
      get<AIAction[]>(
        `/ai-actions${graphId ? `?graph_id=${graphId}` : ""}`,
      ),
    create: (data: Partial<AIAction>) => post<AIAction>("/ai-actions", data),
    update: (id: string, data: Partial<AIAction>) =>
      put<AIAction>(`/ai-actions/${id}`, data),
    delete: (id: string) => del<void>(`/ai-actions/${id}`),
    execute: (data: {
      action_id: string;
      node_id: string;
      graph_id?: string;
    }) =>
      post<{
        data?: {
          updatedFields?: string[];
          createdCount?: number;
        };
        message?: string;
      }>("/ai-actions/execute", data),
  },
};
