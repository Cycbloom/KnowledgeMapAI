import { describe, it, expect } from "vitest";
import type { SyncOperation } from "../types";
import { mergeOperations } from "../operationMerger";

function makeOp(
  action: SyncOperation["action"],
  table: string,
  recordId: string,
  data: Record<string, unknown> = {},
  timestamp = "2026-01-01T00:00:00Z",
): SyncOperation {
  return {
    id: `${action}-${table}-${recordId}-${timestamp}`,
    action,
    table,
    recordId,
    data,
    timestamp,
    userId: "user-1",
  };
}

describe("mergeOperations", () => {
  describe("9 种 action 组合", () => {
    it("create + update → 合并 update 字段到 create 数据", () => {
      const create = makeOp(
        "create",
        "graphs",
        "g1",
        { name: "图谱", color: "red" },
        "2026-01-01T00:00:00Z",
      );
      const update = makeOp(
        "update",
        "graphs",
        "g1",
        { color: "blue", extra: 1 },
        "2026-01-02T00:00:00Z",
      );

      const result = mergeOperations([create, update]);

      expect(result).toHaveLength(1);
      expect(result[0].action).toBe("create");
      expect(result[0].data).toEqual({ name: "图谱", color: "blue", extra: 1 });
      // timestamp 取后者
      expect(result[0].timestamp).toBe("2026-01-02T00:00:00Z");
    });

    it("create + delete → 移除操作", () => {
      const create = makeOp("create", "graphs", "g1", { name: "图谱" });
      const del = makeOp("delete", "graphs", "g1", {}, "2026-01-02T00:00:00Z");

      const result = mergeOperations([create, del]);

      expect(result).toHaveLength(0);
    });

    it("create + create → 后者覆盖（视为重新创建）", () => {
      const create1 = makeOp(
        "create",
        "graphs",
        "g1",
        { name: "旧" },
        "2026-01-01T00:00:00Z",
      );
      const create2 = makeOp(
        "create",
        "graphs",
        "g1",
        { name: "新" },
        "2026-01-02T00:00:00Z",
      );

      const result = mergeOperations([create1, create2]);

      expect(result).toHaveLength(1);
      expect(result[0]).toBe(create2);
      expect(result[0].data).toEqual({ name: "新" });
    });

    it("update + update → 后者字段覆盖前者", () => {
      const update1 = makeOp(
        "update",
        "graphs",
        "g1",
        { name: "图谱", color: "red" },
        "2026-01-01T00:00:00Z",
      );
      const update2 = makeOp(
        "update",
        "graphs",
        "g1",
        { color: "blue", extra: 1 },
        "2026-01-02T00:00:00Z",
      );

      const result = mergeOperations([update1, update2]);

      expect(result).toHaveLength(1);
      expect(result[0].action).toBe("update");
      expect(result[0].data).toEqual({ name: "图谱", color: "blue", extra: 1 });
      expect(result[0].timestamp).toBe("2026-01-02T00:00:00Z");
    });

    it("update + delete → 保留 delete", () => {
      const update = makeOp(
        "update",
        "graphs",
        "g1",
        { name: "图谱" },
        "2026-01-01T00:00:00Z",
      );
      const del = makeOp("delete", "graphs", "g1", {}, "2026-01-02T00:00:00Z");

      const result = mergeOperations([update, del]);

      expect(result).toHaveLength(1);
      expect(result[0]).toBe(del);
      expect(result[0].action).toBe("delete");
    });

    it("update + create → 视为重新创建，保留新 create 数据", () => {
      const update = makeOp(
        "update",
        "graphs",
        "g1",
        { name: "旧" },
        "2026-01-01T00:00:00Z",
      );
      const create = makeOp(
        "create",
        "graphs",
        "g1",
        { name: "新" },
        "2026-01-02T00:00:00Z",
      );

      const result = mergeOperations([update, create]);

      expect(result).toHaveLength(1);
      expect(result[0]).toBe(create);
      expect(result[0].action).toBe("create");
      expect(result[0].data).toEqual({ name: "新" });
    });

    it("delete + update → 保留 delete（删除意图优先，避免已删记录被复活）", () => {
      const del = makeOp("delete", "graphs", "g1", {}, "2026-01-01T00:00:00Z");
      const update = makeOp(
        "update",
        "graphs",
        "g1",
        { name: "图谱" },
        "2026-01-02T00:00:00Z",
      );

      const result = mergeOperations([del, update]);

      expect(result).toHaveLength(1);
      expect(result[0]).toBe(del);
      expect(result[0].action).toBe("delete");
      // data 应保持原 delete 的空数据，不应被 update 覆盖
      expect(result[0].data).toEqual({});
      // timestamp 不应被 update 推进
      expect(result[0].timestamp).toBe("2026-01-01T00:00:00Z");
    });

    it("delete + create → 视为重新创建，保留新 create 数据", () => {
      const del = makeOp("delete", "graphs", "g1", {}, "2026-01-01T00:00:00Z");
      const create = makeOp(
        "create",
        "graphs",
        "g1",
        { name: "新图谱" },
        "2026-01-02T00:00:00Z",
      );

      const result = mergeOperations([del, create]);

      expect(result).toHaveLength(1);
      expect(result[0]).toBe(create);
      expect(result[0].action).toBe("create");
      expect(result[0].data).toEqual({ name: "新图谱" });
    });

    it("delete + delete → 保留 delete（幂等）", () => {
      const del1 = makeOp("delete", "graphs", "g1", {}, "2026-01-01T00:00:00Z");
      const del2 = makeOp("delete", "graphs", "g1", {}, "2026-01-02T00:00:00Z");

      const result = mergeOperations([del1, del2]);

      expect(result).toHaveLength(1);
      // 应保留第一个 delete，不被后者覆盖
      expect(result[0]).toBe(del1);
      expect(result[0].timestamp).toBe("2026-01-01T00:00:00Z");
    });
  });

  describe("多操作链式合并", () => {
    it("[create, update, update, delete] → 空结果（create+update 合并仍为 create，再 create+delete 移除）", () => {
      // 依据 spec: create + update → 合并到 create（仍为 create），create + delete → 移除操作
      // 因此 create→update→update→delete 等价于 create+delete，最终为空
      const ops = [
        makeOp("create", "graphs", "g1", { name: "图谱", v: 1 }, "2026-01-01T00:00:00Z"),
        makeOp("update", "graphs", "g1", { v: 2 }, "2026-01-02T00:00:00Z"),
        makeOp("update", "graphs", "g1", { v: 3 }, "2026-01-03T00:00:00Z"),
        makeOp("delete", "graphs", "g1", {}, "2026-01-04T00:00:00Z"),
      ];

      const result = mergeOperations(ops);

      expect(result).toHaveLength(0);
    });

    it("[update, update, update, delete] → 最终仅保留一条 delete", () => {
      // 与上一用例对照：update+update→update，update+delete→保留 delete
      const ops = [
        makeOp("update", "graphs", "g1", { name: "图谱", v: 1 }, "2026-01-01T00:00:00Z"),
        makeOp("update", "graphs", "g1", { v: 2 }, "2026-01-02T00:00:00Z"),
        makeOp("update", "graphs", "g1", { v: 3 }, "2026-01-03T00:00:00Z"),
        makeOp("delete", "graphs", "g1", {}, "2026-01-04T00:00:00Z"),
      ];

      const result = mergeOperations(ops);

      expect(result).toHaveLength(1);
      expect(result[0].action).toBe("delete");
      expect(result[0].timestamp).toBe("2026-01-04T00:00:00Z");
    });

    it("[create, update, delete, create] → 最终保留重新创建的 create", () => {
      const ops = [
        makeOp("create", "graphs", "g1", { name: "旧" }, "2026-01-01T00:00:00Z"),
        makeOp("update", "graphs", "g1", { name: "中间" }, "2026-01-02T00:00:00Z"),
        makeOp("delete", "graphs", "g1", {}, "2026-01-03T00:00:00Z"),
        makeOp("create", "graphs", "g1", { name: "新" }, "2026-01-04T00:00:00Z"),
      ];

      const result = mergeOperations(ops);

      expect(result).toHaveLength(1);
      expect(result[0].action).toBe("create");
      expect(result[0].data).toEqual({ name: "新" });
      expect(result[0].timestamp).toBe("2026-01-04T00:00:00Z");
    });

    it("[delete, update, create, update] → 最终保留 create+update 合并结果", () => {
      // delete + update → delete；delete + create → create；create + update → 合并
      const ops = [
        makeOp("delete", "graphs", "g1", {}, "2026-01-01T00:00:00Z"),
        makeOp("update", "graphs", "g1", { ignored: true }, "2026-01-02T00:00:00Z"),
        makeOp("create", "graphs", "g1", { name: "新建" }, "2026-01-03T00:00:00Z"),
        makeOp("update", "graphs", "g1", { name: "改名" }, "2026-01-04T00:00:00Z"),
      ];

      const result = mergeOperations(ops);

      expect(result).toHaveLength(1);
      expect(result[0].action).toBe("create");
      // create 数据被后续 update 覆盖
      expect(result[0].data).toEqual({ name: "改名" });
      expect(result[0].timestamp).toBe("2026-01-04T00:00:00Z");
    });
  });

  describe("不同 table/recordId 互不干扰", () => {
    it("同表不同 recordId 不合并", () => {
      const ops = [
        makeOp("create", "graphs", "g1", { name: "图谱1" }),
        makeOp("create", "graphs", "g2", { name: "图谱2" }),
      ];

      const result = mergeOperations(ops);

      expect(result).toHaveLength(2);
      expect(result.map((o) => o.recordId).sort()).toEqual(["g1", "g2"]);
    });

    it("同 recordId 不同表不合并", () => {
      const ops = [
        makeOp("create", "graphs", "id1", { name: "图谱" }),
        makeOp("create", "nodes", "id1", { title: "节点" }),
      ];

      const result = mergeOperations(ops);

      expect(result).toHaveLength(2);
      expect(result.map((o) => o.table).sort()).toEqual(["graphs", "nodes"]);
    });

    it("多记录混合操作各自独立合并", () => {
      // g1: create + update → 合并为 create（带新数据）
      // g2: update + delete → 保留 delete（依据 spec）
      const ops = [
        makeOp("create", "graphs", "g1", { name: "g1" }, "2026-01-01T00:00:00Z"),
        makeOp("update", "graphs", "g2", { name: "g2" }, "2026-01-01T00:00:00Z"),
        makeOp("update", "graphs", "g1", { name: "g1-v2" }, "2026-01-02T00:00:00Z"),
        makeOp("delete", "graphs", "g2", {}, "2026-01-02T00:00:00Z"),
      ];

      const result = mergeOperations(ops);

      expect(result).toHaveLength(2);
      const g1 = result.find((o) => o.recordId === "g1");
      const g2 = result.find((o) => o.recordId === "g2");
      expect(g1?.action).toBe("create");
      expect(g1?.data).toEqual({ name: "g1-v2" });
      expect(g2?.action).toBe("delete");
    });
  });

  describe("边界情况", () => {
    it("空输入返回空数组", () => {
      expect(mergeOperations([])).toEqual([]);
    });

    it("单个元素返回相同数组（按值）", () => {
      const single = makeOp("create", "graphs", "g1", { name: "图谱" });
      const result = mergeOperations([single]);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(single);
    });

    it("单个元素返回值与输入不共享引用（虽然内容相同）", () => {
      // 单元素路径走 Array.from(map.values())，结果元素仍指向原对象引用
      // 这里仅断言内容相等
      const single = makeOp("create", "graphs", "g1", { name: "图谱" });
      const result = mergeOperations([single]);
      expect(result[0]).toEqual(single);
    });
  });
});
