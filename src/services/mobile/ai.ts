import axios, { AxiosInstance } from "axios";
import { useStore } from "../../store/useStore";
import { createErrorFromResponse } from "../../utils/errors";
import { getAIConfig, injectAIConfig } from "../api/client";
import type { AIAction } from "@shared/types";
import { mobileAIService } from "./aiService";
import { isCapacitorMobile } from "../../config/mobileApiConfig";
import { getMobileSupabaseClient } from "./client";

const getCloudApiBaseUrl = (): string => {
  return import.meta.env.VITE_API_URL || "";
};

const createMobileAiApiClient = (): AxiosInstance => {
  const baseURL = getCloudApiBaseUrl() || "/api";

  const client = axios.create({
    baseURL,
    withCredentials: true,
    headers: {
      "x-mobile-client": "true",
    },
  });

  client.interceptors.request.use(
    (config) => {
      const token = useStore.getState().token;
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => Promise.reject(error),
  );

  client.interceptors.response.use(
    (response) => response.data,
    async (error) => {
      const appError = createErrorFromResponse({
        status: error.response?.status || 0,
        statusText: error.message,
        data: error.response?.data as any,
      });
      return Promise.reject(appError);
    },
  );

  return client;
};

const mobileAiClient = createMobileAiApiClient();

const createStreamHandler = async (
  url: string,
  payload: unknown,
  onChunk: (content: string) => void,
) => {
  const token = useStore.getState().token;
  const baseURL = getCloudApiBaseUrl() || "";
  const fullUrl = baseURL ? `${baseURL}${url}` : url;

  const response = await fetch(fullUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: "include",
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    if (response.status === 401) {
      useStore.getState().setUser(null, null);
    }
    const errorText = await response.text();
    throw new Error(errorText || "Stream failed");
  }

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  if (!reader) return;

  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const dataStr = line.replace("data: ", "");
        if (dataStr === "[DONE]") return;
        try {
          const parsed = JSON.parse(dataStr);
          if (parsed.content) onChunk(parsed.content);
          if (parsed.error) throw new Error(parsed.error);
        } catch (e) {
          console.error("Stream parse error:", e);
        }
      }
    }
  }
};

