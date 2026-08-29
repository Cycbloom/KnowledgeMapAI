import type { Node, Edge } from "@shared/types";
import {
  BackboneModule,
  BACKBONE_MODULE_LABEL_I18N_KEYS,
  BACKBONE_MODULE_COLORS,
  BACKBONE_MODULE_ICONS,
  type CustomRegion,
  type RegionInfo,
  type GraphBackboneModule,
} from "@shared/types/graph";
import { HIERARCHICAL_EDGE_TYPES } from "../../config/relationshipTypes";
import i18n from "../../i18n";

/** 分支合并过程中的候选区域（未分配色相/角度的中间结构） */
interface CandidateRegion {
  id: string;
  name: string;
  nodes: Node[];
}

const normalizeRegionNodeId = (id: string | number): string =>
  String(id).trim();

/** 按节点总数启发式决定目标象限数（区间 [2, 6]） */
function targetRegionCount(nodeCount: number): number {
  if (nodeCount <= 10) return 2;
  if (nodeCount <= 20) return 3;
  if (nodeCount <= 50) return 4;
  if (nodeCount <= 100) return 5;
  return 6;
}

/**
 * 将多余区域合并到 target 个：每次取节点数最少的区域，
 * 合并到与之共享无向边最多的区域；无共享边则合并到数组序前一个区域。
 */
function mergeRegions(
  regions: CandidateRegion[],
  edges: Edge[],
  target: number,
): CandidateRegion[] {
  const result = regions.map((r) => ({ ...r, nodes: [...r.nodes] }));

  // 无向邻接表：用于衡量区域间邻近性（任意关系类型）
  const adjacency = new Map<string, Set<string>>();
  regions.forEach((r) =>
    r.nodes.forEach((n) => adjacency.set(normalizeRegionNodeId(n.id), new Set())),
  );
  edges.forEach((e) => {
    const s = normalizeRegionNodeId(e.source_knowledge_point_id);
    const t = normalizeRegionNodeId(e.target_knowledge_point_id);
    adjacency.get(s)?.add(t);
    adjacency.get(t)?.add(s);
  });

  while (result.length > target && result.length > 1) {
    let minIdx = 0;
    for (let i = 1; i < result.length; i++) {
      if (result[i].nodes.length < result[minIdx].nodes.length) minIdx = i;
    }
    const small = result[minIdx];
    const regionSets = result.map((r) =>
      new Set(r.nodes.map((n) => normalizeRegionNodeId(n.id))),
    );

    let bestIdx = -1;
    let bestShared = -1;
    for (let i = 0; i < result.length; i++) {
      if (i === minIdx) continue;
      let shared = 0;
      for (const n of small.nodes) {
        const neighbors = adjacency.get(normalizeRegionNodeId(n.id));
        if (!neighbors) continue;
        for (const nb of neighbors) {
          if (regionSets[i].has(nb)) shared++;
        }
      }
      if (shared > bestShared) {
        bestShared = shared;
        bestIdx = i;
      }
    }
    // 无共享边 → 合并到数组序前一个区域
    if (bestIdx < 0) {
      bestIdx = minIdx === 0 ? 1 : minIdx - 1;
    }
    result[bestIdx].nodes = [...result[bestIdx].nodes, ...small.nodes];
    result.splice(minIdx, 1);
  }

  return result;
}

/**
 * 按层级树的一级分支划分象限区域。
 * - 基于层级边（relationship_type 为空视为层级边）构建树；
 * - 根的直接子节点（含整棵子树）各成一个候选区域；
 * - 未入树的孤立节点归入"其他"区域；
 * - 超过目标象限数时自动合并最小分支；
 * - 无法建树或合并后不足 2 个区域时返回 null（调用方退化为 level 分组）。
 */
