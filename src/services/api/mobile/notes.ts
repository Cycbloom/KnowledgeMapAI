/**
 * Mobile 层笔记 API(P3 块引用/块嵌入只读子集)。
 *
 * 复用 api 层后端的 4 个块引用只读端点(GET),
 * 通过 axios + x-mobile-client 头走移动端鉴权(对齐 mobile/backlinks.ts 风格)。
 *
 * 不提供笔记本体 CRUD——移动端笔记 CRUD 由 Supabase 直连实现,
 * 块引用端点为后端聚合查询(含 JOIN 笔记标题),仍走 HTTP。
 *
 * 方法命名与 api 层 notesApi 对齐(api-naming-conventions §6.1)。
 */
import axios, { type AxiosInstance } from 'axios';
import { useStore } from '@/store/useStore';
import { createErrorFromResponse } from '@/utils/errors';
import { getMobileApiBaseUrl } from '@/config/mobileApiConfig';
import type {
  BlockContent,
  BlockRef,
  BlockRefTarget,
} from '@shared/types/note';
import type { IMobileNotesApi } from '../contracts/IMobileNotesApi';

const createMobileNotesClient = (): AxiosInstance => {
  const client = axios.create({
    baseURL: getMobileApiBaseUrl(),
    withCredentials: true,
    headers: {
      'x-mobile-client': 'true',
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

const mobileNotesClient = createMobileNotesClient();

const get = async <T>(url: string): Promise<T> => {
  return mobileNotesClient.get(url) as unknown as Promise<T>;
};

export const mobileNotesApi: IMobileNotesApi = {
  getBlock: (noteId: string, blockId: string): Promise<BlockContent> =>
    get<BlockContent>(`/notes/${noteId}/blocks/${blockId}`),

  getInboundBlockRefs: (noteId: string): Promise<BlockRef[]> =>
    get<BlockRef[]>(`/notes/${noteId}/block-refs/inbound`),

  getOutboundBlockRefs: (noteId: string): Promise<BlockRef[]> =>
    get<BlockRef[]>(`/notes/${noteId}/block-refs/outbound`),

  searchBlocks: (
    query: string,
    limit?: number,
  ): Promise<BlockRefTarget[]> => {
    const params = new URLSearchParams({ q: query });
    if (limit !== undefined) params.set('limit', String(limit));
    return get<BlockRefTarget[]>(`/notes/block-search?${params.toString()}`);
  },
};
