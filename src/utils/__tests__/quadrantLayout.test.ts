import { describe, it, expect } from "vitest";
import {
  calculateRegionAngles,
  calculateNodeImportance,
  calculateNodePosition,
  avoidCollisions,
  layoutNodes,
} from "../quadrantLayout";
import type { Node, Edge, RegionInfo } from "@shared/types/graph";

function createMockNode(
  id: string,
  level: "root" | "core" | "sub" | "normal" | "leaf" = "normal",
  sources?: Array<{ title: string; addedAt: string }>,
): Node {
  return {
    id,
    knowledge_point_id: id,
    graph_id: "test-graph",
    title: `Node ${id}`,
    level,
    x_position: 0,
    y_position: 0,
    is_accepted: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    visibility: "private",
    owner_id: "test-user",
    properties: sources ? { sources } : undefined,
  };
}

function createMockEdge(id: string, sourceId: string, targetId: string): Edge {
  return {
    id,
    graph_id: "test-graph",
    source_knowledge_point_id: sourceId,
    target_knowledge_point_id: targetId,
  };
}

function createMockRegion(
  id: string,
  name: string,
  nodes: Node[],
  angleStart: number,
  angleEnd: number,
): RegionInfo {
  return {
    id,
    name,
    color: "#3B82F6",
    angleStart,
    angleEnd,
    nodes,
    isCollapsed: false,
  };
}

describe("calculateRegionAngles", () => {
  it("返回空数组当区域数量为0", () => {
    const result = calculateRegionAngles(0);
    expect(result).toEqual([]);
  });

  it("返回空数组当区域数量为负数", () => {
    const result = calculateRegionAngles(-1);
    expect(result).toEqual([]);
  });

  it("正确计算单个区域的角度", () => {
    const result = calculateRegionAngles(1);
    expect(result).toHaveLength(1);
    expect(result[0].angleStart).toBe(0);
    expect(result[0].angleEnd).toBeCloseTo(2 * Math.PI);
  });

  it("正确计算两个区域的角度", () => {
    const result = calculateRegionAngles(2);
    expect(result).toHaveLength(2);
    expect(result[0].angleStart).toBe(0);
    expect(result[0].angleEnd).toBeCloseTo(Math.PI);
    expect(result[1].angleStart).toBeCloseTo(Math.PI);
    expect(result[1].angleEnd).toBeCloseTo(2 * Math.PI);
  });

  it("正确计算四个区域的角度", () => {
    const result = calculateRegionAngles(4);
    expect(result).toHaveLength(4);
    const anglePerRegion = Math.PI / 2;
    for (let i = 0; i < 4; i++) {
      expect(result[i].angleStart).toBeCloseTo(i * anglePerRegion);
      expect(result[i].angleEnd).toBeCloseTo((i + 1) * anglePerRegion);
    }
  });

  it("所有区域角度范围总和为2π", () => {
    for (const count of [1, 2, 3, 4, 5, 6]) {
      const result = calculateRegionAngles(count);
      const totalAngle =
        result[result.length - 1].angleEnd - result[0].angleStart;
      expect(totalAngle).toBeCloseTo(2 * Math.PI);
    }
  });

  it("每个区域的角度范围相等", () => {
    const result = calculateRegionAngles(5);
    const expectedAngle = (2 * Math.PI) / 5;
    for (const region of result) {
      expect(region.angleEnd - region.angleStart).toBeCloseTo(expectedAngle);
    }
  });
});

