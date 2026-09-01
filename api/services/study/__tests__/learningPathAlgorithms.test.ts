import { describe, it, expect } from "vitest";
import {
  buildDependencyMaps,
  generateRulePath,
  type EdgeForPath,
  type LearningProgress,
  type NodeForPath,
} from "../learningPathAlgorithms";

function node(id: string, level: string = "normal"): NodeForPath {
  return {
    id,
    title: `节点-${id}`,
    content: "",
    level: level as NodeForPath["level"],
  };
}

function edge(
  source: string,
  target: string,
  relationship_type?: string,
): EdgeForPath {
  return {
    source_knowledge_point_id: source,
    target_knowledge_point_id: target,
    relationship_type,
  };
}

function emptyProgress(): Map<string, LearningProgress> {
  return new Map();
}

function progressFor(
  entries: Array<{ id: string; mastery: number }>,
): Map<string, LearningProgress> {
  const map = new Map<string, LearningProgress>();
  entries.forEach((e) => {
    map.set(e.id, {
      nodeId: e.id,
      nodeTitle: `节点-${e.id}`,
      masteryLevel: e.mastery,
      lastReviewDate: null,
      nextReviewDate: null,
      reviewCount: 0,
      stability: e.mastery * 30,
      difficulty: 3,
    });
  });
  return map;
}

describe("buildDependencyMaps（边类型分类）", () => {
  it("depends_on 进入硬依赖，contains 进入软依赖，related 不参与排序", () => {
    const nodes = [node("A"), node("B"), node("C"), node("D")];
    const edges = [
      edge("A", "B", "depends_on"),
      edge("C", "D", "contains"),
      edge("A", "C", "related"),
    ];
    const { parentMap, childMap, softParentMap, softChildMap } =
      buildDependencyMaps(nodes, edges);

    // 硬依赖：仅 depends_on
    expect(parentMap.get("B")).toEqual(["A"]);
    expect(childMap.get("A")).toEqual(["B"]);
    expect(parentMap.get("D")).toEqual([]);

    // 软依赖：contains
    expect(softParentMap.get("D")).toEqual(["C"]);
    expect(softChildMap.get("C")).toEqual(["D"]);

    // related 不产生任何排序
    expect(parentMap.get("C")).toEqual([]);
    expect(softParentMap.get("C")).toEqual([]);
  });
});

describe("generateRulePath（掌握度感知 + 依赖约束）", () => {
  it("前置依赖：source 严格在 target 之前", () => {
    const nodes = [node("B"), node("A")];
    const edges = [edge("A", "B", "prerequisite")];
    const { parentMap, childMap, softParentMap } = buildDependencyMaps(
      nodes,
      edges,
    );
    const { stages } = generateRulePath(
      nodes,
      edges,
      emptyProgress(),
      parentMap,
      childMap,
      undefined,
      30,
      softParentMap,
    );
    const order = stages.map((s) => s.nodeId);
    expect(order.indexOf("A")).toBeLessThan(order.indexOf("B"));
  });

  it("contains 层级不作为硬依赖，但同级内父先于子", () => {
    const nodes = [node("A"), node("B")];
    const edges = [edge("A", "B", "contains")];
    const { parentMap, childMap, softParentMap } = buildDependencyMaps(
      nodes,
      edges,
    );
    // 层级边不进入硬依赖
    expect(parentMap.get("B")).toEqual([]);
    const { stages } = generateRulePath(
      nodes,
      edges,
      emptyProgress(),
      parentMap,
      childMap,
      undefined,
      30,
      softParentMap,
    );
    const order = stages.map((s) => s.nodeId);
    expect(order.indexOf("A")).toBeLessThan(order.indexOf("B"));
  });

  it("related 不约束顺序，节点仍全部覆盖", () => {
    const nodes = [node("X"), node("Y")];
    const edges = [edge("X", "Y", "related")];
    const { parentMap, childMap, softParentMap } = buildDependencyMaps(
      nodes,
      edges,
    );
    expect(parentMap.get("Y")).toEqual([]);
    expect(softParentMap.get("Y")).toEqual([]);
    const { stages } = generateRulePath(
      nodes,
      edges,
      emptyProgress(),
      parentMap,
      childMap,
      undefined,
      30,
      softParentMap,
    );
    expect(stages).toHaveLength(2);
  });

  it("同级内掌握度低者优先", () => {
    const nodes = [node("A"), node("B")];
    const progress = progressFor([
      { id: "A", mastery: 0.8 },
      { id: "B", mastery: 0.2 },
    ]);
    const { parentMap, childMap, softParentMap } = buildDependencyMaps(
      nodes,
      [],
    );
    const { stages } = generateRulePath(
      nodes,
      [],
      progress,
      parentMap,
      childMap,
      undefined,
      30,
      softParentMap,
    );
    const order = stages.map((s) => s.nodeId);
    expect(order.indexOf("B")).toBeLessThan(order.indexOf("A"));
  });

  it("存在依赖环时仍覆盖全部节点", () => {
    const nodes = [node("A"), node("B"), node("C")];
    const edges = [
      edge("A", "B", "prerequisite"),
      edge("B", "A", "prerequisite"),
    ];
    const { parentMap, childMap, softParentMap } = buildDependencyMaps(
      nodes,
      edges,
    );
    const { stages } = generateRulePath(
      nodes,
      edges,
      emptyProgress(),
      parentMap,
      childMap,
      undefined,
      30,
      softParentMap,
    );
    expect(stages.map((s) => s.nodeId).sort()).toEqual(["A", "B", "C"]);
  });
});
