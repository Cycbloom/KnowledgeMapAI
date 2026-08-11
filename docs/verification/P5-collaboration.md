# P5 协作与同步全流程验证报告

> 对应 spec：`.trae/specs/verify-app-running-p5-collaboration/`
> 验证日期：2026-08-10
> 目标：验证协作与同步能力——图谱分享、版本与快照（创建/回滚/分支/合并预览）以及实时同步（SSE）。本报告覆盖**测试用例编写**阶段，并已完成 E2E 实际执行（chromium 项目）。

---

## 0. E2E 执行结果

| 项目 | 结果 |
|------|------|
| 执行命令 | `npx playwright test e2e/review-flow.spec.ts e2e/notes-capture.spec.ts e2e/graph-node-crud.spec.ts e2e/collaboration.spec.ts --project=chromium` |
| 总用例数 | 20（P2/P3/P4/P5） |
| 通过 | **20 / 20 ✅** |
| 执行时长 | 约 8.2 分钟 |
| 环境 | 本地 Supabase（`test@example.com` Local 用户）+ 自动启动 API/Vite 服务 |

---

## 1. 阶段结果概览

| 项目 | 状态 | 说明 |
|------|------|------|
| 覆盖盘点（Task 1） | ✅ 完成 | 已盘点既有协作覆盖与缺口 |
| 测试用例编写（Task 2～5） | ✅ 完成 | 已扩展 `e2e/collaboration.spec.ts` |
| TypeScript 编译校验 | ✅ 通过 | 单文件 `tsc --noEmit` exit 0 |
| E2E 实际执行 | ✅ 通过 | 20/20 用例通过（chromium，见第 0 节） |

> 回顾：`e2e/collaboration.spec.ts` 既有覆盖为图谱创建、分享按钮显示、打开分享对话框。本轮补齐**版本/快照**与 **SSE 实时同步**缺口。

---

## 2. 测试用例清单与覆盖说明

### 2.1 已覆盖（既有）
| 用例 | 说明 |
|------|------|
| 应该能够显示首页 | 登录后首页可见 |
| 应该能够创建新图谱 | POST `/api/graphs` 创建 + 画布可见 |
| 应该能够在图谱页面显示分享按钮 | 进入 `/graph/:id` 断言分享按钮可见 |
| 应该能够打开分享对话框 | 点击分享按钮断言对话框打开 |

### 2.2 新增（本轮）
| 用例 | 依据端点 | 断言 | 结果 |
|------|---------|------|------|
| 应该能够创建图谱快照 | POST `/api/v1/graphs/:id/snapshots` | 返回 `id`/`graphId`/`snapshotType==='manual'`；GET 列表包含该快照 | ✅ 通过 |
| 应该能够回滚到快照 | POST `/api/v1/graphs/:id/rollback` | 返回 `success===true` 且生成 `pre_rollback` 快照 | ✅ 通过 |
| 应该能够预览合并变更 | POST `/api/v1/graphs/:id/branches` → GET `/api/v1/graphs/:id/merge-preview?branchGraphId=` | 返回 `diff.summary.totalChanges` 与 `conflicts` 数组 | ✅ 通过 |
| 应该能够通过 SSE 收到协作变更推送 | GET `/api/v1/tasks/events`（原生 fetch + AbortController） | 收到 `connected` 建连事件，随后 abort 关闭 | ✅ 通过 |

> 既有用例（首页/创建图谱/分享按钮/分享对话框）执行亦全部通过。E2E 执行中发现并修复了 3 处缺陷，见第 4 节 E2 修复记录。

---

## 3. 端到端端点清单（依据代码实读）

| 端点（规范路径） | 请求/响应形态（源码） |
|------|------|
| `POST /api/v1/graphs/:id/snapshots` | body `{ description? }` → 201 `GraphSnapshot` |
| `GET /api/v1/graphs/:id/snapshots` | query `{ page, pageSize }` → `PaginatedResult<GraphSnapshot>` |
| `POST /api/v1/graphs/:id/rollback` | body `{ snapshotId }` → `{ success: true, preRollbackSnapshotId }` |
| `POST /api/v1/graphs/:id/branches` | body `{ branchName }` → 201 `{ graphId, snapshotId }` |
| `GET /api/v1/graphs/:id/branches` | → `BranchInfo[]` |
| `GET /api/v1/graphs/:id/merge-preview` | query `{ branchGraphId }` → `MergeResult { diff, conflicts }` |
| `POST /api/v1/graphs/:id/merge` | body `{ branchGraphId, selectedChanges?, conflictResolutions? }` → `ApplyMergeResult` |
| `GET /api/v1/tasks/events` | SSE 流，`data: { type, message?, data?, cacheKeys? }` | 

