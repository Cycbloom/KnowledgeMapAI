import {
  request,
  getAIConfig,
  getApiUrl,
  handleResponse,
  injectAIConfig,
  getCsrfToken,
} from "./client";
import { useStore } from "@/store/useStore";
import type { AIAction, TutorMode } from "@shared/types";
import { getAILanguage } from "@/hooks/ai/useAILanguage";
import { createStreamHandler } from "../shared/streamHandler";
import type { IAiApi, IAiActionsApi } from "./contracts/IAiApi";

export const aiActionsApi: IAiActionsApi = {
  list: (graphId?: string) =>
    request(`/ai-actions${graphId ? `?graph_id=${graphId}` : ""}`),

  create: (data: Partial<AIAction>) =>
    request("/ai-actions", { method: "POST", body: JSON.stringify(data) }),

  update: (id: string, data: Partial<AIAction>) =>
    request(`/ai-actions/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  delete: (id: string) => request(`/ai-actions/${id}`, { method: "DELETE" }),

  execute: (data: { action_id: string; node_id: string; graph_id?: string }) =>
    request("/ai-actions/execute", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};

const createApiStreamHandler = async (
  url: string,
  payload: unknown,
  onChunk: (content: string) => void,
) => {
  // 基址 / 鉴权 / CSRF / 移动端标识头统一由流式出口内部处理
  await createStreamHandler(url, payload, onChunk);
};

export const aiApi: IAiApi = {
  status: () => request("/ai/status"),

  generateContent: (data: {
    topic: string;
    context?: string;
    provider?: string;
    model?: string;
    language?: string;
  }) => {
    const payload = injectAIConfig(
      { ...data, language: data.language || getAILanguage() },
      "text",
    );
    return request("/ai/generate-content", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  generateContentStream: async (
    data: {
      topic: string;
      context?: string;
      level?: string;
      provider?: string;
      model?: string;
      language?: string;
    },
    onChunk: (content: string) => void,
  ) => {
    const payload = injectAIConfig(
      { ...data, language: data.language || getAILanguage() },
      "text",
    );
    await createApiStreamHandler("/ai/generate-content-stream", payload, onChunk);
  },

  annotateTerms: (data: {
    node_id: string;
    node_content: string;
    graph_id: string;
    provider?: string;
    model?: string;
    language?: string;
  }) => {
    const payload = injectAIConfig(
      { ...data, language: data.language || getAILanguage() },
      "text",
    );
    return request("/ai/annotate-terms", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  generateLearningMaterial: (data: {
    topic: string;
    context?: string;
    level?: string;
    graph_id?: string;
    provider?: string;
    model?: string;
    language?: string;
    schema_id?: string;
  }) => {
    const payload = injectAIConfig(
      { ...data, language: data.language || getAILanguage() },
      "text",
    );
    return request("/ai/learning-material", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  assistLearningSchema: (data: {
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
    return request("/ai/learning-material-schema/assist", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  expand: (data: {
    node_title: string;
    node_content?: string;
    existing_titles?: string[];
    current_children?: string[];
    node_level?: string;
    expand_prompt?: string;
    min_count?: number;
    max_count?: number;
    use_level_strategy?: boolean;
    graph_id?: string;
    provider?: string;
    model?: string;
    language?: string;
  }) => {
    const payload = injectAIConfig(
      { ...data, language: data.language || getAILanguage() },
      "text",
    );
    return request("/ai/expand-knowledge", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  getBranchSuggestions: (data: {
    node_title: string;
    node_content?: string;
    existing_nodes?: unknown[];
    child_nodes?: unknown[];
    context_level?: string;
    provider?: string;
    model?: string;
    language?: string;
  }) => {
    const payload = injectAIConfig(
      { ...data, language: data.language || getAILanguage() },
      "text",
    );
    return request("/ai/branch-suggestions", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  generateCards: (data: {
    node_title: string;
    node_content?: string;
    count?: number;
    types?: string[];
    provider?: string;
    model?: string;
    language?: string;
  }) => {
    const payload = injectAIConfig(
      { ...data, language: data.language || getAILanguage() },
      "text",
    );
    return request("/ai/generate-cards", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  batchGenerateCards: (
    node_ids: string[],
    config: {
      types?: string[];
      count?: number;
      pack_template?: string;
      provider?: string;
      model?: string;
      language?: string;
      difficulty?: 'easy' | 'medium' | 'hard' | 'mixed';
      coverage?: 'current_only' | 'with_children' | 'with_siblings' | 'graph';
      custom_prompt?: string;
      cards_per_type?: Record<string, number>;
      count_per_difficulty?: { easy?: number; medium?: number; hard?: number };
      /** 题型×难度二维矩阵：每个非零格子=一次独立 AI 调用（后端处理） */
      count_matrix?: Record<
        string,
        { easy?: number; medium?: number; hard?: number }
      >;
    },
  ) => {
    const payloadConfig = injectAIConfig(
      { ...config, language: config.language || getAILanguage() },
      "text",
    );
    return request("/ai/batch-generate-cards", {
      method: "POST",
      body: JSON.stringify({ node_ids, config: payloadConfig }),
    });
  },

  batchExpandGraph: (node_ids: string[]) => {
    return request<{ success: boolean; taskIds: string[]; message: string }>(
      "/ai/batch-expand-graph",
      {
        method: "POST",
        body: JSON.stringify({ node_ids }),
      },
    );
  },

  getTaskStatus: (id: string) => request(`/ai/tasks/${id}`),

  textToGraph: (data: {
    text?: string;
    graph_id: string;
    action?: "analyze" | "save";
    nodes?: unknown[];
    edges?: unknown[];
    provider?: string;
    model?: string;
    language?: string;
  }) => {
    const payload = injectAIConfig(
      { ...data, language: data.language || getAILanguage() },
      "text",
    );
    return request("/ai/text-to-graph", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  documentToGraph: async (data: {
    graph_id: string;
    file: File;
    language?: string;
  }) => {
    const token = useStore.getState().token;
    const csrfToken = getCsrfToken();
    const config = getAIConfig("text");
    const formData = new FormData();
    formData.append("graph_id", data.graph_id);
    formData.append("file", data.file);
    formData.append("language", data.language || getAILanguage());
    if (config.provider) formData.append("provider", config.provider);
    if (config.model) formData.append("model", config.model);

    const apiUrl = await getApiUrl();
    const response = await fetch(`${apiUrl}/ai/document-to-graph`, {
      method: "POST",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
      },
      credentials: "include",
      body: formData,
    });
    return handleResponse(response);
  },

  imageToGraph: (formData: FormData) =>
    request("/ai/image-to-graph", { method: "POST", body: formData }),

  urlToText: (url: string) =>
    request("/ai/url-to-text", {
      method: "POST",
      body: JSON.stringify({ url }),
    }),

  recommendConnections: (data: {
    graph_id: string;
    node_title: string;
    node_content?: string;
  }) =>
    request("/ai/recommend-connections", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  chatStream: async (
    data: {
      message: string;
      graph_id: string;
      history?: unknown[];
      context_node_ids?: string[];
      provider?: string;
      model?: string;
      language?: string;
      session_id?: string;
    },
    onChunk: (content: string) => void,
  ) => {
    const payload = injectAIConfig(
      { ...data, language: data.language || getAILanguage() },
      "text",
    );
    await createApiStreamHandler("/ai/chat", payload, onChunk);
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
      language?: string;
      session_id?: string;
    },
    onChunk: (content: string) => void,
  ) => {
    const payload = injectAIConfig(
      { ...data, language: data.language || getAILanguage() },
      "text",
    );
    await createApiStreamHandler("/ai/tutor-chat", payload, onChunk);
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
  }) =>
    request<{
      success: boolean;
      data: { score: number; feedback: string; correct: boolean };
    }>("/ai/grade", { method: "POST", body: JSON.stringify(data) }),

  extractConcepts: (data: {
    text: string;
    existing_nodes?: string[];
    max_concepts?: number;
    provider?: string;
    model?: string;
    language?: string;
  }) => {
    const payload = injectAIConfig(
      { ...data, language: data.language || getAILanguage() },
      "text",
    );
    return request("/ai/extract-concepts", {
      method: "POST",
      body: JSON.stringify(payload),
    });
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
    language?: string;
  }) => {
    const payload = injectAIConfig(
      { ...data, language: data.language || getAILanguage() },
      "text",
    );
    return request("/ai/suggest-next-topic", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  generatePodcastScript: (
    context: string,
    language: string = "zh-CN",
    graph_id?: string,
  ) => {
    const payload = injectAIConfig(
      { context, language: language || getAILanguage(), graph_id },
      "text",
    );
    return request("/ai/podcast/script", {
      method: "POST",
      body: JSON.stringify(payload),
    });
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
    language?: string;
  }) => {
    const payload = injectAIConfig(
      { ...data, language: data.language || getAILanguage() },
      "text",
    );
    return request("/ai/cross-graph-connections", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  suggestNodeStyles: (data: {
    nodes: Array<{ id: string; title: string; content?: string; level?: string }>;
    language?: string;
  }) => {
    const payload = injectAIConfig(
      { ...data, language: data.language || getAILanguage() },
      "text",
    );
    return request<{
      suggestions: Array<{
        node_id: string;
        color: string;
        icon: string;
        reason: string;
      }>;
      usedDefault: boolean;
    }>("/ai/suggest-node-styles", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  translateNodes: (data: {
    nodes: Array<{
      id: string;
      title: string;
      content?: string;
      summary?: string;
    }>;
    target_language: string;
  }) => {
    const payload = injectAIConfig(
      { ...data, language: data.target_language || getAILanguage() },
      "text",
    );
    return request<{
      translations: Array<{
        node_id: string;
        title: string;
        content?: string;
        summary?: string;
      }>;
      usedDefault: boolean;
    }>("/ai/translate-nodes", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
};
