# Round 11: 遗留问题清理续 Spec

## Why

Round 10 完成后剩余约 343 处 i18n 硬编码、7 个超大路由文件、5 个超大 service 文件。本 spec 继续按高频组件迁移 i18n、拆分最大剩余路由，并新增拆分 1 个较小路由作为快速胜利。

## What Changes

### 本轮处理

| 任务 | 文件 | 工作量 |
|------|------|--------|
| P2-17 i18n 迁移 | GraphStyleSettings.tsx（19 处）+ TextToGraphModal.tsx（12 处） | 中 |
| P2-02 路由拆分 | learningPaths.ts（15356 字符，最大剩余） | 中 |
| P2-02 路由拆分 | ai/content.ts（10436 字符，快速胜利） | 小 |

### 暂缓（工作量巨大或评估为不必要）

| 遗留问题 | 原因 |
|----------|------|
| P2-17 剩余约 321 处硬编码 | 工作量巨大，后续轮次分批 |
| P2-01 剩余 5 个 service 文件 + AgentService 高风险模块 | 工作量巨大 |
| P2-02 剩余 5 个路由文件 | 后续轮次处理 |
| Redis 后端 / SSE 跨实例广播 | 桌面应用不必要 |
| P3-12 schema 同步 | 已评估不必要 |

## Impact

- **Affected specs**: round10-legacy-cleanup（遗留问题清单）
- **Affected code**:
  - `src/components/GraphEditor/shared/GraphStyleSettings.tsx` + i18n 资源
  - `src/components/GraphEditor/modals/TextToGraphModal.tsx` + i18n 资源
  - `api/routes/learningPaths.ts`（删除）+ 新建 `api/routes/learningPaths/` 目录
  - `api/routes/ai/content.ts`（删除）+ 新建 `api/routes/ai/content/` 目录

## ADDED Requirements

### Requirement: i18n 高频组件迁移

系统 SHALL 将 GraphStyleSettings.tsx 与 TextToGraphModal.tsx 中的硬编码中文迁移到 i18n 资源文件。

#### Scenario: 迁移后行为一致
- **WHEN** 用户查看 GraphStyleSettings / TextToGraphModal
- **THEN** 中文环境显示与迁移前一致
- **AND** 英文环境显示对应翻译

### Requirement: learningPaths 路由拆分

系统 SHALL 将 learningPaths.ts 拆分为 learningPaths/ 目录，保持路由路径与行为不变。

#### Scenario: 拆分后路由等价
- **WHEN** 客户端请求 /api/learning-paths 任一端点
- **THEN** 响应与拆分前完全等价

### Requirement: ai/content 路由拆分

系统 SHALL 将 ai/content.ts 拆分为 ai/content/ 目录，保持路由路径与行为不变。

#### Scenario: 拆分后路由等价
- **WHEN** 客户端请求 /api/ai/content 任一端点
- **THEN** 响应与拆分前完全等价
