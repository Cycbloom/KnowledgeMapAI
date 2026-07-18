import { useStore } from "@/store/useStore";
import { createErrorFromResponse } from "@/utils/errors";
import { getMobileApiBaseUrl } from "@/config/mobileApiConfig";
import type { BacklinkItem, OutlinkItem, KnowledgePointSearchHit, NodeBlockRefBacklink } from "@shared/types";
import type { IBacklinksApi } from "../api/contracts/IBacklinksApi";

const baseURL = getMobileApiBaseUrl();

const buildHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {
    "x-mobile-client": "true",
  };
  const token = useStore.getState().token;
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
};

const get = async <T>(url: string): Promise<T> => {
  const fullUrl = url.startsWith("http") ? url : `${baseURL}${url}`;
  let response: Response;
  try {
    response = await fetch(fullUrl, {
      credentials: "include",
      headers: buildHeaders(),
    });
  } catch (error) {
    throw createErrorFromResponse({
      status: 0,
      statusText: error instanceof Error ? error.message : String(error),
    });
  }

  let body: unknown = undefined;
  const text = await response.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!response.ok) {
    throw createErrorFromResponse({
      status: response.status,
      statusText: response.statusText,
      data: body as
        | {
            message?: string;
            error?: string;
            code?: string;
            details?: Array<{ field: string; message: string }>;
          }
        | undefined,
    });
  }

  return body as T;
};

export const mobileBacklinksApi: IBacklinksApi = {
  list: (knowledgePointId: string): Promise<BacklinkItem[]> =>
    get<BacklinkItem[]>(`/backlinks/${knowledgePointId}`),

  getOutlinks: (knowledgePointId: string): Promise<OutlinkItem[]> =>
    get<OutlinkItem[]>(`/backlinks/${knowledgePointId}/outlinks`),

  search: (
    query: string,
    options?: { graphId?: string; limit?: number },
  ): Promise<KnowledgePointSearchHit[]> => {
    const params = new URLSearchParams({ q: query });
    if (options?.graphId) params.set("graphId", options.graphId);
    if (options?.limit) params.set("limit", String(options.limit));
    return get<KnowledgePointSearchHit[]>(`/backlinks/search?${params.toString()}`);
  },

  getBlockRefBacklinks: (knowledgePointId: string): Promise<NodeBlockRefBacklink[]> =>
    get<NodeBlockRefBacklink[]>(`/backlinks/${knowledgePointId}/block-refs`),
};