export function computeBranchRegions(
  nodes: Node[],
  edges: Edge[],
  collapsedRegions: string[],
): RegionInfo[] | null {
  if (nodes.length === 0) return null;
  if (edges.length === 0) return null;

  const hierarchicalEdges = edges.filter(
    (e) =>
      !e.relationship_type || HIERARCHICAL_EDGE_TYPES.has(e.relationship_type),
  );
  if (hierarchicalEdges.length === 0) return null;

  const nodeById = new Map<string, Node>();
  const childrenMap = new Map<string, Node[]>();
  nodes.forEach((n) => {
    const id = normalizeRegionNodeId(n.id);
    nodeById.set(id, n);
    childrenMap.set(id, []);
  });

  const incomingSet = new Set<string>();
  const outDegree = new Map<string, number>();
  hierarchicalEdges.forEach((e) => {
    const src = normalizeRegionNodeId(e.source_knowledge_point_id);
    const tgt = normalizeRegionNodeId(e.target_knowledge_point_id);
    incomingSet.add(tgt);
    outDegree.set(src, (outDegree.get(src) ?? 0) + 1);
    const targetNode = nodeById.get(tgt);
    if (targetNode && childrenMap.has(src)) {
      childrenMap.get(src)?.push(targetNode);
    }
  });

  // 找根：无层级边入边的节点；无则取层级边出度最大节点；仍无 → null
  const rootNodes = nodes.filter(
    (n) => !incomingSet.has(normalizeRegionNodeId(n.id)),
  );
  let rootId: string;
  if (rootNodes.length > 0) {
    rootId = normalizeRegionNodeId(rootNodes[0].id);
  } else {
    let maxOut = -1;
    let maxOutId = "";
    nodes.forEach((n) => {
      const id = normalizeRegionNodeId(n.id);
      const out = outDegree.get(id) ?? 0;
      if (out > maxOut) {
        maxOut = out;
        maxOutId = id;
      }
    });
    if (!maxOutId) return null;
    rootId = maxOutId;
  }

  // 收集根的直接子节点（一级分支）
  const branchRoots = childrenMap.get(rootId) ?? [];
  if (branchRoots.length === 0) return null;

  const collectSubtree = (branchRootId: string): Node[] => {
    const result: Node[] = [];
    const visited = new Set<string>([branchRootId]);
    const queue = [branchRootId];
    while (queue.length > 0) {
      const cur = queue.shift();
      if (!cur) continue;
      const node = nodeById.get(cur);
      if (node) result.push(node);
      const children = childrenMap.get(cur) ?? [];
      for (const child of children) {
        const cid = normalizeRegionNodeId(child.id);
        if (!visited.has(cid)) {
          visited.add(cid);
          queue.push(cid);
        }
      }
    }
    return result;
  };

  const candidates: CandidateRegion[] = [];
  const coveredIds = new Set<string>([rootId]);
  branchRoots.forEach((branchRoot) => {
    const bid = normalizeRegionNodeId(branchRoot.id);
    const subtree = collectSubtree(bid);
    subtree.forEach((n) => coveredIds.add(normalizeRegionNodeId(n.id)));
    candidates.push({ id: `branch-${bid}`, name: branchRoot.title, nodes: subtree });
  });

  // root 节点附加到第一个分支（root 显示在圆心附近，归属不影响角度划分意义）
  const rootNode = nodeById.get(rootId);
  if (rootNode && candidates.length > 0) {
    candidates[0].nodes = [rootNode, ...candidates[0].nodes];
  }

  // 未入树节点归入"其他"区域
  const others: Node[] = [];
  nodes.forEach((n) => {
    if (!coveredIds.has(normalizeRegionNodeId(n.id))) others.push(n);
  });
  if (others.length > 0) {
    candidates.push({
      id: "region-others",
      name: i18n.t("graphEditor.regionHeader.others", {
        defaultValue: "其他",
      }),
      nodes: others,
    });
  }

  // 自动合并/拆分到目标象限数
  const target = targetRegionCount(nodes.length);
  const merged = mergeRegions(candidates, edges, target);
  if (merged.length < 2) return null;

  const angleStep = (2 * Math.PI) / merged.length;
  const collapsedSet = new Set(collapsedRegions);

  return merged.map((region, index) => ({
    id: region.id,
    name: region.name,
    color: `hsl(${(index * 360) / merged.length}, 70%, 50%)`,
    angleStart: index * angleStep,
    angleEnd: (index + 1) * angleStep,
    nodes: region.nodes,
    isCollapsed: collapsedSet.has(region.id),
  }));
}

export interface ComputeRegionsParams {
  nodes: Node[];
  edges: Edge[];
  templateType?: string;
  backboneModules?: GraphBackboneModule[];
  customRegions: CustomRegion[];
  collapsedRegions: string[];
}

