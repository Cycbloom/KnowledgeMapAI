# 图谱概念保存去重 Spec

## Why
用户在进行专题研究的文献提取时，将提取出的概念保存到知识图谱时，系统没有对相同或相似的概念进行去重合并。用户多次点击"保存到图谱"（无论是重复保存同一次提取结果，还是多次提取同一文献后分别保存），都会导致相同概念在图谱中产生多个重复节点，影响图谱质量和可用性。

## What Changes
- **修改 `autoGraphService.processAINodes()`**：在创建知识要点和图节点之前，增加与图谱中已有节点的去重检查逻辑
- **修改 `autoGraphService.createKnowledgePointsBatch()`**：在批量插入知识要点之前，检查是否已存在标题相同或嵌入向量相似的知识要点
- **修改 `graphNodeService.addToGraph()`**：在插入图节点前，检查同一图谱中是否已存在相同知识要点的节点（防止重复插入）
- **保证 `/auto-graph/save-nodes` 路由**：在保存模板生成节点时也执行去重逻辑
- **保证 `/literature/apply` 路由**：优化现有的去重流程，确保稳定工作
- **优化 `normalizeTitle`**：增强标题规范化逻辑，处理更多边缘情况（标点符号、Unicode 规范化等）
- **可选：降低相似度阈值**：可配置环境变量，默认 0.85 可调整为更宽松的值

## Impact
- Affected specs: 图谱节点管理、文献概念提取、自动图谱生成
- Affected code:
  - `api/services/graph/autoGraphService.ts` — 核心节点创建流程
  - `api/services/graph/graphNodeService.ts` — 图节点添加
  - `api/services/graph/conceptAggregationService.ts` — 概念聚合/去重服务
  - `api/routes/literature.ts` — 文献应用路由
  - `api/routes/autoGraph.ts` — 自动图谱路由

## ADDED Requirements

### Requirement: 图节点创建时自动去重
系统 SHALL 在创建新的图节点（graph_node）之前，先检查目标图谱中是否已存在标题完全相同或嵌入向量高度相似的知识要点节点，若存在则合并而非创建新节点。

#### Scenario: 相同标题去重
- **WHEN** 用户保存一个标题为"机器学习"的概念到图谱
- **AND** 该图谱中已存在标题为"机器学习"的节点
- **THEN** 系统不创建新节点，而是将新概念的来源信息合并到已有节点的 sources 中
- **AND** 返回已有节点的 ID 作为映射结果

#### Scenario: 相似概念向量去重
- **WHEN** 用户保存一个标题为"深度神经网络"的概念到图谱
- **AND** 该图谱中已存在嵌入向量相似度 >= 阈值（默认 0.85）的"深度学习网络"节点
- **THEN** 系统不创建新节点，而是将新概念的来源信息合并到已有节点
- **AND** 系统记录合并日志

#### Scenario: 批量内去重
- **WHEN** 用户一次保存 5 个概念，其中 2 个是"Transformer 架构"和"Transformer 模型"
- **AND** 这两个概念的嵌入向量相似度 >= 阈值
- **THEN** 系统在保存前先将批量内的相似概念合并，只创建一个节点

#### Scenario: 保存已存在的模板节点
- **WHEN** 用户通过 `/auto-graph/save-nodes` 保存模板生成的节点
- **AND** 图谱中已存在部分相同标题的节点
- **THEN** 已存在的节点被合并升级（来源合并+等级提升），而非重复创建

### Requirement: 标题规范化增强
系统 SHALL 在比较概念标题时，使用增强的规范化算法处理各种边缘情况。

#### Scenario: 标点符号差异
- **WHEN** 两个概念标题为"机器学习。"和"机器学习"
- **THEN** 规范化后的标题相同，系统判定为同一概念

#### Scenario: Unicode 规范化
- **WHEN** 两个概念标题使用了不同的 Unicode 表示形式（如全角/半角）
- **THEN** 系统统一规范化后比较，判定为同一概念

#### Scenario: 大小写差异
- **WHEN** 英文概念标题为"Machine Learning"和"machine learning"
- **THEN** 系统忽略大小写差异，判定为同一概念

### Requirement: 节点重复插入防护
`graphNodeService.addToGraph()` SHALL 在插入前检查同一图谱中是否已存在相同的 `(graph_id, knowledge_point_id)` 组合。如果存在且未删除，则直接返回已有节点而非抛错。

#### Scenario: 重复插入同一知识要点
- **WHEN** 系统尝试将同一个 knowledge_point 添加到同一图谱两次
- **THEN** 第二次调用返回已存在的 graph_node 记录，而非创建重复节点
- **AND** 记录 warning 级别日志

## MODIFIED Requirements

### Requirement: 文献概念应用流程去重优化
原流程在 `/literature/apply` 中有去重逻辑，但存在以下问题：
1. 嵌入向量可能未及时生成（异步任务），导致基于向量的去重失效
2. 去重仅在路由层执行，其他入口（save-nodes）不执行去重

修改后：将去重逻辑下沉到 `autoGraphService.processAINodes()` 公共方法中，确保所有入口都能享受去重保护。

#### 设计原则
- 去重逻辑统一在 `autoGraphService` 层实现，不依赖调用方自行处理
- 保留 `/literature/apply` 路由中现有的高级去重（如模糊标题匹配），作为第一道防线
- `processAINodes` 中的去重作为最后一道防线，确保不会创建重复节点