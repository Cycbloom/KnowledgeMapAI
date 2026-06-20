# 语义布局模式（UMAP）Spec

## Why

当前思维导图使用 d3-force 力导向布局，节点位置由边连接关系和层级电荷决定，语义相似的节点（如"梯度下降"和"反向传播"）可能因拓扑距离远而分散。通过复用数据库中已有的 1024 维 embedding 向量，经 UMAP 降维到 2D，可让语义相近的节点自然聚类，形成"语义地图"，帮助用户发现隐含的知识关联。

## 可行性验证结论

### 已具备的基础设施

1. **Embedding 数据已就绪**：`knowledge_points.embedding` 为 `vector(1024)` 类型，已有完整的生成（embeddingGenerationProcessor）和索引（HNSW/IVFFlat）基础设施
2. **类型定义已存在**：`KnowledgePoint.embedding?: number[]`，`Node` 类型通过交叉类型继承了该字段
3. **布局模式切换机制成熟**：`GraphViewMode` 类型 + `useViewState` hook + `ViewModeSelector` 组件 + `GraphEditor.tsx` 条件渲染
4. **Worker 架构已建立**：`graphCalculator.worker.ts` 已有 Comlink 通信框架，UMAP 计算可放入 Worker 避免阻塞主线程
5. **降级机制已有**：MindMapCanvas 已有 Worker 失败降级到主线程的模式

### 需要解决的问题

1. **前端无法获取 embedding 数据**：`GRAPH_NODES_SELECT` 查询未包含 embedding，`getGraphNodes` 手动映射也排除了 embedding
2. **无现有降维库**：需新增 `umap-js` 依赖
3. **传输体积**：1024 维 float 向量每节点约 4KB，500 节点约 2MB，需按需请求
4. **部分节点无 embedding**：需降级处理（回退到力导向布局位置）
5. **API 层 GraphViewMode 不同步**：API 层只有 3 种模式，前端有 5 种

### 与现有功能的关系

- **GraphMap（图谱地图）**：已有基于 `domain` 属性的领域分组力导向布局（`domainGroups`），但这是**图谱间**的宏观视图，UMAP 布局是**图谱内**的微观视图，两者互补
- **力导向布局**：当前 `createMindMapLayout` 已有 `domainGroups` 语义分组，但仅基于离散的 `domain` 标签，UMAP 基于连续的 embedding 向量，粒度更细
- **语义缩放**：已实现的多层级信息展示，UMAP 布局可与之配合

## What Changes

- **新增 `semantic` 视图模式** — 在 `GraphViewMode` 中新增 `"semantic"` 选项，复用 MindMapCanvas 组件但使用 UMAP 布局替代力导向布局
- **后端 embedding 数据按需返回** — 新增 API 端点或在现有端点添加参数，按需返回节点 embedding 向量
- **前端 UMAP 布局计算** — 安装 `umap-js`，在 Worker 中执行 UMAP 降维，将 1024 维 embedding 映射为 2D 坐标
- **降级处理** — 无 embedding 的节点回退到力导向布局位置，无任何 embedding 时完全回退到力导向布局

## Impact

- Affected specs: 图谱视图模式系统、节点数据获取
- Affected code:
  - `shared/types/graph.ts` — GraphViewMode 类型扩展
  - `src/components/GraphEditor/toolbar/ViewModeSelector.tsx` — 新增 semantic 模式选项
  - `src/components/GraphEditor/toolbar/GraphToolbar.tsx` — 新增 semantic 模式按钮
  - `src/hooks/graphEditor/useViewState.ts` — 支持 semantic 模式持久化
  - `src/pages/GraphEditor.tsx` — semantic 模式条件渲染
  - `src/components/GraphEditor/canvas/MindMapCanvas.tsx` — UMAP 布局模式支持
  - `src/utils/mindmapLayout.ts` — 新增 `createSemanticLayout` 函数
  - `src/workers/graphCalculator.worker.ts` — Worker 中新增 UMAP 计算
  - `src/hooks/common/useWorker.ts` — Worker API 扩展
  - `shared/utils/nodeHelpers.ts` — GRAPH_NODES_SELECT 可选包含 embedding
  - `api/services/graph/graphService.ts` — getGraphNodes 可选返回 embedding
  - `api/routes/graphs/` — 新增或修改端点支持 embedding 返回