export function computeRegions(params: ComputeRegionsParams): RegionInfo[] {
  const {
    nodes,
    edges,
    templateType,
    backboneModules,
    customRegions,
    collapsedRegions,
  } = params;

  if (nodes.length === 0) return [];

  const isTopicResearch = templateType === "topic_research";

  // 复杂度降低：预构建折叠区域 Set，替代多个 map 循环内 collapsedRegions.includes 的 O(regions*collapsed) 线性扫描
  const collapsedSet = new Set(collapsedRegions);

  if (isTopicResearch) {
    if (backboneModules && backboneModules.length > 0) {
      const angleStep = (2 * Math.PI) / backboneModules.length;

      const moduleGroups = new Map<string, Node[]>();
      nodes.forEach((n) => {
        const module = n.properties?.backboneModule;
        if (module) {
          const group = moduleGroups.get(module);
          if (group) {
            group.push(n);
          } else {
            moduleGroups.set(module, [n]);
          }
        }
      });

      return backboneModules
        .sort(
          (a: GraphBackboneModule, b: GraphBackboneModule) =>
            a.display_order - b.display_order,
        )
        .map((module: GraphBackboneModule, index: number) => {
          const angleStart = index * angleStep;
          const angleEnd = (index + 1) * angleStep;

          const regionNodes = moduleGroups.get(module.module_type) || [];

          return {
            id: `region-${module.module_type}`,
            name: module.title,
            color:
              module.color ||
              BACKBONE_MODULE_COLORS[module.module_type as BackboneModule],
            icon:
              module.icon ||
              BACKBONE_MODULE_ICONS[module.module_type as BackboneModule],
            angleStart,
            angleEnd,
            nodes: regionNodes,
            isCollapsed: collapsedSet.has(
              `region-${module.module_type}`,
            ),
          };
        });
    }

    const orderedBackboneModules = [
      BackboneModule.RESEARCH_BACKGROUND,
      BackboneModule.LITERATURE_REVIEW,
      BackboneModule.RESEARCH_METHODS,
      BackboneModule.CORE_CONCEPTS,
      BackboneModule.APPLICATION_DOMAINS,
      BackboneModule.FUTURE_DIRECTIONS,
    ];

    const angleStep = (2 * Math.PI) / 6;

    const moduleGroups = new Map<string, Node[]>();
    nodes.forEach((n) => {
      const module = n.properties?.backboneModule;
      if (module) {
        const group = moduleGroups.get(module);
        if (group) {
          group.push(n);
        } else {
          moduleGroups.set(module, [n]);
        }
      }
    });

    return orderedBackboneModules.map((module, index) => {
      const angleStart = index * angleStep;
      const angleEnd = (index + 1) * angleStep;

      const regionNodes = moduleGroups.get(module) || [];

      return {
        id: `region-${module}`,
        name: i18n.t(BACKBONE_MODULE_LABEL_I18N_KEYS[module]),
        color: BACKBONE_MODULE_COLORS[module],
        icon: BACKBONE_MODULE_ICONS[module],
        angleStart,
        angleEnd,
        nodes: regionNodes,
        isCollapsed: collapsedSet.has(`region-${module}`),
      };
    });
  } else {
    if (customRegions.length === 0) {
      // 优先按层级树主分支划分；无法建树时退化为现有 level 分组
      const branchRegions = computeBranchRegions(
        nodes,
        edges,
        collapsedRegions,
      );
      if (branchRegions) {
        return branchRegions;
      }

      const levelGroups = new Map<string, Node[]>();

      nodes.forEach((node) => {
        const level = node.level || "leaf";
        if (!levelGroups.has(level)) {
          levelGroups.set(level, []);
        }
        levelGroups.get(level)?.push(node);
      });

      const levels = Array.from(levelGroups.keys());
      const angleStep = (2 * Math.PI) / levels.length;

      return levels.map((level, index) => {
        const angleStart = index * angleStep;
        const angleEnd = (index + 1) * angleStep;

        return {
          id: `region-${level}`,
          name:
            level === "root"
              ? i18n.t("graphMap.levelLabels.root")
              : level === "core"
                ? i18n.t("graphMap.levelLabels.core")
                : i18n.t("graphMap.levelLabels.leaf"),
          color: `hsl(${(index * 360) / levels.length}, 70%, 50%)`,
          angleStart,
          angleEnd,
          nodes: levelGroups.get(level) || [],
          isCollapsed: collapsedSet.has(`region-${level}`),
        };
      });
    }

    const angleStep = (2 * Math.PI) / customRegions.length;

    // 预构建 nodeId -> Node 映射，按区域 nodeIds 直接取值，替代每区域一次 nodes.filter 的 O(regions*nodes) 扫描
    const nodeById = new Map<string, Node>();
    nodes.forEach((n) => nodeById.set(n.id, n));

    return customRegions.map((region, index) => {
      const angleStart = index * angleStep;
      const angleEnd = (index + 1) * angleStep;

      const regionNodes: Node[] = [];
      for (const nodeId of region.nodeIds) {
        const node = nodeById.get(nodeId);
        if (node) regionNodes.push(node);
      }

      return {
        id: region.id,
        name: region.name,
        color: region.color,
        angleStart,
        angleEnd,
        nodes: regionNodes,
        isCollapsed: collapsedSet.has(region.id),
      };
    });
  }
}