# 缩放语义优化 Spec

## Why

当前缩放语义功能存在两个问题：1) 边关系未随节点层级过滤，集群级别仍显示低层级节点的边导致界面混乱；2) 详情级别的"内容预览"直接截断 `content` 字段前 50 字，既不精准也不优雅，应使用 AI 生成的专用 `summary` 字段（20-30 字）替代。

## What Changes

- **边关系层级过滤** — 在 `useSemanticZoom` 和 `MindMapCanvas` 中实现边关系的层级对应过滤，只显示两端节点均在当前语义级别可见范围内的边
- **知识点 summary 字段** — 在 `knowledge_points` 表新增 `summary` 列（VARCHAR(200)），修改所有 AI 生成知识点的 prompt 和服务代码同步生成 summary，前端详情级别使用 `summary` 替代 content 截断

## Impact

- Affected specs: 缩放语义系统、AI 知识点生成服务、数据库 schema
- Affected code:
  - `src/hooks/graphEditor/useSemanticZoom.ts` — 边过滤逻辑
  - `src/components/GraphEditor/canvas/MindMapCanvas.tsx` — 边过滤应用
  - `src/components/GraphEditor/canvas/MindMapNode.tsx` — 详情级别使用 summary
  - `src/config/graphConfig.ts` — contentPreviewLength 调整
  - `supabase/migrations/03_knowledge_points.sql` — 新增 summary 列
  - `api/services/ai/aiService.ts` — expandKnowledge/getBranchSuggestions 输出增加 summary
  - `api/services/graph/autoGraphService.ts` — processAINodes 写入 summary
  - `api/routes/autoGraph.ts` — 各端点输出增加 summary
  - `api/services/ai/conceptExtractorService.ts` — description 映射为 summary
  - `api/services/ai/backboneNetworkService.ts` — description 映射为 summary
  - `shared/types/graph.ts` — KnowledgePoint 类型增加 summary 字段
  - Prompt 模板（数据库 seed + DEFAULT_PROMPTS）— 输出 schema 增加 summary

## ADDED Requirements

### Requirement: 边关系层级过滤

系统 SHALL 在缩放语义的每个级别中，仅显示两端节点均在当前级别可见范围内的边。

#### Scenario: 概览级别边过滤
- **WHEN** 用户缩放到概览级别（仅 root/core 可见）
- **THEN** 系统仅显示两端节点均为 root 或 core 层级的边，过滤掉任一端为 sub/normal/leaf 的边

#### Scenario: 集群级别边过滤
- **WHEN** 用户缩放到集群级别（root/core/sub 可见）
- **THEN** 系统仅显示两端节点均为 root/core/sub 层级的边，过滤掉任一端为 normal/leaf 的边

#### Scenario: 节点/详情级别边过滤
- **WHEN** 用户缩放到节点或详情级别（所有层级可见）
- **THEN** 系统显示所有边（当前行为不变）

#### Scenario: 边过滤与虚拟化兼容
- **WHEN** 语义缩放边过滤与虚拟化视口裁剪同时生效
- **THEN** 先应用虚拟化裁剪（性能优化），再应用语义层级过滤（语义准确性）

---

### Requirement: 知识点 summary 字段

系统 SHALL 为知识点新增专用的 `summary` 字段，由 AI 在生成知识点时同步创建，用于缩放语义详情级别的概览展示。

#### Scenario: 数据库新增 summary 列
- **WHEN** 数据库迁移执行
- **THEN** `knowledge_points` 表新增 `summary` 列（VARCHAR(200)，可为空），用于存储 20-30 字的简短概览

#### Scenario: AI 生成知识点时同步生成 summary
- **WHEN** AI 服务生成知识点（expandKnowledge、autoGraph 初始化/展开、text_to_graph、document_to_graph、图片转图谱、概念提取、骨干网络生成）
- **THEN** 每个知识点的输出中包含 `summary` 字段（20-30 字的简短概览），与 title 和 content 同步生成

#### Scenario: summary 写入数据库
- **WHEN** AI 生成的知识点写入数据库
- **THEN** `summary` 字段与 `title`、`content` 一起写入 `knowledge_points` 表

#### Scenario: 详情级别使用 summary 展示
- **WHEN** 用户缩放到详情级别且节点有 summary 数据
- **THEN** 系统在节点下方显示 `summary` 内容（而非截断 content 前 50 字），summary 长度控制在 30 字以内

#### Scenario: 无 summary 时的降级显示
- **WHEN** 节点没有 summary 数据
- **THEN** 系统降级为截断 content 前 30 字作为预览（从 50 字缩短为 30 字）

#### Scenario: 已有知识点的 summary 回填
- **WHEN** 数据库迁移执行后，已有知识点没有 summary
- **THEN** 已有节点的 summary 为 NULL，前端降级为 content 截断显示；后续 AI 扩展或编辑时可补充生成

## MODIFIED Requirements

### Requirement: 缩放语义边显示（现有）

现有边过滤从"overview 模式隐藏所有边，其他模式全部显示"修改为"每个级别仅显示两端节点均在可见范围内的边"。

### Requirement: 详情级别内容预览（现有）

现有详情级别使用 `content.slice(0, 50)` 截断显示，修改为优先使用 `summary` 字段，降级时截断长度从 50 字调整为 30 字。

## REMOVED Requirements

无移除项。
