// Inline types for Regions API

export type GraphViewMode = "mindmap" | "timeline" | "tree";

export interface CustomRegion {
  id: string;
  name: string;
  color: string;
  nodeIds: string[];
  createdAt: string;
  updatedAt: string;
}

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

export interface IRegionsApi {
  list(graphId: string): Promise<{ regions: CustomRegion[] }>;

  create(graphId: string, data: CreateRegionData): Promise<CustomRegion>;

  update(graphId: string, regionId: string, data: UpdateRegionData): Promise<CustomRegion>;

  delete(graphId: string, regionId: string): Promise<{ success: boolean; message: string }>;

  updateViewMode(graphId: string, viewMode: GraphViewMode): Promise<unknown>;
}
