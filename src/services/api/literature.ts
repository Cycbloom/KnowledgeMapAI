import { request, getAIConfig } from "./client";
import type {
  LiteratureExtractRequest,
  LiteratureExtractResponse,
  LiteratureApplyRequest,
  LiteratureApplyResponse,
} from "@shared/types/graph";

export const literatureApi = {
  extractConcepts: (
    data: LiteratureExtractRequest,
  ): Promise<LiteratureExtractResponse> => {
    const config = getAIConfig("text");
    const formData = new FormData();

    formData.append("graph_id", data.graph_id);

    if (data.content) {
      formData.append("content", data.content);
    }

    if (data.file) {
      formData.append("file", data.file);
    }

    if (data.url) {
      formData.append("url", data.url);
    }

    if (data.options) {
      formData.append("options", JSON.stringify(data.options));
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
