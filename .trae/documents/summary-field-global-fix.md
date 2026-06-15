# `summary` 字段全链路修复计划

## 问题总结

`summary` 字段在 AI 自动生成链路中已完整覆盖，但在**手动操作链路**（创建/更新节点、知识点 CRUD、批量更新、文献应用、数据导入）中全面缺失。共 27 处需要修复，分为 3 个优先级。

## 修复清单

### P0：核心数据读写链路（24 处）

#### 1. 共享类型定义
- **`shared/types/api.ts`**：`CreateNodeData`（L32-47）和 `UpdateNodeData`（L49-57）添加 `summary?: string`

#### 2. 后端 Zod 校验
- **`api/schemas/index.ts`**：
  - `createNodeSchema`（L50-71）添加 `summary: z.string().max(200).optional()`
  - `batchUpdateNodesSchema`（L462-478）节点对象添加 `summary: z.string().max(200).optional()`
  - `importDataSchema`（L280-304）节点对象添加 `summary: z.string().max(200).optional()`

#### 3. 后端知识点路由
- **`api/routes/knowledgePoints.ts`**：
  - `createKnowledgePointSchema`（L20-31）添加 `summary: z.string().max(200).optional()`
  - `updateKnowledgePointSchema`（L33-44）添加 `summary: z.string().max(200).optional()`
  - `submitPublicSchema.suggested_changes`（L54-65）添加 `summary: z.string().max(200).optional()`
  - POST `/knowledge-points` 处理（L145-168）从 req.body 解构 summary 并传入
  - PUT `/knowledge-points/:id` 处理（L170-200）将 summary 加入更新对象

#### 4. 后端节点路由
- **`api/routes/nodes.ts`**：
  - POST `/nodes`（L94-101）创建时传入 `summary`
  - PUT `/nodes/:id`（L279-286）更新时在 kpUpdates 中添加 summary
  - PUT `/nodes/:id`（L219-239）查找节点时 select 添加 summary
  - PUT `/nodes/:id`（L343-371）更新后重新查询 select 添加 summary
  - GET `/nodes/:id`（L168-191）select 添加 summary
  - `/nodes/batch-update`（L742-747）kpUpdates 添加 summary

#### 5. 后端知识点服务
- **`api/services/graph/knowledgePointService.ts`**：
  - `CreateKnowledgePointData`（L52-60）添加 `summary?: string`
  - `UpdateKnowledgePointData`（L62-68）添加 `summary?: string`
  - `create()` 方法（L94-101）insert 添加 `summary: data.summary`
  - `update()` 方法（L145-170）更新对象添加 summary
  - `listPublic()` select（L327）添加 summary
  - `listPending()` select（L439）添加 summary

#### 6. 后端工具函数
- **`api/utils/nodeHelpers.ts`**：`buildNodeFromGraphNode`（L32-51）添加 `summary: kp.summary || ""`

#### 7. 文献应用路由
- **`api/routes/literature.ts`**：`aiNodesData` 构建（L1035-1056）从 concept 中取 summary 传入

#### 8. 前端 API 层
- **`src/services/api/knowledgePoints.ts`**：
  - `create` 方法（L29-38）参数添加 `summary?: string`
  - `update` 方法（L40-49）参数添加 `summary?: string`

#### 9. 移动端 API 层
- **`src/services/mobile/nodes.ts`**：`update` 方法（L99-111）knowledge_points 更新添加 summary

### P1：版本历史支持（3 处）

- **`supabase/migrations/03_knowledge_points.sql`**：`knowledge_point_versions` 表（L33-47）添加 `summary VARCHAR(200)` 列
- **`shared/types/graph.ts`**：`KnowledgePointVersion` 接口（L317-328）添加 `summary?: string`
- **`api/services/graph/knowledgePointVersionService.ts`**：版本创建/恢复时处理 summary

## 验证步骤

1. `npm run check` 类型检查通过
2. `npm run lint` 代码规范通过
3. 验证 autograph 创建图谱后 summary 有值
4. 验证手动创建/编辑节点时 summary 可写入和更新
