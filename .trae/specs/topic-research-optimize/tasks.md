# Tasks

- [x] Task 1: 修复骨架模块 Preset 生效 — 创建 topic_research 图谱时使用正确 Preset 的模块集合
  - [x] 1.1 修改 `graphService.createGraph()` 接受 `presetId` 参数
  - [x] 1.2 从 `backboneModulePresets.ts` 的 `PRESET_MAP` 中读取模块配置
  - [x] 1.3 将 Preset 的 `modules` 字段写入 `graph_backbone_modules` 表（替换现有固定 6 模块逻辑）
  - [x] 1.4 创建图谱路由中解析传递 presetId 参数
  - [x] 1.5 验证：创建 `experimental_science` Preset 图谱，确认模块为实验设计等自定义模块

- [x] Task 2: 批量嵌入向量生成优化 — 减少文献提取/应用中的 AI API 调用次数
  - [x] 2.1 修改 `literature.ts` 的 `/apply` 路由中逐个 `generateEmbedding` 调用改为批量调用
  - [x] 2.2 `generateEmbeddingsBatch` 内部已处理失败回退（返回 null 即跳过）

- [x] Task 3: 跨图谱概念去重 — `/extract` 结果中包含用户其他图谱的相似概念信息
  - [x] 3.1 在 `conceptAggregationService` 中新增 `findCrossGraphSimilar` 方法
  - [x] 3.2 修改 `literature.ts` 的 `/extract` 路由，附加跨图谱相似概念
  - [x] 3.3 前端 `LiteratureExtractPanel` 中展示跨图谱相似概念标签
  - [x] 3.4 验证：两个图谱中导入相同论文，第二个看到去重提示

- [x] Task 4: 研究进度总览 API 与面板
  - [x] 4.1 新增 `GET /api/graphs/:id/research-progress` 路由端点
  - [x] 4.2 创建 `ResearchProgressPanel` 前端组件
  - [x] 4.3 在 GraphEditor 页面中为 topic_research 图谱集成进度面板入口
  - [x] 4.4 验证：添加概念后面板显示正确的进度数据

- [x] Task 5: 模块需求分析 API
  - [x] 5.1 新增 `GET /api/graphs/:id/analysis/module-gaps` 路由
  - [x] 5.2 新增 `GET /api/graphs/:id/analysis/module-overlap` 路由

- [x] Task 6: 文献库面板
  - [x] 6.1 新增 `GET /api/graphs/:id/literature` 路由
  - [x] 6.2 创建 `LiteratureLibraryPanel` 前端组件
  - [x] 6.3 在 GraphEditor 页面中为 topic_research 图谱集成文献库入口
  - [x] 6.4 验证：导入多篇论文后文献库正确显示

# Task Dependencies
- Task 3 (跨图谱去重) 依赖于 Task 2 (批量嵌入) 产生的嵌入向量
- Task 4 (研究进度) 和 Task 6 (文献库) 可并行开发，均依赖 Task 1 的模块数据
- Task 5 独立，无依赖