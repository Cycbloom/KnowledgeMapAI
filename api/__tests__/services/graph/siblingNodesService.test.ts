import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getSiblingNodes,
  buildSiblingsByParent,
  getDirectChildren,
} from "../../../services/graph/siblingNodesService";

/**
 * 生成一个「可链式调用且可 await」的查询对象。
 * 任意链式方法（select/eq/in/is）都返回同一可 await 对象，
 * await 时解析为 { data, error }。
 */
function mockQuery(data: unknown, error: unknown = null) {
  const result = { data, error };
  const chain: Record<string, unknown> = {
    then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
    select: () => chain,
    eq: () => chain,
    in: () => chain,
    is: () => chain,
  };
  return chain;
}

function makeSupabaseMock() {
  const queries = vi.fn((_table: string) => {
    // 由用例通过 mockReturnValueOnce 注入具体解析结果
    return mockQuery(undefined);
  });
  const supabase = {
    from: queries,
  } as unknown as SupabaseClient;
  return { supabase, from: queries };
}

describe("buildSiblingsByParent", () => {
  it("maps each parent(source) to its child(target) kp ids", () => {
    const result = buildSiblingsByParent([
      { source_knowledge_point_id: "p1", target_knowledge_point_id: "c1" },
      { source_knowledge_point_id: "p1", target_knowledge_point_id: "c2" },
      { source_knowledge_point_id: "p2", target_knowledge_point_id: "c3" },
    ]);
    expect(result.get("p1")).toEqual(["c1", "c2"]);
    expect(result.get("p2")).toEqual(["c3"]);
  });
});

describe("getSiblingNodes", () => {
  let supabase: SupabaseClient;
  let from: ReturnType<typeof makeSupabaseMock>["from"];

  beforeEach(() => {
    vi.resetAllMocks();
    const m = makeSupabaseMock();
    supabase = m.supabase;
    from = m.from;
  });

  it("node with siblings returns siblings with truncated content", async () => {
    const longContent = "x".repeat(500);
    // 步骤1：父边查询
    from.mockReturnValueOnce(
      mockQuery([
        { source_knowledge_point_id: "parent-1", target_knowledge_point_id: "node-1" },
      ]),
    );
    // 步骤2：兄弟出边查询
    from.mockReturnValueOnce(
      mockQuery([
        { source_knowledge_point_id: "parent-1", target_knowledge_point_id: "node-1" },
        { source_knowledge_point_id: "parent-1", target_knowledge_point_id: "sib-1" },
        { source_knowledge_point_id: "parent-1", target_knowledge_point_id: "sib-2" },
      ]),
    );
    // 步骤3：兄弟详情查询
    from.mockReturnValueOnce(
      mockQuery([
        {
          knowledge_point_id: "sib-1",
          knowledge_points: [{ id: "sib-1", title: "Sibling One", content: longContent }],
        },
        {
          knowledge_point_id: "sib-2",
          knowledge_points: [{ id: "sib-2", title: "Sibling Two", content: "short content" }],
        },
      ]),
    );

    const siblings = await getSiblingNodes(supabase, "graph-1", "node-1");

    expect(siblings).toHaveLength(2);
    expect(siblings[0]).toEqual({
      knowledgePointId: "sib-1",
      title: "Sibling One",
      content: longContent.slice(0, 200),
    });
    expect(siblings[1]).toEqual({
      knowledgePointId: "sib-2",
      title: "Sibling Two",
      content: "short content",
    });
    // 内容被截断到 200 字符
    expect(siblings[0].content?.length).toBe(200);
  });

  it("root node (no parent edge) returns []", async () => {
    from.mockReturnValueOnce(mockQuery([]));

    const siblings = await getSiblingNodes(supabase, "graph-1", "root-1");

    expect(siblings).toEqual([]);
    // 无父边时不应继续查询兄弟边
    expect(from).toHaveBeenCalledTimes(1);
  });

  it("content truncation to 200 chars", async () => {
    const longContent = "abcdefghijk".repeat(100); // 1100 chars
    from.mockReturnValueOnce(
      mockQuery([
        { source_knowledge_point_id: "parent-1", target_knowledge_point_id: "node-1" },
      ]),
    );
    from.mockReturnValueOnce(
      mockQuery([
        { source_knowledge_point_id: "parent-1", target_knowledge_point_id: "sib-1" },
      ]),
    );
    from.mockReturnValueOnce(
      mockQuery([
        {
          knowledge_point_id: "sib-1",
          knowledge_points: [{ id: "sib-1", title: "Sibling One", content: longContent }],
        },
      ]),
    );

    const siblings = await getSiblingNodes(supabase, "graph-1", "node-1");

    expect(siblings).toHaveLength(1);
    expect(siblings[0].content).toBe(longContent.slice(0, 200));
  });
});

