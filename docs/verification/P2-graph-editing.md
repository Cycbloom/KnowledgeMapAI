# P2 建图与图谱编辑全流程验证报告

> **📄 历史快照（2026-08-10）**：本文为一次性验证报告，`e2e/graph-node-crud.spec.ts` 仍有效；文中引用的 `.trae/specs/` 规格文件已随仓库清理删除。

> 对应 spec：`.trae/specs/verify-app-running-p2-graph-editing/`（已删除）
> 验证日期：2026-08-10
> 目标：补齐"建图与图谱编辑"功能域的 E2E 覆盖，盘点既有覆盖，聚焦缺口（节点增删改），并记录环境限制。

---

## 1. 覆盖盘点（既有 vs 新增）

| 功能域 | 既有覆盖 spec | 覆盖情况 | 本轮动作 |
|--------|--------------|---------|---------|
| 创建图谱 → 打开画布 | `e2e/key-journeys.spec.ts` | ✅ 已覆盖（`[data-tour="canvas"]` 可见、URL 匹配 `/graph/{id}`） | 复用 |
| 骨干节点标题标准化/图标/标题保护/批量跳过 | `e2e/backbone-node.spec.ts` | ✅ 已覆盖 | 复用 |
| 画布关键交互（视图切换/缩放/拖拽/节点点选） | `e2e/quadrant-view.spec.ts` | ✅ 已覆盖 | 复用 |
| 文献提取（文本/文件/URL、概念挂载、骨干模块） | `e2e/literature-extract*.spec.ts` | ✅ 已覆盖 | 复用 |
| 节点创建 + GET 读回 | `e2e/key-journeys.spec.ts` | ✅ 已覆盖（POST /api/nodes + GET） | 复用 |
| **节点更新（普通节点成功更新）** | — | ❌ 缺口（既有仅覆盖骨干节点标题保护 403） | **新增** |
| **节点删除** | — | ❌ 缺口 | **新增** |

> 结论：图谱编辑大面积已覆盖。缺口集中在**非骨干节点的更新与删除**，故新增 `e2e/graph-node-crud.spec.ts` 补齐一个聚焦的 CRUD 周期（创建 + 更新 + 删除），创建/读回复用既有约定，避免与骨干节点专属测试重复。

## 2. 新增用例（`e2e/graph-node-crud.spec.ts`）

| 用例 | 走查结果 | E2E 结果 | 说明 |
|------|---------|---------|------|
| 应该能够创建节点并读回一致 | 逻辑核对通过 | ✅ 通过 | POST `/api/nodes`（`graph_id`/`title`/`content`）→ 断言返回 `id`/`title`；GET `/api/nodes/:id` 读回 `title`/`graph_id` |
| 应该能够更新节点标题并读回一致 | 逻辑核对通过 | ✅ 通过 | PUT `/api/nodes/:id`（`{ title }`）→ 断言读回更新后的 `title` |
| 应该能够删除节点且读回 404 | 逻辑核对通过 | ✅ 通过 | DELETE `/api/nodes/:id`（软删除）→ 再次 GET 断言 `status 404`、`code === RESOURCE_NODE_NOT_FOUND` |

> 端点核对：`api/routes/nodes.ts` 实际仅提供 **PUT** `/api/nodes/:id` 用于更新（无 PATCH 路由），故用例使用 PUT（spec 文本中"PATCH"经核对后采用实际 PUT 端点）。节点 ID 即 `knowledge_point_id`，供路由寻址。删除默认走软删除（`soft_delete_graph_node`），`?hard_delete=true` 才物理删除；软删除后 `getNode`（`notDeleted` 过滤）返回 404。

## 3. E2E 执行结果

- 本地 Supabase 就绪后，`e2e/graph-node-crud.spec.ts` 已实际执行：**3/3 用例通过**（chromium 项目）。
- 与 P3/P4/P5 的 spec 一并运行，共 **20/20** 通过，执行时长约 8.2 分钟。
- 执行期间未发现 P2 相关缺陷（图谱节点 CRUD 链路正常）。

## 4. 回归说明

- 本 spec 为验证 + 测试补齐，未改动任何业务逻辑。
- 新增文件：`e2e/graph-node-crud.spec.ts`（3 个用例）；`docs/verification/P2-graph-editing.md`（本报告）。

---

## 下一步

- ✅ 本地 Supabase 可用后已补跑 P2 全部 E2E（3/3 通过）。
- P3（复习）/P4（笔记）/P5（协作）复用本 spec 的 E2E 基建约定（`fixtures.ts` + App Action 模式）。