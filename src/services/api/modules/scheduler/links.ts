import { requestData } from "../../client";
import type { TaskLink, LinkType } from "@shared/types";

// Re-export for backwards compatibility with existing imports.
export type { TaskLink, LinkType };

export const linksApi = {
  getLinks: (taskId: string): Promise<TaskLink[]> =>
    requestData<TaskLink[]>(`/scheduler/tasks/${taskId}/links`),

  createLink: (
    taskId: string,
    data: {
      link_type?: LinkType;
      title?: string;
      url: string;
      description?: string;
      icon?: string;
      metadata?: Record<string, unknown>;
    },
  ): Promise<TaskLink> =>
    requestData<TaskLink>(`/scheduler/tasks/${taskId}/links`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getLinkMetadata: (
    url: string,
  ): Promise<{ title: string; description: string }> =>
    requestData<{ title: string; description: string }>(
      "/scheduler/tasks/link-metadata",
      {
        method: "POST",
        body: JSON.stringify({ url }),
      },
    ),

  updateLink: (
    taskId: string,
    linkId: string,
    data: {
      title?: string;
      description?: string;
      icon?: string;
      metadata?: Record<string, unknown>;
    },
  ): Promise<TaskLink> =>
    requestData<TaskLink>(`/scheduler/tasks/${taskId}/links/${linkId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  deleteLink: (taskId: string, linkId: string): Promise<void> =>
    requestData<void>(`/scheduler/tasks/${taskId}/links/${linkId}`, {
      method: "DELETE",
    }),
};
