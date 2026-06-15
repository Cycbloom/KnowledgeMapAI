# Tasks

- [x] Task 1: 边关系层级过滤
  - [x] SubTask 1.1: 在 `useSemanticZoom.ts` 中新增边过滤逻辑：根据当前语义级别的 `visibleLevels`，计算哪些边两端节点均在可见范围内，返回 `semanticVisibleEdgeIds: Set<string>`
  - [x] SubTask 1.2: 在 `MindMapCanvas.tsx` 中替换原有简单的 `shouldShowEdges` 布尔判断，改用 `semanticVisibleEdgeIds` 过滤边列表
  - [x] SubTask 1.3: 验证概览/集群/节点/详情四个级别的边过滤行为正确

- [x] Task 2: 知识点 summary 字段 — 数据库与类型
  - [x] SubTask 2.1: 在 `supabase/migrations/03_knowledge_points.sql` 中新增 `summary VARCHAR(200)` 列
  - [x] SubTask 2.2: 在 `shared/types/graph.ts` 的 `KnowledgePoint` 接口中新增 `summary?: string` 字段

- [x] Task 3: 知识点 summary 字段 — AI 服务端修改
  - [x] SubTask 3.1: 修改 `api/services/ai/aiService.ts` 中 `expandKnowledge` 方法的输出 schema 和 prompt，增加 `summary` 字段（20-30 字概览）
  - [x] SubTask 3.2: 修改 `api/services/ai/aiService.ts` 中 `getBranchSuggestions` 方法的输出 schema，增加 `summary` 字段
  - [x] SubTask 3.3: 修改 `api/routes/autoGraph.ts` 中初始化图谱（`auto_graph_init`）和展开节点（`auto_graph_expand`）的 prompt 和输出 schema，增加 `summary` 字段
  - [x] SubTask 3.4: 修改 `api/routes/autoGraph.ts` 中 `text_to_graph` 和 `document_to_graph` 的 prompt 和输出 schema，增加 `summary` 字段
  - [x] SubTask 3.5: 修改 `api/services/ai/aiService.ts` 中 `generateGraphFromImage` 的硬编码 prompt，增加 `summary` 字段
  - [x] SubTask 3.6: 修改 `api/services/ai/conceptExtractorService.ts`，将 `description` 映射为 `summary` 写入
  - [x] SubTask 3.7: 修改 `api/services/ai/backboneNetworkService.ts`，将 `description` 映射为 `summary` 写入
  - [x] SubTask 3.8: 修改 `api/services/graph/autoGraphService.ts` 中 `processAINodes` 方法，写入 `summary` 字段到数据库
  - [x] SubTask 3.9: 更新 `api/services/ai/promptService.ts` 中 `DEFAULT_PROMPTS` 和 `OUTPUT_SCHEMAS` 的相关 prompt code，增加 `summary` 输出字段
  - [x] SubTask 3.10: 更新 `supabase/migrations/53_seed_prompt_templates.sql` 中对应 prompt 模板的 output_schema，增加 `summary` 字段

- [x] Task 4: 知识点 summary 字段 — 前端展示
  - [x] SubTask 4.1: 修改 `src/config/graphConfig.ts` 中 `SEMANTIC_ZOOM_CONFIG.detailInfo.contentPreviewLength` 从 50 调整为 30
  - [x] SubTask 4.2: 修改 `MindMapNode.tsx` 中详情级别的内容预览逻辑：优先使用 `node.summary`，无 summary 时降级截断 `node.content` 前 30 字
  - [x] SubTask 4.3: 修改 `useSemanticZoom.ts` 中 `NodeDisplayStrategy` 的 `contentPreviewLength` 从 50 调整为 30

- [x] Task 5: 集成验证
  - [x] SubTask 5.1: 运行 `npm run check` 确保类型安全
  - [x] SubTask 5.2: 运行 `npm run lint` 确保代码规范

# Task Dependencies

- [Task 2] 无依赖，可先执行
- [Task 3] depends on [Task 2] — AI 服务端修改依赖类型定义
- [Task 4] depends on [Task 2] — 前端展示依赖类型定义
- [Task 1] 无依赖，可与 Task 2 并行
- [Task 5] depends on [Task 1, Task 2, Task 3, Task 4]
