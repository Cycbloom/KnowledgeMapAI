import { describe, it, expect } from "vitest";
import { computeRegions, computeBranchRegions } from "../regions";
import type { Node, Edge, CustomRegion } from "@shared/types/graph";

function createMockNode(
  id: string,
  title: string,
  level: Node["level"] = "normal",
): Node {
  return {
    id,
    knowledge_point_id: id,
    graph_id: "test-graph",
    title,
    level,
    x_position: 0,
    y_position: 0,
    is_accepted: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    visibility: "private",
    owner_id: "test-user",
    properties: undefined,
  };
}

function createMockEdge(
  id: string,
  sourceId: string,
  targetId: string,
  relationshipType?: string,
): Edge {
  return {
    id,
    graph_id: "test-graph",
    source_knowledge_point_id: sourceId,
    target_knowledge_point_id: targetId,
    relationship_type: relationshipType,
  };
}

describe("computeBranchRegions / computeRegions - 树主分支划分", () => {
  it("按层级树一级分支划分区域，子树节点完整归入对应分支", () => {
    const nodes = [
      createMockNode("1", "Root", "root"),
      createMockNode("2", "Branch A", "core"),
      createMockNode("3", "Branch B", "core"),
      createMockNode("4", "A-1", "sub"),
      createMockNode("5", "A-2", "sub"),
      createMockNode("6", "A-2-1", "leaf"),
    ];
    const edges = [
      createMockEdge("e1", "1", "2"),
      createMockEdge("e2", "1", "3"),
      createMockEdge("e3", "2", "4"),
      createMockEdge("e4", "2", "5"),
      createMockEdge("e5", "5", "6"),
    ];

    const regions = computeRegions({
      nodes,
      edges,
      customRegions: [],
      collapsedRegions: [],
    });

    expect(regions).toHaveLength(2);
    // 分支 A（root 附加到首分支）: root, 2, 4, 5, 6
    expect(regions[0].name).toBe("Branch A");
    expect(regions[0].nodes.map((n) => n.id)).toEqual(
      expect.arrayContaining(["1", "2", "4", "5", "6"]),
    );
    expect(regions[0].nodes).toHaveLength(5);
    // 分支 B
    expect(regions[1].name).toBe("Branch B");
    expect(regions[1].nodes.map((n) => n.id)).toEqual(["3"]);
  });

  it("分支数超过目标时，最小分支合并到共享边最多的邻居", () => {
    const nodes = [
      createMockNode("1", "Root", "root"),
      createMockNode("2", "B1", "core"),
      createMockNode("8", "b1-leaf", "leaf"),
      createMockNode("3", "B2", "core"),
      createMockNode("9", "b2-leaf", "leaf"),
      createMockNode("4", "B3", "core"),
      createMockNode("10", "b3-leaf", "leaf"),
      createMockNode("5", "B4", "core"),
      createMockNode("11", "b4-leaf", "leaf"),
      createMockNode("6", "B5", "core"),
      createMockNode("12", "b5-leaf", "leaf"),
      createMockNode("7", "B6", "core"),
      createMockNode("13", "b6-leaf", "leaf"),
    ];
    const edges = [
      createMockEdge("h1", "1", "2"),
      createMockEdge("h2", "1", "3"),
      createMockEdge("h3", "1", "4"),
      createMockEdge("h4", "1", "5"),
      createMockEdge("h5", "1", "6"),
      createMockEdge("h6", "1", "7"),
      createMockEdge("h7", "2", "8"),
      createMockEdge("h8", "3", "9"),
      createMockEdge("h9", "4", "10"),
      createMockEdge("h10", "5", "11"),
      createMockEdge("h11", "6", "12"),
      createMockEdge("h12", "7", "13"),
      // B1 与 B2 共享边（非层级），合并时应优先合入共享边最多的邻居
      createMockEdge("x1", "8", "9", "related"),
    ];

    const regions = computeRegions({
      nodes,
      edges,
      customRegions: [],
      collapsedRegions: [],
    });

    // 13 节点 → 目标 3 个区域
    expect(regions).toHaveLength(3);
    // 共享边驱动的合并：B1(2,8) 与 B2(3,9) 因共享边 8-9 被合并进同一区域
    expect(regions[0].nodes.map((n) => n.id)).toEqual(
      expect.arrayContaining(["2", "8", "3", "9"]),
    );
    // 全部 13 节点都被分配且无重复
    const all = regions.flatMap((r) => r.nodes.map((n) => n.id));
    expect(all).toHaveLength(13);
    expect(new Set(all).size).toBe(13);
  });

  it("root 归属首分支，孤立节点归入其他区域", () => {
    const nodes = [
      createMockNode("1", "Root", "root"),
      createMockNode("2", "Branch", "core"),
      createMockNode("3", "Leaf", "leaf"),
      createMockNode("4", "Isolated", "normal"),
    ];
    const edges = [
      createMockEdge("e1", "1", "2"),
      createMockEdge("e2", "2", "3"),
    ];

    const regions = computeRegions({
      nodes,
      edges,
      customRegions: [],
      collapsedRegions: [],
    });

    // 4 节点 → 目标 2 区域：branch-2（含 root）+ region-others
    expect(regions).toHaveLength(2);
    const branch = regions.find((r) => r.id === "branch-2");
    const others = regions.find((r) => r.id === "region-others");
    expect(branch?.nodes.map((n) => n.id)).toEqual(
      expect.arrayContaining(["1", "2", "3"]),
    );
    expect(others?.nodes.map((n) => n.id)).toEqual(["4"]);
  });

  it("无层级边（全部为非层级关系）时退化为 level 分组", () => {
    const nodes = [
      createMockNode("1", "Root", "root"),
      createMockNode("2", "Core", "core"),
      createMockNode("3", "Leaf", "leaf"),
    ];
    const edges = [
      createMockEdge("e1", "1", "2", "related"),
      createMockEdge("e2", "2", "3", "related"),
    ];

    const regions = computeRegions({
      nodes,
      edges,
      customRegions: [],
      collapsedRegions: [],
    });

    expect(regions).toHaveLength(3);
    expect(regions.map((r) => r.id)).toEqual(
      expect.arrayContaining(["region-root", "region-core", "region-leaf"]),
    );
  });

  it("仅一个一级分支时 computeBranchRegions 返回 null 并退化到 level 分组", () => {
    const nodes = [
      createMockNode("1", "Root", "root"),
      createMockNode("2", "Only Branch", "core"),
      createMockNode("3", "Leaf", "leaf"),
    ];
    const edges = [
      createMockEdge("e1", "1", "2"),
      createMockEdge("e2", "2", "3"),
    ];

    expect(computeBranchRegions(nodes, edges, [])).toBeNull();

    const regions = computeRegions({
      nodes,
      edges,
      customRegions: [],
      collapsedRegions: [],
    });
    expect(regions).toHaveLength(3);
    expect(regions.map((r) => r.id)).toEqual(
      expect.arrayContaining(["region-root", "region-core", "region-leaf"]),
    );
  });

  it("自定义区域优先于树主分支划分", () => {
    const nodes = [
      createMockNode("1", "Root", "root"),
      createMockNode("2", "Branch", "core"),
      createMockNode("3", "Leaf", "leaf"),
    ];
    const edges = [
      createMockEdge("e1", "1", "2"),
      createMockEdge("e2", "2", "3"),
    ];
    const customRegions: CustomRegion[] = [
      {
        id: "cr1",
        name: "我的区域",
        color: "#ff0000",
        nodeIds: ["1", "2"],
        createdAt: "",
        updatedAt: "",
      },
    ];

    const regions = computeRegions({
      nodes,
      edges,
      customRegions,
      collapsedRegions: [],
    });

    expect(regions).toHaveLength(1);
    expect(regions[0].id).toBe("cr1");
    expect(regions[0].name).toBe("我的区域");
    expect(regions[0].nodes.map((n) => n.id)).toEqual(["1", "2"]);
  });
});
