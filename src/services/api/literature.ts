import { request, getAIConfig } from "./client";
import type {
  LiteratureExtractRequest,
  LiteratureExtractResponse,
  LiteratureApplyRequest,
  LiteratureApplyResponse,
  LiteratureMetadata,
  LiteratureInfo,
} from "@shared/types/graph";

export const literatureApi = {
  extractMetadata: async (data: {
    content?: string;
    url?: string;
    file?: File;
  }): Promise<{
    metadata: LiteratureMetadata;
    confidence: number;
  }> => {
    const config = getAIConfig("text");

    if (data.file) {
      const formData = new FormData();
      formData.append("file", data.file);
      if (config.provider) formData.append("provider", config.provider);
      if (config.model) formData.append("model", config.model);
      return request("/literature/metadata", {
        method: "POST",
        body: formData,
      });
    }

    return request("/literature/metadata", {
      method: "POST",
      body: JSON.stringify({
        content: data.content,
        url: data.url,
        provider: config.provider,
        model: config.model,
      }),
    });
  },

  extractConcepts: (
    data: LiteratureExtractRequest & {
      literature?: Partial<LiteratureInfo>;
      autoDetectMetadata?: boolean;
    },
  ): Promise<LiteratureExtractResponse> => {
    const config = getAIConfig("text");

    if (data.file) {
      const formData = new FormData();
      formData.append("graph_id", data.graph_id);
      formData.append("file", data.file);

      if (data.content) {
        formData.append("content", data.content);
      }
      if (data.url) {
        formData.append("url", data.url);
      }
      if (data.options) {
        formData.append("options", JSON.stringify(data.options));
      }
      if (data.literature) {
        formData.append("literature", JSON.stringify(data.literature));
      }
      if (data.autoDetectMetadata !== undefined) {
        formData.append("autoDetectMetadata", String(data.autoDetectMetadata));
      }
      if (config.provider) {
        formData.append("provider", config.provider);
      }
      if (config.model) {
        formData.append("model", config.model);
      }

      return request("/literature/extract", {
        method: "POST",
        body: formData,
      });
    }

    return request("/literature/extract", {
      method: "POST",
      body: JSON.stringify({
        graph_id: data.graph_id,
        content: data.content,
        url: data.url,
        literature: data.literature,
        options: data.options,
        autoDetectMetadata: data.autoDetectMetadata,
        provider: config.provider,
        model: config.model,
      }),
    });
  },

  applyConcepts: (
    data: LiteratureApplyRequest,
  ): Promise<LiteratureApplyResponse> => {
    return request("/literature/apply", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
};
