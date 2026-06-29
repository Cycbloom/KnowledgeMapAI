# Round 10: 遗留问题清理 Spec

## Why

Round 8/9 完成后留下若干遗留问题。本 spec 处理其中必要且工作量适中的部分：违反项目规则的非空断言、i18n 高频组件迁移、超大路由文件拆分。工作量巨大的遗留项（剩余 service 拆分、剩余 i18n 迁移）和已评估为不必要的遗留项（Redis 后端、SSE 跨实例广播、SQLite/PostgreSQL schema 同步）暂缓。

## What Changes

### 本轮处理

| 遗留问题 | 来源 | 处理方式 |
|----------|------|----------|
| AgentService.ts `finalSession!` 非空断言 | Round 9 | 修复为空值检查（L670） |
| P2-17 i18n 高频组件迁移 | Round 9 | 迁移 SchedulerStats.tsx（15 处）+ CombinedViewPage.tsx（11 处） |
| P2-02 超大路由拆分 | Round 9 | 拆分 autoGraph.ts（17588 字符，最大剩余） |

### 暂缓（工作量巨大或评估为不必要）

| 遗留问题 | 原因 |
|----------|------|
| P2-17 剩余 ~411 处硬编码 | 工作量巨大，建议后续轮次按高频组件分批 |
| P2-01 剩余 5 个 service 文件 + AgentService 高风险模块 | 工作量巨大，高风险模块需仔细设计 |
| P2-02 剩余 7 个路由文件 | 工作量中等，后续轮次处理 |
| Redis 后端实现 | 桌面应用单实例不暴露问题，Web 多实例部署时再做 |
| SSE 跨实例广播 | 同上 |
| P3-12 SQLite/PostgreSQL schema 同步 | 已评估为不必要 |

## Impact

- **Affected specs**: round9-i18n-large-file-split（遗留问题清单）
- **Affected code**:
  - `api/services/agent/AgentService.ts`（修复 `finalSession!`）
  - `src/pages/SchedulerStats.tsx` + `src/i18n/locales/zh-CN.json` + `src/i18n/locales/en-US.json`
  - `src/pages/CombinedViewPage.tsx` + i18n 资源
  - `api/routes/autoGraph.ts`（删除）+ 新建 `api/routes/autoGraph/` 目录

## ADDED Requirements

### Requirement: 修复 AgentService 非空断言

系统 SHALL 移除 AgentService.ts 中的 `finalSession!` 非空断言，改为显式空值检查。

#### Scenario: finalizeSession 在 session 更新后不存在
- **WHEN** `sessionManager.get(sessionId)` 在 update 后返回 null
- **THEN** 抛出 `Error("Session not found after update")`
- **AND** 不使用非空断言 `!`

### Requirement: i18n 高频组件迁移

系统 SHALL 将 SchedulerStats.tsx 与 CombinedViewPage.tsx 中的硬编码中文迁移到 i18n 资源文件。

#### Scenario: 迁移后行为一致
- **WHEN** 用户查看 SchedulerStats / CombinedViewPage 页面
- **THEN** 中文环境显示与迁移前一致
- **AND** 英文环境显示对应翻译

### Requirement: autoGraph 路由拆分

系统 SHALL 将 autoGraph.ts 拆分为 autoGraph/ 目录，保持路由路径与行为不变。

#### Scenario: 拆分后路由等价
- **WHEN** 客户端请求 /api/auto-graph 任一端点
- **THEN** 响应与拆分前完全等价

## MODIFIED Requirements

无
