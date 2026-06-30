// 网络分析与象限视图相关类型
// NetworkAnalysisResult, CustomRegion, QuadrantViewState, RegionInfo

import type { Node } from "./graph-node";

export interface NetworkAnalysisResult {
  nodeCount: number;
  edgeCount: number;
  density: number;
  isolatedNodes: string[];
  averageClusteringCoefficient: number;
  centrality: {
    degree: Record<string, number>;
    betweenness: Record<string, number>;
    closeness: Record<string, number>;
  };
  modules: Array<{
    module: string;
    nodeCount: number;
    edgeCount: number;
    density: number;
  }>;
  bridges: Array<{
    nodeId: string;
    title: string;
    connectsModules: string[];
    bridgeScore: number;
  }>;
  healthScore: number;
}

export interface CustomRegion {
  id: string;
  name: string;
  color: string;
  nodeIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface QuadrantViewState {
  originPosition: { x: number; y: number };
  collapsedRegions: string[];
  customRegions: CustomRegion[];
}

export interface RegionInfo {
  id: string;
  name: string;
  color: string;
  icon?: string;
  angleStart: number;
  angleEnd: number;
  nodes: Node[];
  isCollapsed: boolean;
}