describe("calculateNodeImportance", () => {
  it("root 级别节点具有最高重要性", () => {
    const node = createMockNode("1", "root");
    const edges: Edge[] = [];
    const importance = calculateNodeImportance(node, edges);
    expect(importance).toBeGreaterThan(0.4);
    expect(importance).toBeLessThanOrEqual(1);
  });

  it("leaf 级别节点具有较低重要性", () => {
    const node = createMockNode("1", "leaf");
    const edges: Edge[] = [];
    const importance = calculateNodeImportance(node, edges);
    expect(importance).toBeLessThan(0.3);
  });

  it("不同级别节点的重要性按预期排序", () => {
    const edges: Edge[] = [];
    const rootImportance = calculateNodeImportance(
      createMockNode("1", "root"),
      edges,
    );
    const coreImportance = calculateNodeImportance(
      createMockNode("2", "core"),
      edges,
    );
    const subImportance = calculateNodeImportance(
      createMockNode("3", "sub"),
      edges,
    );
    const normalImportance = calculateNodeImportance(
      createMockNode("4", "normal"),
      edges,
    );
    const leafImportance = calculateNodeImportance(
      createMockNode("5", "leaf"),
      edges,
    );

    expect(rootImportance).toBeGreaterThan(coreImportance);
    expect(coreImportance).toBeGreaterThan(subImportance);
    expect(subImportance).toBeGreaterThan(normalImportance);
    expect(normalImportance).toBeGreaterThan(leafImportance);
  });

  it("连接度影响重要性", () => {
    const node = createMockNode("1", "normal");
    const noEdges: Edge[] = [];
    const withEdges: Edge[] = [
      createMockEdge("e1", "1", "2"),
      createMockEdge("e2", "2", "1"),
      createMockEdge("e3", "1", "3"),
    ];

    const importanceNoEdges = calculateNodeImportance(node, noEdges);
    const importanceWithEdges = calculateNodeImportance(node, withEdges);

    expect(importanceWithEdges).toBeGreaterThan(importanceNoEdges);
  });

  it("来源数量影响重要性", () => {
    const nodeNoSources = createMockNode("1", "normal");
    const nodeWithSources = createMockNode("2", "normal", [
      { title: "Source 1", addedAt: new Date().toISOString() },
      { title: "Source 2", addedAt: new Date().toISOString() },
      { title: "Source 3", addedAt: new Date().toISOString() },
    ]);

    const edges: Edge[] = [];
    const importanceNoSources = calculateNodeImportance(nodeNoSources, edges);
    const importanceWithSources = calculateNodeImportance(
      nodeWithSources,
      edges,
    );

    expect(importanceWithSources).toBeGreaterThan(importanceNoSources);
  });

  it("重要性值在0到1范围内", () => {
    const node = createMockNode("1", "root", [
      { title: "S1", addedAt: new Date().toISOString() },
      { title: "S2", addedAt: new Date().toISOString() },
      { title: "S3", addedAt: new Date().toISOString() },
      { title: "S4", addedAt: new Date().toISOString() },
      { title: "S5", addedAt: new Date().toISOString() },
    ]);
    const edges: Edge[] = [
      createMockEdge("e1", "1", "2"),
      createMockEdge("e2", "2", "1"),
    ];

    const importance = calculateNodeImportance(node, edges);
    expect(importance).toBeGreaterThanOrEqual(0);
    expect(importance).toBeLessThanOrEqual(1);
  });

  it("无 level 属性的节点使用默认值", () => {
    const node = {
      ...createMockNode("1"),
      level: undefined,
    };
    const edges: Edge[] = [];
    const importance = calculateNodeImportance(node as Node, edges);
    expect(importance).toBeGreaterThanOrEqual(0);
    expect(importance).toBeLessThanOrEqual(1);
  });
});

