# P0 标签系统统一管理 — 实施 Spec

> 状态：待实施 | 日期：2026-08-18 | 优先级：P0 | 预计轮次：1 轮 spec（Phase 1+2），Phase 3 可选

## 1. 背景与现状

### 1.1 标签存储现状（6 处，分散）

| 位置 | 存储形式 | 现有消费方 |
|---|---|---|
| `notes.tags` | `TEXT[]`（32_notes.sql:55） | NotesListPage 本地点击筛选 + TagChips 展示 |
| `user_tasks.tags` | `TEXT[]`（07_scheduler_tasks.sql:37） | 任务数据透传，无筛选 UI |
| `task_templates.tags` | `TEXT[]`（07:265） | 模板数据透传 |
| `templates.tags` | `TEXT[]`（10_ai_and_prompts.sql:111） | 图谱模板数据透传 |
| `knowledge_points.properties->'tags'` | JSONB（节点级） | `get_user_graph_tags` RPC 聚合 → `graphsApi.getTags()` → GraphEditor TagCloud |
| `task_tags` 表 | 独立注册表（id/name/color/user_id） | **孤儿表**，无任何 API/前端使用 |

### 1.2 缺口

1. `knowledge_graphs` 表**无 tags 列** → 图谱（Dashboard 主资源）无法打标签、无法按标签筛选
2. 无跨资源标签 API：重命名/合并/删除需逐资源手动改
3. `graphsApi.getTags()` 仅聚合同一张表的节点标签，不覆盖图谱/笔记/任务

## 2. 目标 / 非目标

**目标**
- 图谱支持打标签，Dashboard 支持按标签筛选
- 统一标签管理：一处重命名/合并/删除，全部资源同步
- 复用现有 `TagSystem` 视觉风格与 Notes 筛选交互模式

**非目标**
- 不新建统一标签注册表、不迁移 inline `TEXT[]`（单用户工具，迁移高风险低收益）
- 不动孤儿表 `task_tags`（留待后续架构治理决定删除或启用）
- 不改 `get_user_graph_tags` RPC 语义（节点标签与资源标签是两个概念，保持隔离）
- 不做标签颜色持久化（沿用 `TagSystem` 的 hash 配色）

## 3. 设计决策

| # | 决策 | 理由 |
|---|---|---|
| A | 图谱级标签 = `knowledge_graphs` 新增 `tags TEXT[] DEFAULT '{}'` | 一行 schema 变更，Dashboard 最自然入口 |
| B | 跨资源管理走 service 层聚合，存储保持 inline | 避免 6 处数据迁移；单用户数据量小，批量 UPDATE 可接受 |
| C | 新增独立 `/api/v1/tags` 路由（挂 CorePlugin），不塞进 `/graphs` | 标签横切多资源，语义独立 |
| D | Dashboard 筛选交互复刻 NotesListPage 的 `filterTag` 模式（localStorage 持久化） | 交互一致、实现成本低 |

## 4. 实施方案

### Phase 1 — 图谱级标签（核心 UX 价值）

**Schema**（`supabase/migrations/02_knowledge_graph.sql`）
- `knowledge_graphs` 表增加 `tags TEXT[] DEFAULT '{}'`
- 变更后运行 `npm run db:gen-types`
- 远程库：提取该行 SQL 在 Supabase Dashboard 执行

**后端**
- `api/services/graph/graphService.ts`：`createGraph`（:206）/ `updateGraph`（:385）payload 增加可选 `tags: string[]` 透传（加列后 Supabase 直接受，确认无字段白名单拦截即可）
- `api/routes/graphs/`（CRUD 路由）：create/update 请求体校验增加 `tags`（可选，`string[]`，每项 trim + 非空 + 长度 ≤ 30，数组去重，上限 20 个）

**前端**
- `src/services/api/graphs.ts` + `contracts/IGraphsApi.ts`：create/update 类型增加 `tags?: string[]`；Graph 类型（`@shared/types/graph`）增加 `tags: string[]`
- `src/hooks/queries/config.ts`：`queryKeys.graphs` 增加 tag 维度参数（序列化为排序字符串，遵循缓存键规范）
- `Dashboard`：
  - `useDashboardFilters` 增加 `filterTag`（`usePersistedListState`，key `dashboard-filterTag`）
  - 新组件 `src/components/Dashboard/TagFilterBar.tsx`：横向标签 chip 条，点击切换筛选，复用 Notes 的 TagChips 配色逻辑
  - `DashboardGraphCard` 展示 tags chips（点击 chip 即筛选）
  - `DashboardCardContextMenu` 增加"编辑标签"入口 → 弹 `TagEditDialog`（输入 + 自动补全，补全源 = `tagsApi.list()` 中 graphs 维度）
  - 图谱创建对话框增加 tags 可选输入

### Phase 2 — 跨资源标签管理

**后端**（新增 `api/services/tags/`）
- `tagService.ts`：
  - `list(supabase, userId)`：并行查询 `knowledge_graphs.tags` / `notes.tags` / `user_tasks.tags`（均 `notDeleted`），聚合为 `Array<{ name, counts: { graphs, notes, tasks }, total }>`，按 total 降序；走 `cacheService.getOrSet(CacheKeys.USER_TAGS(userId), ..., ['user:${userId}', 'tags'])`
  - `rename(supabase, userId, from, to)`：事务内三表 `array_replace(tags, from, to)`（SQL 表达式更新，非逐行读取）
  - `merge(supabase, userId, sources[], target)`：三表中 `tags = array(select distinct unnest(tags) - sources + target)`（等价 SQL：先 remove sources 再 append target 去重）
  - `remove(supabase, userId, name)`：三表 `tags = array_remove(tags, name)`
  - 所有写操作后失效 `USER_TAGS` + `GRAPHS` + `NOTES` + `TASKS` 相关缓存标签
