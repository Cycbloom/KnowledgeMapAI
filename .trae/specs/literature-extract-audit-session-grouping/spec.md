# 文献提取 AI 审计 Session 归组 Spec

## Why

当前文献提取（literature_extract）功能的 AI 审计面板存在以下问题：

1. **Session 归组不完整**：文献提取包含两个 AI 子步骤（extractMetadata 提取元数据 + extractConcepts 提取概念），但它们被记录为**独立请求**，没有归入同一个 session 组
2. **外层 session 无实际数据**：`withLiteratureTracking` 包装器虽然创建了 session，但由于内部使用独立的 `withAIPerformanceTracking` 记录，导致外层显示 0 tokens / ¥0.0000
3. **定价信息分散**：用户无法在 session 级别看到完整的成本汇总（当前 ¥0.0088 + ¥0.0040 = ¥0.0128 被分散显示）
4. **Session 名称不够友好**：前端 `getSessionName()` 函数没有为 `literature_extract` 操作提供友好的中文命名（如"文献提取"）

## What Changes

- **修改 `withAIPerformanceTracking` 工具函数**：新增 `sessionId` 可选参数，支持将子请求归入指定 session
- **修改 `literatureMetadataService.extractMetadata()`**：接收并传递 `sessionId` 参数
- **修改 `conceptExtractorService.extractConcepts()`**：接收并传递 `sessionId` 参数
- **修改 `api/routes/literature.ts` 的 `/extract` 路由**：将 `sessionId` 传递给 `extractMetadata` 和 `extractConcepts`
- **修改 `withLiteratureTracking`**：移除外层的重复记录（避免 0 token 的空记录），或改为仅做 session 级别的聚合统计
- **修改前端 `PerformanceTab.tsx` 的 `getSessionName()`**：增加 `literature_extract` / `extractMetadata` / `extractConcepts` 的友好命名和归组识别

## Impact

- Affected code:
  - `api/services/ai/utils/performanceTracker.ts` — `withAIPerformanceTracking` 增加 sessionId 参数
  - `api/services/ai/literatureMetadataService.ts` — `extractMetadata` 传递 sessionId
  - `api/services/ai/conceptExtractorService.ts` — `extractConcepts` 及其内部 AI 调用传递 sessionId
  - `api/routes/literature.ts` — `/extract` 路由中统一传递 sessionId
  - `src/components/Console/PerformanceTab.tsx` — `getSessionName()` 增加文献提取归组逻辑

## ADDED Requirements

### Requirement: withAIPerformanceTracking 支持 Session 归组

`withAIPerformanceTracking` 工具函数 SHALL 支持可选的 `sessionId` 参数。

#### 场景 1: 传入 sessionId 时归组

**WHEN** 调用方传入 `sessionId`

**THEN** `performanceMonitor.recordLog()` SHALL 将该条日志的 `sessionId` 设置为传入值

**AND** 该日志在前端审计面板中 SHALL 被归入对应 的 session 组

### Requirement: 文献提取子步骤归入同一 Session

文献提取流程中的所有 AI 调用 SHALL 使用相同的 `sessionId`。

#### 场景 1: 完整的文献提取流程

**WHEN** 用户执行文献提取操作（`POST /literature/extract`）

**AND** 开启了自动检测元数据选项（`autoDetectMetadata: true`）

**THEN** 系统 SHALL 生成一个 `sessionId`

**AND** 以下 AI 调用 SHALL 都使用该 `sessionId` 记录：
- `extractMetadata` — 提取文献元数据
- `extractConcepts` — 提取概念和关系
- （如有）`classifyConcept` — 概念分类
- （如有）`locateBackboneModule` — 骨干模块定位

**AND** 前端审计面板 SHALL 将以上所有请求展示在**同一个 session 组**下，组名显示为"文献提取"

**AND** session 组的汇总信息 SHALL 正确累加所有子请求的 tokens、费用、时长

#### 场景 2: 仅提取概念（无元数据检测）

**WHEN** 用户执行文献提取但未开启自动检测元数据

**THEN** `extractConcepts` 及其内部调用 SHALL 仍使用 `sessionId` 记录

**AND** 外层 `withLiteratureTracking` 不应再产生一条 0 token 的重复记录

### Requirement: 前端 Session 名称友好化

前端 `getSessionName()` 函数 SHALL 为文献提取相关的操作组合提供友好的中文名称。

#### 场景 1: 识别文献提取 session

**WHEN** 一个 session 包含 `literature_extract`、`extractMetadata`、`extractConcepts` 中的任意操作

**THEN** session 组名称 SHALL 显示为"文献提取"

**AND** 各子操作的标签 SHALL 使用国际化翻译：
- `extractMetadata` → "提取元数据"
- `extractConcepts` → "提取概念"

### Requirement: Session 级别定价汇总正确

Session 组的汇总统计 SHALL 反映所有子请求的真实数据。

**WHEN** 展开一个文献提取 session 组

**THEN** 汇总行 SHALL 显示：
- 总 tokens = 所有子请求 tokens 之和
- 总费用 = 所有子请求费用之和（如 ¥0.0128）
- 总时长 = 所有子请求时长之和
- 成功数/请求数 = 实际子请求数

## MODIFIED Requirements

### Requirement: withLiteratureTracking 行为调整

当前的 `withLiteratureTracking` 函数会记录一条额外的日志（operation 为 `literature_extract`），但由于它包装的内部函数不返回 usage 信息，这条日志始终是 0 token。

**修改后**：`withLiteratureTracking` SHALL 不再记录自己的日志，而是仅作为 session 管理器，确保所有内部调用的 sessionId 一致。如果需要保留 session 概览记录，应从子请求中聚合数据。
