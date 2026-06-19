# 路由层业务逻辑下沉（第四轮）Spec

## Why
前三轮重构已解决 domains、graphs/crud（部分）、literature、expansion、backup、tasks、progress、schedules、templates、structures 的泄漏问题，路由层 DB 调用从 367 次降至 252 次。本轮聚焦剩余 **7 个重灾区文件**（≥10 次 DB 调用），它们合计 112 次调用，占剩余总量的 44.4%。

## What Changes
- **新增** `api/services/quiz/quizSetsService.ts` — 测验集合 + 卡片管理（从 `quizSets.ts` 提取，25 次 DB 调用）
- **扩展** `api/services/graph/graphCrudService.ts` — 图谱 CRUD 剩余逻辑（从 `graphs/crud.ts` 提取剩余 16 次 DB 调用）
- **新增** `api/services/graph/dataService.ts` — 数据导入导出（从 `data.ts` 提取，15 次 DB 调用）
- **新增** `api/services/sync/syncService.ts` — 数据同步（从 `sync.ts` 提取，15 次 DB 调用）
- **新增** `api/services/graph/nodesService.ts` — 节点+边管理（从 `nodes.ts` 提取，15 次 DB 调用）
- **新增** `api/services/scheduler/subtaskService.ts` — 子任务管理（从 `scheduler/subtasks.ts` 提取，14 次 DB 调用）
- **新增** `api/services/graph/graphRelationsService.ts` — 图谱关系管理（从 `graphRelations.ts` 提取，12 次 DB 调用）
- **修改** 对应的 7 个路由文件，精简为委托调用

## Impact
- Affected specs: 无破坏性变更，所有 API 接口保持不变
- Affected code:
  - `api/routes/quizSets.ts`（精简全部路由）
  - `api/routes/graphs/crud.ts`（精简剩余直接 DB 调用的路由）
  - `api/routes/data.ts`（精简全部路由）
  - `api/routes/sync.ts`（精简全部路由）
  - `api/routes/nodes.ts`（精简全部路由）
  - `api/routes/scheduler/subtasks.ts`（精简全部路由）
  - `api/routes/graphRelations.ts`（精简全部路由）

## ADDED Requirements

### Requirement: 测验集合服务（quizSetsService）
系统 SHALL 提供 `quizSetsService` 封装测验集合和测验卡片的完整管理逻辑。

- `list(supabase, userId, filters)` — 查询测验集合列表（含卡片计数）
- `get(supabase, userId, quizSetId)` — 获取测验集合详情（含卡片列表）
- `create(supabase, userId, data)` — 创建测验集合
- `update(supabase, userId, quizSetId, data)` — 更新测验集合
- `delete(supabase, userId, quizSetId)` — 删除测验集合（级联删除卡片）
- `generateCards(supabase, userId, quizSetId, options)` — AI 生成测验卡片
- `regenerateCard(supabase, userId, cardId)` — 重新生成单张卡片
- `listCards(supabase, userId, quizSetId)` — 查询卡片列表
- `addCard(supabase, userId, quizSetId, data)` — 添加卡片
- `updateCard(supabase, userId, cardId, data)` — 更新卡片
- `deleteCard(supabase, userId, cardId)` — 删除卡片

### Requirement: 图谱数据服务（dataService）
系统 SHALL 提供 `dataService` 封装数据导入导出逻辑。

- `exportGraph(supabase, userId, graphId, format)` — 导出图谱数据（JSON/Markdown/PDF）
- `importMarkdown(supabase, userId, graphId, markdown)` — 从 Markdown 导入解析并批量创建节点和边

### Requirement: 数据同步服务（syncService）
系统 SHALL 提供 `syncService` 封装多表增量同步逻辑。

- `syncData(supabase, userId, clientTimestamp, clientData)` — 多表增量同步（时间戳比较 + 批量 upsert）

### Requirement: 节点服务（nodesService）
系统 SHALL 提供 `nodesService` 封装节点和边的管理逻辑。

- `createNode(supabase, userId, data)` — 创建节点（含 embedding 生成 + 相似节点复用）
- `updateNode(supabase, userId, nodeId, data)` — 更新节点
- `deleteNode(supabase, userId, nodeId)` — 删除节点
- `batchUpdateNodes(supabase, userId, data)` — 批量更新节点
- `createEdge(supabase, userId, data)` — 创建边
- `deleteEdge(supabase, userId, edgeId)` — 删除边
- `generateSummary(supabase, userId, nodeId)` — AI 生成节点摘要

### Requirement: 子任务服务（subtaskService）
系统 SHALL 提供 `subtaskService` 封装子任务管理逻辑。

- `list(supabase, userId, taskId)` — 查询子任务列表
- `create(supabase, userId, taskId, data)` — 创建子任务（含重复知识点检查）
- `update(supabase, userId, taskId, subtaskId, data)` — 更新子任务（含知识点同步）
- `delete(supabase, userId, subtaskId)` — 删除子任务
- `transition(supabase, userId, subtaskId, targetStatus)` — 子任务状态转换
- `updateMastery(supabase, userId, subtaskId, mastery)` — 更新掌握度（含知识点同步）

### Requirement: 图谱关系服务（graphRelationsService）
系统 SHALL 提供 `graphRelationsService` 封装图谱关系管理逻辑。

- `list(supabase, userId, graphId)` — 查询图谱关系
- `create(supabase, userId, data)` — 创建图谱关系
- `delete(supabase, userId, relationId)` — 删除图谱关系
- `batchCreate(supabase, userId, data)` — 批量创建关系
- `createPrerequisiteGraph(supabase, userId, data)` — 创建前置知识图谱
- `discoverRelations(supabase, userId, graphId)` — AI 发现图谱关系

## MODIFIED Requirements

### Requirement: graphs/crud.ts 路由
原路由中剩余的直接 DB 调用（GET /map、/tags、/domains、/map/analyze、/:id/research-progress、/:id/literature、PUT /:id/view-mode）修改为调用 `graphCrudService` 对应方法。

## REMOVED Requirements

无。所有 API 行为保持不变。