describe("calculateNodePosition", () => {
  it("位置计算返回正确的坐标对象", () => {
    const node = createMockNode("test-node");
    const originPosition = { x: 400, y: 300 };
    const importance = 0.5;

    const position = calculateNodePosition(
      node,
      0,
      Math.PI / 2,
      importance,
      originPosition,
      150,
      300,
    );

    expect(position).toHaveProperty("x");
    expect(position).toHaveProperty("y");
    expect(typeof position.x).toBe("number");
    expect(typeof position.y).toBe("number");
  });

  it("高重要性节点距离原点更近", () => {
    const node = createMockNode("test-node");
    const originPosition = { x: 0, y: 0 };

    const positionHigh = calculateNodePosition(
      node,
      0,
      Math.PI / 2,
      0.9,
      originPosition,
      150,
      300,
    );

    const positionLow = calculateNodePosition(
      node,
      0,
      Math.PI / 2,
      0.1,
      originPosition,
      150,
      300,
    );

    const distanceHigh = Math.sqrt(positionHigh.x ** 2 + positionHigh.y ** 2);
    const distanceLow = Math.sqrt(positionLow.x ** 2 + positionLow.y ** 2);

    expect(distanceHigh).toBeLessThan(distanceLow);
  });

  it("位置在指定角度范围内", () => {
    const _node = createMockNode("test-node");
    const originPosition = { x: 0, y: 0 };
    const angleStart = Math.PI / 4;
    const angleEnd = Math.PI / 2;

    for (let i = 0; i < 10; i++) {
      const testNode = createMockNode(`node-${i}`);
      const position = calculateNodePosition(
        testNode,
        angleStart,
        angleEnd,
        0.5,
        originPosition,
        150,
        300,
      );

      const angle = Math.atan2(position.y, position.x);
      expect(angle).toBeGreaterThanOrEqual(angleStart - 0.01);
      expect(angle).toBeLessThanOrEqual(angleEnd + 0.01);
    }
  });

  it("相同节点ID产生相同位置", () => {
    const node = createMockNode("same-id");
    const originPosition = { x: 400, y: 300 };
    const importance = 0.5;

    const position1 = calculateNodePosition(
      node,
      0,
      Math.PI / 2,
      importance,
      originPosition,
      150,
      300,
    );

    const position2 = calculateNodePosition(
      node,
      0,
      Math.PI / 2,
      importance,
      originPosition,
      150,
      300,
    );

    expect(position1.x).toBe(position2.x);
    expect(position1.y).toBe(position2.y);
  });
});

describe("avoidCollisions", () => {
  it("单个节点位置不变", () => {
    const positions = new Map<string, { x: number; y: number }>();
    positions.set("node1", { x: 100, y: 100 });

    const result = avoidCollisions(positions, 50);

    expect(result.get("node1")?.x).toBe(100);
    expect(result.get("node1")?.y).toBe(100);
  });

  it("距离足够远的节点位置基本不变", () => {
    const positions = new Map<string, { x: number; y: number }>();
    positions.set("node1", { x: 0, y: 0 });
    positions.set("node2", { x: 200, y: 0 });
    positions.set("node3", { x: 0, y: 200 });

    const result = avoidCollisions(positions, 50);

    expect(Math.abs(result.get("node1")!.x - 0)).toBeLessThan(10);
    expect(Math.abs(result.get("node1")!.y - 0)).toBeLessThan(10);
    expect(Math.abs(result.get("node2")!.x - 200)).toBeLessThan(10);
    expect(Math.abs(result.get("node2")!.y - 0)).toBeLessThan(10);
  });

  it("碰撞节点被推开", () => {
    const positions = new Map<string, { x: number; y: number }>();
    positions.set("node1", { x: 100, y: 100 });
    positions.set("node2", { x: 110, y: 100 });

    const result = avoidCollisions(positions, 50);

    const pos1 = result.get("node1")!;
    const pos2 = result.get("node2")!;
    const distance = Math.sqrt((pos2.x - pos1.x) ** 2 + (pos2.y - pos1.y) ** 2);

    expect(distance).toBeGreaterThan(10);
  });

  it("多个碰撞节点被推开", () => {
    const positions = new Map<string, { x: number; y: number }>();
    positions.set("node1", { x: 100, y: 100 });
    positions.set("node2", { x: 105, y: 100 });
    positions.set("node3", { x: 100, y: 105 });

    const result = avoidCollisions(positions, 50);

    const positions2 = Array.from(result.values());
    for (let i = 0; i < positions2.length; i++) {
      for (let j = i + 1; j < positions2.length; j++) {
        const distance = Math.sqrt(
          (positions2[j].x - positions2[i].x) ** 2 +
            (positions2[j].y - positions2[i].y) ** 2,
        );
        expect(distance).toBeGreaterThan(5);
      }
    }
  });

  it("返回新的 Map 对象", () => {
    const positions = new Map<string, { x: number; y: number }>();
    positions.set("node1", { x: 100, y: 100 });

    const result = avoidCollisions(positions, 50);

    expect(result).not.toBe(positions);
  });

  it("保留所有节点", () => {
    const positions = new Map<string, { x: number; y: number }>();
    positions.set("node1", { x: 100, y: 100 });
    positions.set("node2", { x: 200, y: 200 });
    positions.set("node3", { x: 300, y: 300 });

    const result = avoidCollisions(positions, 50);

    expect(result.size).toBe(3);
    expect(result.has("node1")).toBe(true);
    expect(result.has("node2")).toBe(true);
    expect(result.has("node3")).toBe(true);
  });
});