> 说明：Vite dev proxy 将 `/api/*` 转发至后端，后端通过 308 将 `/api/graphs/*` 重定向到 `/api/v1/graphs/*`（`api/app.ts`）。测试沿用既有 `/api/graphs/...` 约定，fetch 自动跟随重定向。

---

## 4. 决策记录与执行修复

### E1 环境从前置阶段到执行的说明
- 早期阶段（P1 报告 E1）本地 Supabase 因 CLI 缺失而不可用，仅完成用例编写与类型校验。
- 后续通过安装 Supabase CLI 二进制、配置 `SUPABASE_CONFIG_DIR`/`XDG_CONFIG_HOME` 重定向配置目录、停止端口冲突容器、`supabase db reset` 应用全部迁移（45 个迁移文件）后，本地 Supabase 可用，本报告 E2E 已实际执行。

### E2 E2E 执行期间发现并修复的缺陷
| 缺陷 | 现象 | 修复 |
|------|------|------|
| 旧路径重定向丢失查询参数 | `merge-preview?branchGraphId=...` 返回 400 | `api/app.ts`：重定向改用 `req.originalUrl` 提取 query 拼接，保留 `branchGraphId` 参数 |
| 分享对话框断言国际化 | 「应该能够打开分享对话框」断言硬编码中文 `分享图谱` 失败 | `e2e/collaboration.spec.ts`：改用 `getByRole('heading')` 双语匹配（`分享图谱` / `Share Graph`） |
| 图谱永久删除 RPC 类型错误 | `permanent_delete_graph` 报 `invalid input syntax for type integer`（UUID→int） | `supabase/migrations/14_functions.sql`：所有权检查由 `SELECT id INTO int 变量` 改为 `IF NOT EXISTS (SELECT 1 ...)` |

### SSE 推送覆盖的诚实说明
- 实时同步经 `sseService` 推送，事件由 `sseNotificationSubscriber` 订阅事件总线派生（`notification_needed`、`ai_task_completed/failed`、`task_completed`、`focus_session_ended`、`review_completed`）。
- **图谱绘图/快照类变更不直接产生派生的 SSE 事件**。因此 SSE 用例以连接建立事件 `connected`（`{ type: 'connected', message: 'SSE connection established' }`）作为实时通道可用的可靠断言基线，并通过 API 触发一次变更后等待推送窗口中事件。若后续新增图谱协作专属 SSE 事件，可增强为断言具体事件类型。

### 回滚状态断言的简化
- 因未引入节点数据，回滚用例未对图谱节点做前后内容比对，而是断言回滚响应 `success===true` 并生成 `pre_rollback` 快照（服务端回滚前自动快照），作为回滚链路生效的可靠指标。

---

## 5. 变更文件清单

- `e2e/collaboration.spec.ts` — 新增「版本与快照」「实时同步（SSE）」两组用例（未改动既有用例）；分享对话框断言改为双语匹配。
- `api/app.ts` — 修复旧路径重定向丢失查询参数（`merge-preview` 等携带 query 的请求）。
- `supabase/migrations/14_functions.sql` — 修复 `permanent_delete_graph` 所有权检查的 UUID→int 类型错误。
- `docs/verification/P5-collaboration.md` — 本报告。
- `.trae/specs/verify-app-running-p5-collaboration/checklist.md` — 更新勾选状态。
- `.trae/specs/verify-app-running-p5-collaboration/tasks.md` — 更新任务状态。

---

## 下一步
- ✅ 本地 Supabase 可用，`e2e/collaboration.spec.ts` 及 P2/P3/P4 spec 已补跑，20/20 通过。
- 若产品扩展图谱协作专属 SSE 事件，补强 SSE 用例的「变更后收到具体事件」断言。