export const mobileAiApi = {
  status: () => mobileAiClient.get("/ai/status"),

  generateContent: (data: {
    topic: string;
    context?: string;
    provider?: string;
    model?: string;
  }) => {
    const payload = injectAIConfig(data, "text");
    return mobileAiClient.post("/ai/generate-content", payload);
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
    return mobileAiClient.post("/ai/annotate-terms", payload);
  },

  generateLearningMaterial: async (data: {
    topic: string;
    context?: string;
    level?: string;
    graph_id?: string;
    provider?: string;
    model?: string;
  }) => {
    const isMobile = isCapacitorMobile();
    const isConfigured = mobileAIService.isConfigured();

    if (isMobile && isConfigured) {
      try {
        const result = await mobileAIService.generateLearningMaterial(
          data.topic,
          data.context || "",
          { level: data.level },
        );
        return result;
      } catch (error) {
        console.error("[Mobile API] generateLearningMaterial 本地服务失败:", {
          error: error instanceof Error ? error.message : String(error),
          topic: data.topic,
        });
        throw error;
      }
    }

    const payload = injectAIConfig(data, "text");
    return mobileAiClient.post("/ai/learning-material", payload);
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
        console.error("[Mobile API] expand 本地服务失败:", {
          error: error instanceof Error ? error.message : String(error),
          node_title: data.node_title,
        });
        throw error;
      }
    }

    const payload = injectAIConfig(data, "text");
    return mobileAiClient.post("/ai/expand-knowledge", payload);
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
    return mobileAiClient.post("/ai/branch-suggestions", payload);
  },

  generateCards: (data: {
    node_title: string;
    node_content: string;
    count?: number;
    types?: string[];
    provider?: string;
    model?: string;
  }) => {
    const payload = injectAIConfig(data, "text");
    return mobileAiClient.post("/ai/generate-cards", payload);
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
        throw new Error("请先在设置中配置 AI API Key");
      }

      const client = getMobileSupabaseClient();
      if (!client) {
        throw new Error("Supabase client not initialized");
      }

      const { data: graphNodes } = await client
        .from("graph_nodes")
        .select(`
          knowledge_point_id,
          graph_id,
          knowledge_points (
            id,
            title,
            content
          )
        `)
        .in("knowledge_point_id", node_ids)
        .is("deleted_at", null);

      if (!graphNodes || graphNodes.length === 0) {
        return { success: true, taskIds: [], message: "No nodes found" };
      }

      const results: { nodeId: string; success: boolean; count: number }[] = [];

      for (const gn of graphNodes as Array<{
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
          console.error(
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

      const successCount = results.filter((r) => r.success).length;
      return {
        success: true,
        taskIds: results.map((r) => r.nodeId),
        message: `Successfully generated cards for ${successCount}/${results.length} nodes`,
        results,
      };
    }

    const payloadConfig = injectAIConfig(config, "text");
    const payload = { node_ids, config: payloadConfig };

    return mobileAiClient
      .post("/ai/batch-generate-cards", payload)
      .then((result) => {
        return result;
      })
      .catch((error) => {
        console.error("[Mobile API] batchGenerateCards 失败:", {
          error,
          message: error?.message || String(error),
          response: error?.response?.data,
          status: error?.response?.status,
        });
        throw error;
      });
  },

  batchExpandGraph: (node_ids: string[]) => {
    return mobileAiClient.post("/ai/batch-expand-graph", { node_ids });
  },

  getTaskStatus: (id: string) => mobileAiClient.get(`/ai/tasks/${id}`),

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
    return mobileAiClient.post("/ai/text-to-graph", payload);
  },

  documentToGraph: async (data: { graph_id: string; file: File }) => {
    const token = useStore.getState().token;
    const baseURL = getCloudApiBaseUrl() || "";
    const config = getAIConfig("text");
    const formData = new FormData();
    formData.append("graph_id", data.graph_id);
    formData.append("file", data.file);
    if (config.provider) formData.append("provider", config.provider);
    if (config.model) formData.append("model", config.model);

    const fullUrl = baseURL
      ? `${baseURL}/ai/document-to-graph`
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
      throw new Error(errorText || "Document to graph failed");
    }

    return response.json();
  },

  imageToGraph: async (formData: FormData) => {
    const token = useStore.getState().token;
    const baseURL = getCloudApiBaseUrl() || "";
    const fullUrl = baseURL
      ? `${baseURL}/ai/image-to-graph`
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
      throw new Error(errorText || "Image to graph failed");
    }

    return response.json();
  },

  urlToText: (url: string) => mobileAiClient.post("/ai/url-to-text", { url }),

  recommendConnections: (data: {
    graph_id: string;
    node_title: string;
    node_content?: string;
  }) => mobileAiClient.post("/ai/recommend-connections", data),

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
    await createStreamHandler("/ai/chat", payload, onChunk);
  },

  tutorChatStream: async (
    data: {
      message: string;
      graph_id?: string;
      history?: unknown[];
      context_node_ids?: string[];
      mode?: "free" | "guided" | "learning-path";
      provider?: string;
      model?: string;
    },
    onChunk: (content: string) => void,
  ) => {
    const payload = injectAIConfig(data, "text");
    await createStreamHandler("/ai/tutor-chat", payload, onChunk);
  },

  extractConcepts: (data: {
    text: string;
    existing_nodes?: string[];
    max_concepts?: number;
    provider?: string;
    model?: string;
  }) => {
    const payload = injectAIConfig(data, "text");
    return mobileAiClient.post("/ai/extract-concepts", payload);
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
    return mobileAiClient.post("/ai/suggest-next-topic", payload);
  },

  generatePodcastScript: (
    context: string,
    language: string = "zh",
    graph_id?: string,
  ) => {
    const payload = injectAIConfig({ context, language, graph_id }, "text");
    return mobileAiClient.post("/ai/podcast/script", payload);
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
    return mobileAiClient.post("/ai/cross-graph-connections", payload);
  },

  aiActions: {
    list: (graphId?: string) =>
      mobileAiClient.get(`/ai-actions${graphId ? `?graph_id=${graphId}` : ""}`),
    create: (data: Partial<AIAction>) =>
      mobileAiClient.post("/ai-actions", data),
    update: (id: string, data: Partial<AIAction>) =>
      mobileAiClient.put(`/ai-actions/${id}`, data),
    delete: (id: string) => mobileAiClient.delete(`/ai-actions/${id}`),
    execute: (data: {
      action_id: string;
      node_id: string;
      graph_id?: string;
    }) => mobileAiClient.post("/ai-actions/execute", data),
  },
};