- `tagRouteService.ts`：参数校验（name 非空、≤30 字符；merge sources ≤ 10 且不含 target）
- `api/routes/tags.ts`：
  - `GET /`、`POST /rename`、`POST /merge`、`DELETE /:name`（name URL-encoded）
- `CorePlugin.onInstall` 注册 `kernel.registerRoutes("/api/v1/tags", tagsRoutes)`

**前端**
- `src/services/api/tags.ts`：`export const tagsApi = { list, rename, merge, delete }`（遵循 API 命名规范）
- `contracts/ITagsApi.ts` + `IApi.ts` + `src/services/api/index.ts`（`export const api = { ..., tags: tagsApi }`）
- `queryKeys`：`tags: ["tags"] as const`
- `src/hooks/queries/useTags.ts`：useQuery + rename/merge/remove mutations（onSuccess 失效 `queryKeys.tags` + `queryKeys.graphs` + notes/tasks 相关键）
- `src/components/common/TagManagerDialog.tsx`：标签列表（含各资源计数）+ 行内重命名 + 多选合并 + 删除（带确认）；入口放 Settings 页"标签管理"分区
- NotesListPage / Dashboard 筛选状态不强制统一（各自 localStorage 持久化已够用）

### Phase 3 —（可选，后续轮次）任务标签筛选

- Tasks 页复用 TagFilterBar；`user_tasks` 列表 API 支持 `tags` 过滤参数

## 5. API 契约

```
GET    /api/v1/tags
       → { tags: Array<{ name: string; counts: { graphs: number; notes: number; tasks: number }; total: number }> }
POST   /api/v1/tags/rename   { from: string; to: string }        → { updated: { graphs: number; notes: number; tasks: number } }
POST   /api/v1/tags/merge    { sources: string[]; target: string } → { updated: { ... } }
DELETE /api/v1/tags/:name    → { removed: { ... } }
```

## 6. 缓存失效矩阵

| 操作 | 失效键/标签 |
|---|---|
| 图谱 create/update（含 tags 变更） | `user:${userId}`、`graphs`、`tags` |
| 标签 rename/merge/remove | `USER_TAGS`、`GRAPH_TAGS`、graphs/notes/tasks 列表缓存 |
| 笔记/任务 tags 变更 | 对应资源缓存 + `tags` 标签 |

## 7. i18n

- 新增命名空间 key：`dashboard.tags.*`（筛选条、编辑对话框）、`tags.manager.*`（管理面板）
- zh-CN / en-US 严格对称，跑 `scripts/check-i18n-keys.ts` 校验

## 8. 测试计划

| 层 | 内容 | 设施 |
|---|---|---|
| 单元 | tagService list/rename/merge/remove（MSW mock 三表） | `tests/helpers/mockFactories.ts` + `mswHandlers.ts` |
| 单元 | TagFilterBar 渲染/点击筛选/持久化 | `renderWithProviders.tsx` |
| 单元 | tagsApi 契约 | MSW |
| E2E | Dashboard 打标签 → 筛选 → TagManager 重命名 → 卡片同步 | `e2e/` Page Object 模式 |
| Schema | `npm run db:gen-types` 后 `npm run check` 通过；`db:local:reset` 验证 | — |

门禁：日常 `check` + `lint`；本 spec 为里程碑节点，交付前跑 `test:run` + 相关 E2E。

## 9. 验收标准

1. Dashboard：图谱卡片可编辑标签、点 chip 即筛选、筛选状态刷新后保留
2. TagManagerDialog：重命名/合并/删除后，图谱卡片、笔记列表、任务数据标签同步更新（缓存正确失效，无残留旧标签）
3. `GET /api/v1/tags` 计数与三表实际一致
4. 图谱创建/编辑全链路 tags 透传无丢失
5. 代码规范：无 `any`、无非空断言、前端无 `console.log/info`、后端用 `logger`
6. i18n 中英对称无硬编码

## 10. 涉及文件清单

**修改**
- `supabase/migrations/02_knowledge_graph.sql`（+1 行）
- `api/services/graph/graphService.ts`、`api/routes/graphs/`（tags 透传/校验）
- `api/services/plugins/CorePlugin.ts`（注册 tags 路由）
- `src/services/api/graphs.ts`、`contracts/IGraphsApi.ts`、`contracts/IApi.ts`、`src/services/api/index.ts`
- `src/hooks/queries/config.ts`（queryKeys）
- `src/pages/Dashboard.tsx`、`src/hooks/dashboard/useDashboardFilters.ts`（如路径不同以实际为准）、`src/components/Dashboard/DashboardGraphCard.tsx`、`DashboardCardContextMenu.tsx`
- `src/pages/Settings.tsx`（管理入口）
- `src/i18n/locales/zh-CN/*.json`、`en-US/*.json`

**新增**
- `api/services/tags/tagService.ts`、`tagRouteService.ts`、`api/routes/tags.ts`
- `src/services/api/tags.ts`、`contracts/ITagsApi.ts`
- `src/hooks/queries/useTags.ts`
- `src/components/Dashboard/TagFilterBar.tsx`、`TagEditDialog.tsx`
- `src/components/common/TagManagerDialog.tsx`
- 测试：`tests/`（tagService 单测）、`e2e/tags.spec.ts`
