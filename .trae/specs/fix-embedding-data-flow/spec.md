# 修复 Embedding 数据流断裂问题 Spec

## Why

语义聚类视图始终显示"缺少语义向量数据"提示并回退到力导向布局，即使数据库中已存在 embedding 数据。根本原因是后端 `buildNodeFromGraphNode` 缺少 pgvector 字符串解析逻辑，导致 Supabase 返回的 embedding 字符串无法被前端识别为数组。

## 问题根因分析

### 数据流断裂点

```
数据库 knowledge_points.embedding (pgvector vector(1024) 类型)
  ↓ Supabase 查询返回 → 字符串格式 "[0.1,0.2,...]"
  ↓ api/utils/nodeHelpers.ts buildNodeFromGraphNode() → 直接赋值 kp.embedding（字符串）
  ↓ graphService.ts → embedding: node.embedding（仍是字符串）
  ↓ HTTP JSON 响应 → embedding 为字符串
  ↓ 前端 GraphEditor.tsx → Array.isArray(node.embedding) === false → 跳过该节点
  ↓ embeddingsMap 为空 → semanticLayoutUnavailable = true → 显示回退提示
```

### 两个 buildNodeFromGraphNode 的差异

| 文件 | embedding 处理 | 使用者 |
|------|---------------|--------|
| `shared/utils/nodeHelpers.ts:97` | `typeof kp.embedding === 'string' ? JSON.parse(kp.embedding) : kp.embedding` | 前端代码 |
| `api/utils/nodeHelpers.ts:51` | `kp.embedding`（直接赋值） | **后端 graphService.ts** |

后端 `graphService.ts:4` 导入的是 `api/utils/nodeHelpers.ts`，该版本不做字符串解析。

### 为什么 pgvector 返回字符串

Supabase 的 pgvector 扩展在查询 `vector(1024)` 类型字段时，返回的是字符串格式（如 `"[0.1,0.2,0.3,...]"`），而非 JavaScript 数组。这是 pgvector 的已知行为。

## What Changes

- 修复 `api/utils/nodeHelpers.ts` 中 `buildNodeFromGraphNode` 的 embedding 字段解析，与 `shared/utils/nodeHelpers.ts` 保持一致
- 优化前端 `GraphEditor.tsx` 中 embeddingsMap 构建逻辑，增加对字符串格式 embedding 的容错处理
- 改进语义布局不可用提示文案，更准确地说明问题

## Impact

- Affected specs: `semantic-umap-layout`, `fix-semantic-layout-prereview`
- Affected code:
  - `api/utils/nodeHelpers.ts` — 修复 embedding 解析
  - `src/pages/GraphEditor.tsx` — 增加 embeddingsMap 容错

## ADDED Requirements

### Requirement: 后端 Embedding 字符串解析

后端 `buildNodeFromGraphNode` SHALL 对 pgvector 返回的 embedding 字符串执行 `JSON.parse` 解析，与 shared 版本保持一致。

#### Scenario: pgvector 返回字符串格式 embedding
- **WHEN** Supabase 查询 knowledge_points 返回 embedding 为字符串 `"[0.1,0.2,...]"`
- **THEN** `buildNodeFromGraphNode` 将其解析为 `number[]` 数组
- **AND** API 响应中 embedding 字段为 JSON 数组

#### Scenario: embedding 已经是数组
- **WHEN** embedding 已经是 `number[]` 类型
- **THEN** 直接使用，不做额外解析

#### Scenario: embedding 为 null 或 undefined
- **WHEN** embedding 为 null 或 undefined
- **THEN** 保持 null/undefined，不报错

### Requirement: 前端 EmbeddingsMap 容错

前端 `embeddingsMap` 构建 SHALL 对字符串格式的 embedding 做容错处理，避免因后端未修复时仍然丢失数据。

#### Scenario: 后端返回字符串格式 embedding
- **WHEN** API 返回的 node.embedding 为字符串 `"[0.1,0.2,...]"`
- **THEN** embeddingsMap 构建时尝试 JSON.parse 解析
- **AND** 解析成功后正常加入 map

## MODIFIED Requirements

### Requirement: 后端 buildNodeFromGraphNode embedding 处理

原：`embedding: kp.embedding`（直接赋值）
改为：`embedding: typeof kp.embedding === 'string' ? JSON.parse(kp.embedding) : kp.embedding`