describe("layoutNodes", () => {
  it("为所有节点生成位置", () => {
    const nodes: Node[] = [
      createMockNode("1"),
      createMockNode("2"),
      createMockNode("3"),
    ];
    const edges: Edge[] = [];
    const regions: RegionInfo[] = [
      createMockRegion("r1", "Region 1", [nodes[0], nodes[1]], 0, Math.PI),
      createMockRegion("r2", "Region 2", [nodes[2]], Math.PI, 2 * Math.PI),
    ];
    const originPosition = { x: 400, y: 300 };

    const result = layoutNodes(nodes, edges, regions, originPosition);

    expect(result.size).toBe(3);
    expect(result.has("1")).toBe(true);
    expect(result.has("2")).toBe(true);
    expect(result.has("3")).toBe(true);
  });

  it("区域外节点也被分配位置", () => {
    const nodes: Node[] = [createMockNode("1"), createMockNode("2")];
    const edges: Edge[] = [];
    const regions: RegionInfo[] = [
      createMockRegion("r1", "Region 1", [nodes[0]], 0, Math.PI),
    ];
    const originPosition = { x: 400, y: 300 };

    const result = layoutNodes(nodes, edges, regions, originPosition);

    expect(result.size).toBe(2);
    expect(result.has("1")).toBe(true);
    expect(result.has("2")).toBe(true);
  });

  it("空节点数组返回空 Map", () => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const regions: RegionInfo[] = [];
    const originPosition = { x: 400, y: 300 };

    const result = layoutNodes(nodes, edges, regions, originPosition);

    expect(result.size).toBe(0);
  });

  it("使用默认半径参数", () => {
    const nodes: Node[] = [createMockNode("1")];
    const edges: Edge[] = [];
    const regions: RegionInfo[] = [
      createMockRegion("r1", "Region 1", nodes, 0, 2 * Math.PI),
    ];
    const originPosition = { x: 0, y: 0 };

    const result = layoutNodes(nodes, edges, regions, originPosition);

    const pos = result.get("1")!;
    const distance = Math.sqrt(pos.x ** 2 + pos.y ** 2);
    expect(distance).toBeGreaterThan(100);
    expect(distance).toBeLessThan(500);
  });

  it("自定义半径参数影响布局", () => {
    const nodes: Node[] = [createMockNode("1")];
    const edges: Edge[] = [];
    const regions: RegionInfo[] = [
      createMockRegion("r1", "Region 1", nodes, 0, 2 * Math.PI),
    ];
    const originPosition = { x: 0, y: 0 };

    const resultSmall = layoutNodes(
      nodes,
      edges,
      regions,
      originPosition,
      50,
      100,
    );
    const resultLarge = layoutNodes(
      nodes,
      edges,
      regions,
      originPosition,
      200,
      400,
    );

    const posSmall = resultSmall.get("1")!;
    const posLarge = resultLarge.get("1")!;

    const distanceSmall = Math.sqrt(posSmall.x ** 2 + posSmall.y ** 2);
    const distanceLarge = Math.sqrt(posLarge.x ** 2 + posLarge.y ** 2);

    expect(distanceSmall).toBeLessThan(distanceLarge);
  });
});
