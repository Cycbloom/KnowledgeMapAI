import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildLearningMaterialContext } from "../../services/graph/learningMaterialContext";

/**
 * 可编程 mock Supabase：`from(table)` 返回链式 builder，
 * 链上每个查询的 eq/in 过滤条件会被记录，`then`/`maybeSingle` 解析时
 * 交给调用方提供的 resolver 按 (表, 过滤条件) 返回结果，从而支持
 * 同一张表多条不同查询（如 edges 的正向/反向查询）返回不同数据。
 */
interface FilterCall {
  col: string;
  value: unknown;
}

type TableResolver = (filters: FilterCall[]) => { data: unknown; error: unknown };

function createChain(resolve: TableResolver): Record<string, unknown> {
  const filters: FilterCall[] = [];
  const chain: Record<string, unknown> = {
    select: () => chain,
    eq: (col: string, value: unknown) => {
      filters.push({ col, value });
      return chain;
    },
    in: (col: string, values: unknown[]) => {
      filters.push({ col, value: values });
      return chain;
    },
    is: (col: string, value: unknown) => {
      filters.push({ col, value });
      return chain;
    },
    limit: () => chain,
    order: () => chain,
    range: () => chain,
    single: () => Promise.resolve(resolve(filters)),
    maybeSingle: () => Promise.resolve(resolve(filters)),
    then: (onFulfilled?: (value: unknown) => unknown) =>
      Promise.resolve(resolve(filters)).then(onFulfilled),
  };
  return chain;
}

function createSupabase(
  resolvers: Record<string, TableResolver>,
): SupabaseClient {
  const from = vi.fn((table: string) =>
    createChain(resolvers[table] ?? (() => ({ data: null, error: null }))),
  );
  return { from } as unknown as SupabaseClient;
}

const ok = (data: unknown) => ({ data, error: null });
const fail = () => ({ data: null, error: new Error("mock query failed") });

describe("buildLearningMaterialContext", () => {
  it("完整构建：图谱元数据 + 祖先链 + 子节点大纲", async () => {
    const supabase = createSupabase({
      knowledge_graphs: () =>
        ok({ id: "g1", title: "深度学习", description: "深度学习与神经网络", domain: "AI" }),
      edges: (filters) => {
        const target = filters.find((f) => f.col === "target_knowledge_point_id")?.value;
        const source = filters.find((f) => f.col === "source_knowledge_point_id")?.value;
        if (target === "n1") return ok([{ source_knowledge_point_id: "n2" }]);
        if (target === "n2") return ok([{ source_knowledge_point_id: "n3" }]);
        if (target === "n3") return ok([]);
        if (source === "n1") {
          return ok([
            { target_knowledge_point_id: "c1" },
            { target_knowledge_point_id: "c2" },
          ]);
        }
        return ok([]);
      },
      graph_nodes: (filters) => {
        const ids = (filters.find((f) => f.col === "knowledge_point_id")?.value as string[]) ?? [];
        if (ids.includes("n2") || ids.includes("n3")) {
          return ok([
            { knowledge_point_id: "n3", knowledge_points: [{ id: "n3", title: "神经网络基础" }] },
            { knowledge_point_id: "n2", knowledge_points: [{ id: "n2", title: "注意力机制" }] },
          ]);
        }
        if (ids.includes("c1") || ids.includes("c2")) {
          return ok([
            {
              knowledge_point_id: "c1",
              knowledge_points: [{ id: "c1", title: "自注意力机制", content: "计算 Query/Key/Value" }],
            },
            { knowledge_point_id: "c2", knowledge_points: [{ id: "c2", title: "多头注意力", content: "" }] },
          ]);
        }
        return ok([]);
      },
    });

    const ctx = await buildLearningMaterialContext(supabase, "g1", "n1", "zh-CN");

    expect(ctx.hasContext).toBe(true);
    expect(ctx.graphTitle).toBe("深度学习");
    expect(ctx.graphDescription).toBe("深度学习与神经网络");
    expect(ctx.graphDomain).toBe("AI");
    // 祖先自根向下（n3 → n2），不含节点自身
    expect(ctx.parentChain).toBe("神经网络基础 → 注意力机制");
    expect(ctx.childrenOutline).toBe(
      "- 自注意力机制：计算 Query/Key/Value\n- 多头注意力",
    );
  });

  it("祖先链防环：向上循环时停止，不无限遍历", async () => {
    const supabase = createSupabase({
      graph_nodes: (filters) => {
        const ids = (filters.find((f) => f.col === "knowledge_point_id")?.value as string[]) ?? [];
        if (ids.includes("n2")) {
          return ok([{ knowledge_point_id: "n2", knowledge_points: [{ id: "n2", title: "B" }] }]);
        }
        return ok([]);
      },
      edges: (filters) => {
        const target = filters.find((f) => f.col === "target_knowledge_point_id")?.value;
        if (target === "n1") return ok([{ source_knowledge_point_id: "n2" }]);
        if (target === "n2") return ok([{ source_knowledge_point_id: "n1" }]); // 环
        return ok([]);
      },
    });

    const ctx = await buildLearningMaterialContext(supabase, "g1", "n1");

    expect(ctx.parentChain).toBe("B");
  });

  it("无 graph_id：直接返回空上下文且不发起任何查询", async () => {
    const from = vi.fn();
    const supabase = { from } as unknown as SupabaseClient;

    const ctx = await buildLearningMaterialContext(supabase, undefined, "n1");

    expect(ctx.hasContext).toBe(false);
    expect(ctx.graphTitle).toBeUndefined();
    expect(ctx.parentChain).toBeUndefined();
    expect(ctx.childrenOutline).toBeUndefined();
    expect(from).not.toHaveBeenCalled();
  });

  it("查询失败：降级为部分/空结果，绝不抛错", async () => {
    const supabase = createSupabase({
      knowledge_graphs: fail,
      edges: fail,
      graph_nodes: fail,
    });

    const ctx = await buildLearningMaterialContext(supabase, "g1", "n1");

    expect(ctx.hasContext).toBe(false);
    expect(ctx.graphTitle).toBeUndefined();
    expect(ctx.graphDescription).toBeUndefined();
    expect(ctx.graphDomain).toBeUndefined();
    expect(ctx.parentChain).toBeUndefined();
    expect(ctx.childrenOutline).toBeUndefined();
  });

  it("仅图谱元数据可用（无祖先/无子节点）时仍返回 hasContext=true", async () => {
    const supabase = createSupabase({
      knowledge_graphs: () => ok({ id: "g1", title: "电力工程", description: null, domain: "电气" }),
      edges: () => ok([]),
      graph_nodes: () => ok([]),
    });

    const ctx = await buildLearningMaterialContext(supabase, "g1", "n1");

    expect(ctx.hasContext).toBe(true);
    expect(ctx.graphTitle).toBe("电力工程");
    expect(ctx.graphDomain).toBe("电气");
    expect(ctx.parentChain).toBeUndefined();
    expect(ctx.childrenOutline).toBeUndefined();
  });
});
