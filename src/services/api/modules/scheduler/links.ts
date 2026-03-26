import { request } from "../../client";

export type LinkType = "web" | "file" | "api";

export interface TaskLink {
  id: string;
  task_id: string;
  link_type: LinkType;
  title?: string;
  url: string;
  description?: string;
  icon?: string;
  metadata?: Record<string, unknown>;
  position: number;
  created_at: string;
  updated_at: string;
}

export const linksApi = {
  getLinks: (taskId: string) => request(`/scheduler/tasks/${taskId}/links`),

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
  ) =>
    request(`/scheduler/tasks/${taskId}/links`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateLink: (
    taskId: string,
    linkId: string,
    data: {
      title?: string;
      description?: string;
      icon?: string;
      metadata?: Record<string, unknown>;
    },
  ) =>
    request(`/scheduler/tasks/${taskId}/links/${linkId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  deleteLink: (taskId: string, linkId: string) =>
    request(`/scheduler/tasks/${taskId}/links/${linkId}`, { method: "DELETE" }),
};
