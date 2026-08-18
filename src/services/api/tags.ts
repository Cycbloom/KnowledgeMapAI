import { request } from "./client";
import type { ITagsApi, TagResourceCounts, TagSummary } from "./contracts/ITagsApi";

export type { TagResourceCounts, TagSummary } from "./contracts/ITagsApi";

export const tagsApi: ITagsApi = {
  list: () => request<{ tags: TagSummary[] }>("/tags"),

  rename: (from: string, to: string) =>
    request<{ updated: TagResourceCounts }>("/tags/rename", {
      method: "POST",
      body: JSON.stringify({ from, to }),
    }),

  merge: (sources: string[], target: string) =>
    request<{ updated: TagResourceCounts }>("/tags/merge", {
      method: "POST",
      body: JSON.stringify({ sources, target }),
    }),

  delete: (name: string) =>
    request<{ removed: TagResourceCounts }>(
      `/tags/${encodeURIComponent(name)}`,
      { method: "DELETE" },
    ),
};
