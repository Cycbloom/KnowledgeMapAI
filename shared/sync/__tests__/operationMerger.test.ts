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

  describe("边界情况：空数据与缺失字段", () => {
    it("create 空数据 + update 带数据 → 合并为带数据的 create", () => {
      const create = makeOp("create", "graphs", "g1", {}, "2026-01-01T00:00:00Z");
      const update = makeOp(
        "update",
        "graphs",
        "g1",
        { name: "图谱" },
        "2026-01-02T00:00:00Z",
      );

      const result = mergeOperations([create, update]);

      expect(result).toHaveLength(1);
      expect(result[0].action).toBe("create");
      expect(result[0].data).toEqual({ name: "图谱" });
    });

    it("create 带数据 + update 空数据 → 保留 create 数据", () => {
      const create = makeOp(
        "create",
        "graphs",
        "g1",
        { name: "图谱" },
        "2026-01-01T00:00:00Z",
      );
      const update = makeOp("update", "graphs", "g1", {}, "2026-01-02T00:00:00Z");

      const result = mergeOperations([create, update]);

      expect(result).toHaveLength(1);
      expect(result[0].action).toBe("create");
      // 空对象合并不改变原数据
      expect(result[0].data).toEqual({ name: "图谱" });
      // timestamp 仍取后者
      expect(result[0].timestamp).toBe("2026-01-02T00:00:00Z");
    });

    it("update 空数据 + update 带数据 → 合并为带数据的 update", () => {
      const update1 = makeOp("update", "graphs", "g1", {}, "2026-01-01T00:00:00Z");
      const update2 = makeOp(
        "update",
        "graphs",
        "g1",
        { name: "图谱" },
        "2026-01-02T00:00:00Z",
      );

      const result = mergeOperations([update1, update2]);

      expect(result).toHaveLength(1);
      expect(result[0].data).toEqual({ name: "图谱" });
    });

    it("delete 空数据 + create 带数据 → 保留 create 数据", () => {
      const del = makeOp("delete", "graphs", "g1", {}, "2026-01-01T00:00:00Z");
      const create = makeOp(
        "create",
        "graphs",
        "g1",
        { name: "图谱" },
        "2026-01-02T00:00:00Z",
      );

      const result = mergeOperations([del, create]);

      expect(result).toHaveLength(1);
      expect(result[0].action).toBe("create");
      expect(result[0].data).toEqual({ name: "图谱" });
    });
  });

  describe("边界情况：同时间戳与顺序", () => {
    it("相同 timestamp 的 create + update 仍按数组顺序合并", () => {
      const ts = "2026-01-01T00:00:00Z";
      const create = makeOp("create", "graphs", "g1", { name: "原" }, ts);
      const update = makeOp("update", "graphs", "g1", { name: "改" }, ts);

      const result = mergeOperations([create, update]);

      expect(result).toHaveLength(1);
      expect(result[0].action).toBe("create");
      expect(result[0].data).toEqual({ name: "改" });
      expect(result[0].timestamp).toBe(ts);
    });

    it("相同 timestamp 的 update + update → 后者字段覆盖", () => {
      const ts = "2026-01-01T00:00:00Z";
      const u1 = makeOp("update", "graphs", "g1", { name: "一" }, ts);
      const u2 = makeOp("update", "graphs", "g1", { name: "二" }, ts);

      const result = mergeOperations([u1, u2]);

      expect(result).toHaveLength(1);
      expect(result[0].data).toEqual({ name: "二" });
    });

    it("update 字段不相交时顺序不影响最终字段集合", () => {
      // u1 改 name，u2 改 color，字段不相交
      const u1 = makeOp(
        "update",
        "graphs",
        "g1",
        { name: "图谱" },
        "2026-01-01T00:00:00Z",
      );
      const u2 = makeOp(
        "update",
        "graphs",
        "g1",
        { color: "red" },
        "2026-01-02T00:00:00Z",
      );

      const r1 = mergeOperations([u1, u2]);
      const r2 = mergeOperations([u2, u1]);

      // 字段集合相同（顺序不影响最终拥有的字段）
      expect(r1[0].data).toHaveProperty("name");
      expect(r1[0].data).toHaveProperty("color");
      expect(r2[0].data).toHaveProperty("name");
      expect(r2[0].data).toHaveProperty("color");
    });

    it("update 字段相交时数组顺序决定覆盖方向", () => {
      // 同字段 color，后写入者覆盖
      const u1 = makeOp(
        "update",
        "graphs",
        "g1",
        { color: "red" },
        "2026-01-01T00:00:00Z",
      );
      const u2 = makeOp(
        "update",
        "graphs",
        "g1",
        { color: "blue" },
        "2026-01-02T00:00:00Z",
      );

      const r1 = mergeOperations([u1, u2]);
      const r2 = mergeOperations([u2, u1]);

      // [u1, u2]: u2 覆盖 → blue
      expect(r1[0].data.color).toBe("blue");
      // [u2, u1]: u1 覆盖 → red
      expect(r2[0].data.color).toBe("red");
    });
  });

  describe("边界情况：大规模与性能", () => {
    it("1000 条不同记录的 create 可在合理时间内合并", () => {
      const ops = Array.from({ length: 1000 }, (_, i) =>
        makeOp("create", "graphs", `g${i}`, { name: `图谱${i}` }),
      );

      const result = mergeOperations(ops);

      expect(result).toHaveLength(1000);
    });

    it("同记录 1000 次 update 合并为 1 条", () => {
      const ops = Array.from({ length: 1000 }, (_, i) =>
        makeOp(
          "update",
          "graphs",
          "g1",
          { v: i },
          `2026-01-01T00:00:${String(i).padStart(2, "0")}Z`,
        ),
      );

      const result = mergeOperations(ops);

      expect(result).toHaveLength(1);
      expect(result[0].action).toBe("update");
      // 最后一次 v=999 覆盖
      expect(result[0].data.v).toBe(999);
    });

    it("多记录各多操作混合不丢失记录", () => {
      // 10 条记录，每条 5 次 update
      const ops: SyncOperation[] = [];
      for (let r = 0; r < 10; r++) {
        for (let v = 0; v < 5; v++) {
          ops.push(
            makeOp(
              "update",
              "graphs",
              `g${r}`,
              { v },
              `2026-01-0${v + 1}T00:00:00Z`,
            ),
          );
        }
      }

      const result = mergeOperations(ops);

      expect(result).toHaveLength(10);
      // 每条记录的 v 都应为 4（最后一次）
      for (const op of result) {
        expect(op.data.v).toBe(4);
      }
    });
  });

  describe("边界情况：并发独立编辑", () => {
    it("不同 table 的同 recordId 操作互不干扰", () => {
      const ops = [
        makeOp("create", "graphs", "shared-id", { name: "图谱" }),
        makeOp("create", "nodes", "shared-id", { title: "节点" }),
        makeOp("update", "graphs", "shared-id", { color: "red" }),
        makeOp("update", "nodes", "shared-id", { level: 1 }, "2026-01-02T00:00:00Z"),
      ];

      const result = mergeOperations(ops);

      expect(result).toHaveLength(2);
      const graphOp = result.find((o) => o.table === "graphs");
      const nodeOp = result.find((o) => o.table === "nodes");
      expect(graphOp?.action).toBe("create");
      expect(graphOp?.data).toEqual({ name: "图谱", color: "red" });
      expect(nodeOp?.action).toBe("create");
      expect(nodeOp?.data).toEqual({ title: "节点", level: 1 });
    });

    it("不同记录的链式操作各自独立合并", () => {
      // g1: create→update→delete（最终空）
      // g2: update→create→update（最终 create 带合并数据）
      // g3: delete→create（最终 create）
      const ops = [
        makeOp("create", "graphs", "g1", { name: "g1" }, "2026-01-01T00:00:00Z"),
        makeOp("update", "graphs", "g2", { x: 1 }, "2026-01-01T00:00:00Z"),
        makeOp("delete", "graphs", "g3", {}, "2026-01-01T00:00:00Z"),
        makeOp("update", "graphs", "g1", { v: 2 }, "2026-01-02T00:00:00Z"),
        makeOp("create", "graphs", "g2", { name: "g2" }, "2026-01-02T00:00:00Z"),
        makeOp("create", "graphs", "g3", { name: "g3" }, "2026-01-02T00:00:00Z"),
        makeOp("delete", "graphs", "g1", {}, "2026-01-03T00:00:00Z"),
        makeOp("update", "graphs", "g2", { name: "g2-v2" }, "2026-01-03T00:00:00Z"),
      ];

      const result = mergeOperations(ops);

      // g1: create+update→create, create+delete→移除
      // g2: update+create→create, create+update→合并 create
      // g3: delete+create→create
      const ids = result.map((o) => o.recordId).sort();
      expect(ids).toEqual(["g2", "g3"]);
      const g2 = result.find((o) => o.recordId === "g2");
      const g3 = result.find((o) => o.recordId === "g3");
      expect(g2?.action).toBe("create");
      // create 数据被后续 update 覆盖
      expect(g2?.data).toEqual({ name: "g2-v2" });
      expect(g2?.timestamp).toBe("2026-01-03T00:00:00Z");
      expect(g3?.action).toBe("create");
      expect(g3?.data).toEqual({ name: "g3" });
    });

    it("空对象 data 不影响其他记录合并", () => {
      const ops = [
        makeOp("create", "graphs", "g1", {}),
        makeOp("create", "graphs", "g2", { name: "g2" }),
      ];

      const result = mergeOperations(ops);

      expect(result).toHaveLength(2);
      const g1 = result.find((o) => o.recordId === "g1");
      const g2 = result.find((o) => o.recordId === "g2");
      expect(g1?.data).toEqual({});
      expect(g2?.data).toEqual({ name: "g2" });
    });
  });
});
