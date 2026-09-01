import { describe, it, expect } from "vitest";
import {
  buildCrossGraphDependencyMaps,
  generateCrossGraphRulePath,
  CROSS_GRAPH_COMPLETION_THRESHOLD,
  type CrossGraphNodeInput,
  type CrossGraphRelationInput,
} from "../crossGraphPathAlgorithms";

function node(
  graphId: string,
  completion: number,
  nodeCount = 3,
): CrossGraphNodeInput {
  return {
    graphId,
    title: `图-${graphId}`,
    nodeCount,
    completion,
    domainIds: [],
  };
}

function rel(
  sourceGraphId: string,
  targetGraphId: string,
  relationType: CrossGraphRelationInput["relationType"],
): CrossGraphRelationInput {
  return { sourceGraphId, targetGraphId, relationType };
}

describe("crossGraphPathAlgorithms（跨图谱排序）", () => {
  it("前置关系：先学前置图，再学当前图", () => {
    const { stages } = generateCrossGraphRulePath(
      [node("B", 0.2), node("A", 0.2)],
      [rel("A", "B", "prerequisite")],
    );
    const order = stages.map((s) => s.graphId);
    expect(order.indexOf("A")).toBeLessThan(order.indexOf("B"));
  });

  it("扩展关系：先学基础图，再学扩展图", () => {
    const { stages } = generateCrossGraphRulePath(
      [node("B", 0.2), node("A", 0.2)],
      [rel("A", "B", "extension")],
    );
    const order = stages.map((s) => s.graphId);
    expect(order.indexOf("A")).toBeLessThan(order.indexOf("B"));
  });

  it("未完成图谱排在已完成图谱之前", () => {
    const { stages } = generateCrossGraphRulePath(
      [node("done", 0.95), node("todo", 0.2)],
      [],
    );
    expect(stages[0].graphId).toBe("todo");
    expect(stages[0].isCompleted).toBe(false);
    expect(stages[1].graphId).toBe("done");
    expect(stages[1].isCompleted).toBe(true);
  });

  it("同级内按完成度升序、节点数降序排列", () => {
    const { stages } = generateCrossGraphRulePath(
      [node("m", 0.5, 5), node("l", 0.5, 2), node("h", 0.8, 5)],
      [],
    );
    const order = stages.map((s) => s.graphId);
    // 完成度 0.5 的两个排在 0.8 之前
    expect(order.indexOf("m")).toBeLessThan(order.indexOf("h"));
    expect(order.indexOf("l")).toBeLessThan(order.indexOf("h"));
    // 完成度相同时，节点多的（m=5）排在节点少的（l=2）之前
    expect(order.indexOf("m")).toBeLessThan(order.indexOf("l"));
  });

  it("存在环时仍返回全部节点（剩余节点追加到末尾）", () => {
    const { stages } = generateCrossGraphRulePath(
      [node("A", 0.2), node("B", 0.2), node("C", 0.2)],
      [rel("A", "B", "prerequisite"), rel("B", "A", "prerequisite")],
    );
    expect(stages.map((s) => s.graphId).sort()).toEqual(["A", "B", "C"]);
  });

  it("related / cross_domain 关系不约束排序顺序", () => {
    const { stages } = generateCrossGraphRulePath(
      [node("X", 0.2), node("Y", 0.2)],
      [rel("X", "Y", "related"), rel("Y", "X", "cross_domain")],
    );
    // 两者无约束，但都保留在路径中
    expect(stages).toHaveLength(2);
  });

  it("完成度阈值常量生效", () => {
    expect(CROSS_GRAPH_COMPLETION_THRESHOLD).toBe(0.85);
  });

  it("dependency maps 只收录前置/扩展关系", () => {
    const { parentMap, childMap } = buildCrossGraphDependencyMaps(
      [node("A", 0.2), node("B", 0.2), node("C", 0.2)],
      [
        rel("A", "B", "prerequisite"),
        rel("C", "A", "related"),
      ],
    );
    expect(parentMap.get("B")).toEqual(["A"]);
    expect(parentMap.get("A")).toEqual([]);
    expect(childMap.get("A")).toEqual(["B"]);
  });
});
