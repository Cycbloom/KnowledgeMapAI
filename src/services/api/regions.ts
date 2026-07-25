import { request } from "./client";
import type { CustomRegion, GraphViewMode } from "@shared/types/graph";

export interface CreateRegionData {
  name: string;
  color: string;
  nodeIds: string[];
}

export interface UpdateRegionData {
  name?: string;
  color?: string;
  nodeIds?: string[];
}

export const regionsApi = {
  list: (graphId: string): Promise<{ regions: CustomRegion[] }> =>
    request<{ regions: CustomRegion[] }>(`/graphs/${graphId}/regions`),

  create: (graphId: string, data: CreateRegionData): Promise<CustomRegion> =>
    request<CustomRegion>(`/graphs/${graphId}/regions`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (
    graphId: string,
    regionId: string,
    data: UpdateRegionData,
  ): Promise<CustomRegion> =>
    request<CustomRegion>(`/graphs/${graphId}/regions/${regionId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  delete: (
    graphId: string,
    regionId: string,
  ): Promise<{ success: boolean; message: string }> =>
    request<{ success: boolean; message: string }>(
      `/graphs/${graphId}/regions/${regionId}`,
      {
        method: "DELETE",
      },
    ),

  updateViewMode: (
    graphId: string,
    viewMode: GraphViewMode,
  ): Promise<unknown> =>
    request<unknown>(`/graphs/${graphId}/view-mode`, {
      method: "PUT",
      body: JSON.stringify({ viewMode }),
    }),
};
