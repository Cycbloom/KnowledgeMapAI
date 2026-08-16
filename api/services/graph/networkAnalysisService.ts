import { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "../../utils/logger";
import type { NodeLevel, NetworkAnalysisResult } from "../../../shared/types/graph";
import { notDeleted } from '../common/softDeleteHelper';

interface GraphNodeData {
  graphNodeId: string;
  kpId: string;
  title: string;
  level: NodeLevel;
  module?: string;
}

interface GraphEdgeData {
  source: string;
  target: string;
}

export class NetworkAnalysisService {
  async analyzeGraph(
    supabase: SupabaseClient,
    graphId: string,
  ): Promise<NetworkAnalysisResult> {
    const { data: graphNodes, error: gnError } = await notDeleted(supabase
      .from("graph_nodes")
      .select(
        `
        id,
        knowledge_point_id,
        level,
        knowledge_points (
          id,
          title,
          properties
        )
      `,
      )
      .eq("graph_id", graphId)
      );

    if (gnError || !graphNodes) {
      logger.error("Failed to fetch graph nodes for analysis:", gnError);
      return this.emptyResult();
    }

    const nodes: GraphNodeData[] = graphNodes.map((gn) => {
      const kp = gn.knowledge_points as unknown as {
        id: string;
        title: string;
        properties?: { backboneModule?: string };
      };
      return {
        graphNodeId: gn.id,
        kpId: kp?.id || "",
        title: kp?.title || "Unknown",
        level: gn.level as NodeLevel,
        module: kp?.properties?.backboneModule as string | undefined,
      };
    });

    const { data: edges, error: edgeError } = await notDeleted(supabase
      .from("edges")
      .select("source_knowledge_point_id, target_knowledge_point_id")
      .eq("graph_id", graphId)
      );

    if (edgeError) {
      logger.error("Failed to fetch edges for analysis:", edgeError);
      return this.emptyResult();
    }

    const kpIdToGraphNodeId = new Map<string, string>();
    for (const node of nodes) {
      kpIdToGraphNodeId.set(node.kpId, node.graphNodeId);
    }

    const graphEdges: GraphEdgeData[] = [];
    for (const edge of edges || []) {
      const sourceGN = kpIdToGraphNodeId.get(edge.source_knowledge_point_id);
      const targetGN = kpIdToGraphNodeId.get(edge.target_knowledge_point_id);
      if (sourceGN && targetGN) {
        graphEdges.push({ source: sourceGN, target: targetGN });
      }
    }

    return this.computeAnalysis(nodes, graphEdges);
  }

  private computeAnalysis(
    nodes: GraphNodeData[],
    edges: GraphEdgeData[],
  ): NetworkAnalysisResult {
    const nodeCount = nodes.length;
    const edgeCount = edges.length;

    const adjacency = this.buildAdjacency(nodes, edges);

    const density =
      nodeCount > 1 ? (2 * edgeCount) / (nodeCount * (nodeCount - 1)) : 0;

    const isolatedNodes = this.findIsolatedNodes(nodes, adjacency);

    const avgClusteringCoeff = this.computeAverageClusteringCoefficient(
      nodes,
      adjacency,
    );

    const degreeCentrality = this.computeDegreeCentrality(nodes, adjacency);
    const betweennessCentrality = this.computeBetweennessCentrality(
      nodes,
      adjacency,
    );
    const closenessCentrality = this.computeClosenessCentrality(
      nodes,
      adjacency,
    );

    const moduleStats = this.computeModuleStats(nodes, edges);

    const bridges = this.findBridges(nodes, adjacency, moduleStats);

    const healthScore = this.computeHealthScore({
      nodeCount,
      edgeCount,
      density,
      isolatedNodes,
      avgClusteringCoeff,
      moduleStats,
    });

    return {
      nodeCount,
      edgeCount,
      density: Math.round(density * 10000) / 10000,
      isolatedNodes,
      averageClusteringCoefficient:
        Math.round(avgClusteringCoeff * 10000) / 10000,
      centrality: {
        degree: degreeCentrality,
        betweenness: betweennessCentrality,
        closeness: closenessCentrality,
      },
      modules: moduleStats,
      bridges,
      healthScore: Math.round(healthScore * 100) / 100,
    };
  }

  private buildAdjacency(
    nodes: GraphNodeData[],
    edges: GraphEdgeData[],
  ): Map<string, Set<string>> {
    const adj = new Map<string, Set<string>>();
    for (const node of nodes) {
      adj.set(node.graphNodeId, new Set());
    }
    for (const edge of edges) {
      adj.get(edge.source)?.add(edge.target);
      adj.get(edge.target)?.add(edge.source);
    }
    return adj;
  }

  private findIsolatedNodes(
    nodes: GraphNodeData[],
    adjacency: Map<string, Set<string>>,
  ): string[] {
    const isolated: string[] = [];
    for (const node of nodes) {
      const neighbors = adjacency.get(node.graphNodeId);
      if (!neighbors || neighbors.size === 0) {
        isolated.push(node.title);
      }
    }
    return isolated;
  }

  private computeDegreeCentrality(
    nodes: GraphNodeData[],
    adjacency: Map<string, Set<string>>,
  ): Record<string, number> {
    const result: Record<string, number> = {};
    const maxDegree = nodes.length > 1 ? nodes.length - 1 : 1;
    for (const node of nodes) {
      const degree = adjacency.get(node.graphNodeId)?.size || 0;
      result[node.title] = Math.round((degree / maxDegree) * 10000) / 10000;
    }
    return result;
  }

  private computeBetweennessCentrality(
    nodes: GraphNodeData[],
    adjacency: Map<string, Set<string>>,
  ): Record<string, number> {
    const result: Record<string, number> = {};
    const nodeIds = nodes.map((n) => n.graphNodeId);
    const idToTitle = new Map(nodes.map((n) => [n.graphNodeId, n.title]));

    for (const nodeId of nodeIds) {
      result[idToTitle.get(nodeId) || nodeId] = 0;
    }

    const n = nodeIds.length;
    const norm = n > 2 ? ((n - 1) * (n - 2)) / 2 : 1;

    for (const nodeId of nodeIds) {
      const paths = this.bfsShortestPaths(nodeId, adjacency);
      let total = 0;
      for (const target of nodeIds) {
        if (target === nodeId) continue;
        for (const via of nodeIds) {
          if (via === nodeId || via === target) continue;
          const targetPaths = paths.get(target);
          if (targetPaths && targetPaths.has(via)) {
            total++;
          }
        }
      }
      result[idToTitle.get(nodeId) || nodeId] =
        Math.round((total / norm) * 10000) / 10000;
    }

    return result;
  }

  private bfsShortestPaths(
    source: string,
    adjacency: Map<string, Set<string>>,
  ): Map<string, Set<string>> {
    const distances = new Map<string, number>();
    const predecessors = new Map<string, Set<string>>();
    const queue: string[] = [];

    distances.set(source, 0);
    predecessors.set(source, new Set());
    queue.push(source);

    while (queue.length > 0) {
      const current = queue.shift();
      if (current === undefined) break;
      const dist = distances.get(current);
      if (dist === undefined) continue;
      const neighbors = adjacency.get(current) || new Set();

      for (const neighbor of neighbors) {
        if (!distances.has(neighbor)) {
          distances.set(neighbor, dist + 1);
          predecessors.set(neighbor, new Set([current]));
          queue.push(neighbor);
        } else if (distances.get(neighbor) === dist + 1) {
          predecessors.get(neighbor)?.add(current);
        }
      }
    }

    return predecessors;
  }

  private computeClosenessCentrality(
    nodes: GraphNodeData[],
    adjacency: Map<string, Set<string>>,
  ): Record<string, number> {
    const result: Record<string, number> = {};
    const n = nodes.length;

    for (const node of nodes) {
      const distances = this.computeDistances(node.graphNodeId, adjacency);

      // 复杂度降低：单趟遍历，合并 filter+reduce 的两次扫描
      let reachableCount = 0;
      let sumDist = 0;
      for (const d of distances.values()) {
        if (d > 0) {
          reachableCount++;
          sumDist += d;
        }
      }

      if (reachableCount === 0) {
        result[node.title] = 0;
      } else {
        const closeness =
          (reachableCount / (n - 1)) * (reachableCount / sumDist);
        result[node.title] = Math.round(closeness * 10000) / 10000;
      }
    }

    return result;
  }

  private computeDistances(
    source: string,
    adjacency: Map<string, Set<string>>,
  ): Map<string, number> {
    const distances = new Map<string, number>();
    const queue: string[] = [];

    distances.set(source, 0);
    queue.push(source);

    while (queue.length > 0) {
      const current = queue.shift();
      if (current === undefined) break;
      const dist = distances.get(current);
      if (dist === undefined) continue;
      const neighbors = adjacency.get(current) || new Set();

      for (const neighbor of neighbors) {
        if (!distances.has(neighbor)) {
          distances.set(neighbor, dist + 1);
          queue.push(neighbor);
        }
      }
    }

    return distances;
  }

  private computeAverageClusteringCoefficient(
    nodes: GraphNodeData[],
    adjacency: Map<string, Set<string>>,
  ): number {
    let totalCoeff = 0;
    let count = 0;

    for (const node of nodes) {
      const neighbors = Array.from(adjacency.get(node.graphNodeId) || []);
      const k = neighbors.length;
      if (k < 2) continue;

      let edgesBetweenNeighbors = 0;
      for (let i = 0; i < neighbors.length; i++) {
        for (let j = i + 1; j < neighbors.length; j++) {
          if (adjacency.get(neighbors[i])?.has(neighbors[j])) {
            edgesBetweenNeighbors++;
          }
        }
      }

      totalCoeff += (2 * edgesBetweenNeighbors) / (k * (k - 1));
      count++;
    }

    return count > 0 ? totalCoeff / count : 0;
  }

  private computeModuleStats(
    nodes: GraphNodeData[],
    edges: GraphEdgeData[],
  ): Array<{
    module: string;
    nodeCount: number;
    edgeCount: number;
    density: number;
  }> {
    const moduleMap = new Map<string, GraphNodeData[]>();
    const noModule = "未分类";

    for (const node of nodes) {
      const module = node.module || noModule;
      if (!moduleMap.has(module)) {
        moduleMap.set(module, []);
      }
      const list = moduleMap.get(module);
      if (list) {
        list.push(node);
      }
    }

    const nodeIdToModule = new Map<string, string>();
    for (const node of nodes) {
      nodeIdToModule.set(node.graphNodeId, node.module || noModule);
    }

    const moduleEdgeCounts = new Map<string, number>();
    for (const edge of edges) {
      const srcModule = nodeIdToModule.get(edge.source);
      const tgtModule = nodeIdToModule.get(edge.target);
      if (srcModule && tgtModule && srcModule === tgtModule) {
        moduleEdgeCounts.set(
          srcModule,
          (moduleEdgeCounts.get(srcModule) || 0) + 1,
        );
      }
    }

    return Array.from(moduleMap.entries()).map(([module, moduleNodes]) => {
      const n = moduleNodes.length;
      const e = moduleEdgeCounts.get(module) || 0;
      const d = n > 1 ? (2 * e) / (n * (n - 1)) : 0;
      return {
        module,
        nodeCount: n,
        edgeCount: e,
        density: Math.round(d * 10000) / 10000,
      };
    });
  }

  private findBridges(
    nodes: GraphNodeData[],
    adjacency: Map<string, Set<string>>,
    moduleStats: Array<{
      module: string;
      nodeCount: number;
      edgeCount: number;
      density: number;
    }>,
  ): Array<{
    nodeId: string;
    title: string;
    connectsModules: string[];
    bridgeScore: number;
  }> {
    const nodeIdToModule = new Map<string, string>();
    for (const node of nodes) {
      nodeIdToModule.set(node.graphNodeId, node.module || "未分类");
    }

    const bridges: Array<{
      nodeId: string;
      title: string;
      connectsModules: string[];
      bridgeScore: number;
    }> = [];

    for (const node of nodes) {
      const neighbors = adjacency.get(node.graphNodeId) || new Set();
      if (neighbors.size < 2) continue;

      const connectedModules = new Set<string>();
      for (const neighborId of neighbors) {
        const neighborModule = nodeIdToModule.get(neighborId);
        if (neighborModule && neighborModule !== (node.module || "未分类")) {
          connectedModules.add(neighborModule);
        }
      }

      if (connectedModules.size >= 1) {
        const bridgeScore =
          (connectedModules.size / Math.max(1, moduleStats.length)) *
          (neighbors.size / Math.max(1, nodes.length)) *
          100;

        bridges.push({
          nodeId: node.graphNodeId,
          title: node.title,
          connectsModules: Array.from(connectedModules),
          bridgeScore: Math.round(bridgeScore * 100) / 100,
        });
      }
    }

    bridges.sort((a, b) => b.bridgeScore - a.bridgeScore);
    return bridges.slice(0, 20);
  }

  private computeHealthScore(params: {
    nodeCount: number;
    edgeCount: number;
    density: number;
    isolatedNodes: string[];
    avgClusteringCoeff: number;
    moduleStats: Array<{
      module: string;
      nodeCount: number;
      edgeCount: number;
      density: number;
    }>;
  }): number {
    let score = 0;

    if (params.nodeCount >= 5) score += 20;
    else if (params.nodeCount >= 2) score += 10;

    if (params.density >= 0.15) score += 20;
    else if (params.density >= 0.05) score += 10;

    const isolatedRatio =
      params.nodeCount > 0 ? params.isolatedNodes.length / params.nodeCount : 1;
    if (isolatedRatio < 0.1) score += 20;
    else if (isolatedRatio < 0.3) score += 10;

    if (params.avgClusteringCoeff >= 0.3) score += 20;
    else if (params.avgClusteringCoeff >= 0.1) score += 10;

    const modulesWithNodes = params.moduleStats.filter((m) => m.nodeCount > 0);
    if (modulesWithNodes.length >= 4) score += 20;
    else if (modulesWithNodes.length >= 2) score += 10;

    return Math.min(100, score);
  }

  private emptyResult(): NetworkAnalysisResult {
    return {
      nodeCount: 0,
      edgeCount: 0,
      density: 0,
      isolatedNodes: [],
      averageClusteringCoefficient: 0,
      centrality: { degree: {}, betweenness: {}, closeness: {} },
      modules: [],
      bridges: [],
      healthScore: 0,
    };
  }
}

export const networkAnalysisService = new NetworkAnalysisService();