describe("getDirectChildren", () => {
  let supabase: SupabaseClient;
  let from: ReturnType<typeof makeSupabaseMock>["from"];

  beforeEach(() => {
    vi.resetAllMocks();
    const m = makeSupabaseMock();
    supabase = m.supabase;
    from = m.from;
  });

  it("node with children returns children with id/title/content", async () => {
    from.mockReturnValueOnce(
      mockQuery([
        { source_knowledge_point_id: "node-1", target_knowledge_point_id: "child-1" },
        { source_knowledge_point_id: "node-1", target_knowledge_point_id: "child-2" },
        { source_knowledge_point_id: "node-1", target_knowledge_point_id: "child-3" },
      ]),
    );
    from.mockReturnValueOnce(
      mockQuery([
        {
          knowledge_point_id: "child-1",
          knowledge_points: [{ id: "child-1", title: "Child One", content: "content one" }],
        },
        {
          knowledge_point_id: "child-2",
          knowledge_points: [{ id: "child-2", title: "Child Two", content: "content two" }],
        },
        {
          knowledge_point_id: "child-3",
          knowledge_points: [{ id: "child-3", title: "Child Three", content: "content three" }],
        },
      ]),
    );

    const children = await getDirectChildren(supabase, "graph-1", "node-1");

    expect(children).toHaveLength(3);
    expect(children[0]).toEqual({
      knowledgePointId: "child-1",
      title: "Child One",
      content: "content one",
    });
    expect(children[1]).toEqual({
      knowledgePointId: "child-2",
      title: "Child Two",
      content: "content two",
    });
    expect(children[2]).toEqual({
      knowledgePointId: "child-3",
      title: "Child Three",
      content: "content three",
    });
  });

  it("node with no children edges returns []", async () => {
    from.mockReturnValueOnce(mockQuery([]));

    const children = await getDirectChildren(supabase, "graph-1", "node-1");

    expect(children).toEqual([]);
    expect(from).toHaveBeenCalledTimes(1);
  });

  it("content exceeding 200 chars gets truncated with ellipsis", async () => {
    const longContent = "x".repeat(500);
    from.mockReturnValueOnce(
      mockQuery([
        { source_knowledge_point_id: "node-1", target_knowledge_point_id: "child-1" },
      ]),
    );
    from.mockReturnValueOnce(
      mockQuery([
        {
          knowledge_point_id: "child-1",
          knowledge_points: [{ id: "child-1", title: "Child One", content: longContent }],
        },
      ]),
    );

    const children = await getDirectChildren(supabase, "graph-1", "node-1");

    expect(children).toHaveLength(1);
    expect(children[0].content?.length).toBe(201);
    expect(children[0].content).toBe(`${longContent.slice(0, 200)}…`);
  });

  it("respects limit parameter and returns at most limit children", async () => {
    from.mockReturnValueOnce(
      mockQuery([
        { source_knowledge_point_id: "node-1", target_knowledge_point_id: "child-1" },
        { source_knowledge_point_id: "node-1", target_knowledge_point_id: "child-2" },
        { source_knowledge_point_id: "node-1", target_knowledge_point_id: "child-3" },
        { source_knowledge_point_id: "node-1", target_knowledge_point_id: "child-4" },
        { source_knowledge_point_id: "node-1", target_knowledge_point_id: "child-5" },
      ]),
    );
    from.mockReturnValueOnce(
      mockQuery([
        {
          knowledge_point_id: "child-1",
          knowledge_points: [{ id: "child-1", title: "C1", content: "c1" }],
        },
        {
          knowledge_point_id: "child-2",
          knowledge_points: [{ id: "child-2", title: "C2", content: "c2" }],
        },
        {
          knowledge_point_id: "child-3",
          knowledge_points: [{ id: "child-3", title: "C3", content: "c3" }],
        },
        {
          knowledge_point_id: "child-4",
          knowledge_points: [{ id: "child-4", title: "C4", content: "c4" }],
        },
        {
          knowledge_point_id: "child-5",
          knowledge_points: [{ id: "child-5", title: "C5", content: "c5" }],
        },
      ]),
    );

    const children = await getDirectChildren(supabase, "graph-1", "node-1", 2);

    expect(children).toHaveLength(2);
    expect(children[0].knowledgePointId).toBe("child-1");
    expect(children[1].knowledgePointId).toBe("child-2");
  });
});