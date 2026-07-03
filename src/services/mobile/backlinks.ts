import axios, { AxiosInstance } from "axios";
import { useStore } from "@/store/useStore";
import { createErrorFromResponse } from "@/utils/errors";
import { getMobileApiBaseUrl } from "@/config/mobileApiConfig";
import type { BacklinkItem, OutlinkItem, KnowledgePointSearchHit, NodeBlockRefBacklink } from "@shared/types";
import type { IBacklinksApi } from "../api/contracts/IBacklinksApi";

const createMobileBacklinksClient = (): AxiosInstance => {
  const client = axios.create({
    baseURL: getMobileApiBaseUrl(),
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
    (error) => {
      const appError = createErrorFromResponse({
        status: error.response?.status || 0,
        statusText: error.message,
        data: error.response?.data as Record<string, unknown>,
      });
      return Promise.reject(appError);
    },
  );

  return client;
};

const mobileBacklinksClient = createMobileBacklinksClient();

const get = async <T>(url: string): Promise<T> => {
  return mobileBacklinksClient.get(url) as unknown as Promise<T>;
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