## ADDED Requirements

### Requirement: 语义布局视图模式

系统 SHALL 在图谱编辑器中提供 `semantic` 视图模式，使用 UMAP 算法将节点按 embedding 语义相似度在 2D 空间中聚类排列。

#### Scenario: 切换到语义布局模式
- **WHEN** 用户在视图模式选择器中选择"语义地图"
- **THEN** 系统切换到 semantic 视图模式，请求节点 embedding 数据，执行 UMAP 降维计算，将节点按语义相似度排列

#### Scenario: 语义布局计算
- **WHEN** 系统进入 semantic 视图模式且节点有 embedding 数据
- **THEN** 系统在 Web Worker 中执行 UMAP 降维（nComponents=2, nNeighbors=min(15, nodeCount-1), minDist=0.1, nEpochs=200），将 1024 维 embedding 映射为 2D 坐标，坐标归一化到画布可见区域

#### Scenario: 语义聚类可视化
- **WHEN** UMAP 布局计算完成
- **THEN** 语义相似的节点自然聚类，聚类间有适当间距，用户可直观看到知识的语义结构

#### Scenario: 部分节点无 embedding 的降级处理
- **WHEN** 部分节点没有 embedding 数据
- **THEN** 无 embedding 的节点使用力导向布局位置，有 embedding 的节点使用 UMAP 位置，两者在同一画布中共存

#### Scenario: 全部节点无 embedding 的降级处理
- **WHEN** 所有节点都没有 embedding 数据
- **THEN** 系统显示提示"暂无语义数据，请先生成知识点嵌入向量"，并自动回退到力导向布局

#### Scenario: 语义布局计算进度反馈
- **WHEN** UMAP 计算正在进行
- **THEN** 画布显示加载动画和"正在计算语义布局..."提示

#### Scenario: 语义布局与语义缩放兼容
- **WHEN** 用户在 semantic 模式下缩放画布
- **THEN** 语义缩放的多层级信息展示正常工作（概览/集群/节点/详情）

---

### Requirement: Embedding 数据按需获取

系统 SHALL 在切换到语义布局模式时按需请求节点 embedding 数据，避免在常规模式下传输大量向量数据。

#### Scenario: 常规模式不请求 embedding
- **WHEN** 用户使用 mindmap/timeline/tree/planet/quadrant 视图模式
- **THEN** API 请求不包含 embedding 字段，与当前行为一致

#### Scenario: 语义模式请求 embedding
- **WHEN** 用户切换到 semantic 视图模式
- **THEN** 前端发起带 `includeEmbedding=true` 参数的 API 请求，后端返回包含 embedding 的节点数据

#### Scenario: Embedding 数据缓存
- **WHEN** 用户从 semantic 模式切换到其他模式再切回
- **THEN** 已获取的 embedding 数据被缓存（React Query），不重复请求

---

### Requirement: UMAP 布局 Worker 计算

系统 SHALL 在 Web Worker 中执行 UMAP 降维计算，避免阻塞主线程。

#### Scenario: Worker 中执行 UMAP
- **WHEN** 语义布局计算触发
- **THEN** UMAP 算法在 `graphCalculator.worker.ts` 中执行，通过 Comlink 暴露 `calculateSemanticLayout` 方法

#### Scenario: Worker 失败降级
- **WHEN** Worker 不可用或 UMAP 计算失败
- **THEN** 降级到主线程执行 UMAP 计算（节点数 < 200 时），或回退到力导向布局（节点数 >= 200 时）

## MODIFIED Requirements

### Requirement: GraphViewMode 类型（现有）

`GraphViewMode` 从 `"mindmap" | "timeline" | "tree" | "planet" | "quadrant"` 扩展为 `"mindmap" | "timeline" | "tree" | "planet" | "quadrant" | "semantic"`。

### Requirement: 视图模式选择器（现有）

`ViewModeSelector` 组件新增 `semantic` 模式选项，使用 `Map` 图标（lucide-react），标签为"语义地图"，描述为"按语义相似度聚类排列"。

## REMOVED Requirements

无移除项。
