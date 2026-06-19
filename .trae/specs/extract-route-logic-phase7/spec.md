# 路由层业务逻辑下沉（最终轮）Spec

## Why
前六轮重构已将路由层 DB 调用从 367 次降至 49 次（降幅 87%）。本轮是最终轮，目标是**清零所有路由层直接 DB 调用**，完成路由→服务分离的架构目标。

## What Changes
- **新增** `api/services/scheduler/taskExecutionService.ts` — 任务执行记录管理（从 `scheduler/executions.ts` 提取，4 次）
- **新增** `api/services/story/appearanceService.ts` — 角色出场记录管理（从 `story/appearances.ts` 提取，4 次）
- **新增** `api/services/story/sceneService.ts` — 场景详情管理（从 `story/scenes.ts` 提取，4 次）
- **新增** `api/services/scheduler/taskSettingService.ts` — 任务设置管理（从 `scheduler/settings.ts` 提取，4 次）
- **新增** `api/services/core/authRouteService.ts` — 注册/登录中的用户表操作（从 `auth.ts` 提取，3 次）
- **新增** `api/services/story/relationshipService.ts` — 角色关系管理（从 `story/relationships.ts` 提取，3 次）
- **新增** `api/services/scheduler/taskStatService.ts` — 任务统计/热力图（从 `scheduler/analytics.ts` 提取，3 次）
- **新增** `api/services/study/studyRouteService.ts` — 学习路由剩余操作（从 `study.ts` 提取，3 次）
- **新增** `api/services/graph/templateRouteService.ts` — 模板应用创建节点（从 `templates.ts` 提取，3 次）
- **新增** `api/services/graph/analysisRouteService.ts` — 领域分析（从 `graphs/analysis.ts` 提取，2 次）
- **新增** `api/services/agent/agentRouteService.ts` — Agent 推荐应用（从 `agent.ts` 提取，2 次）
- **新增** `api/services/ai/aiConfigRouteService.ts` — AI 配置数据库测试（从 `ai/config.ts` 提取，2 次）
- **新增** `api/services/common/systemMonitorService.ts` — 系统监控数据库检测（从 `systemMonitor.ts` 提取，2 次）
- **扩展** `api/services/graph/autoGraphService.ts` 或新增 — 自动图谱嵌入状态查询（从 `autoGraph.ts` 提取，2 次）
- **微调** 剩余 8 个单次调用文件（conceptAggregation, learningPaths, health, ai/cards, aiActions, scheduler/recommendations, statistics, graphNodes）

## Impact
- Affected specs: 无破坏性变更，所有 API 接口保持不变
- Affected code: 22 个路由文件

## ADDED Requirements

### Requirement: taskExecutionService
- `listByTask(supabase, userId, taskId)` — 验证任务归属 + 查询执行记录
- `list(supabase, userId, options)` — 分页查询执行记录（含任务 join）
- `get(supabase, userId, executionId)` — 获取单条执行记录（含任务 join）

### Requirement: appearanceService
- `create(supabase, graphId, data)` — 创建出场记录
- `delete(supabase, graphId, id)` — 删除出场记录
- `getStats(supabase, graphId, characterId)` — 获取角色出场统计（含关系和出场并行查询）

### Requirement: sceneService
- `get(supabase, graphId, structureId)` — 获取场景详情 + 出场记录
- `create(supabase, graphId, data)` — 创建场景详情
- `update(supabase, graphId, id, data)` — 更新场景详情

### Requirement: taskSettingService
- `get(supabase, userId)` — 获取设置（不存在时自动创建）
- `update(supabase, userId, data)` — 更新设置
- `updateNotes(supabase, userId, taskId, notes)` — 更新任务笔记

### Requirement: authRouteService
- `createUserProfile(admin, userId, email, name)` — 创建用户 profile
- `ensureUserProfile(admin, userId, email, name)` — 确保 profile 存在（登录时修复）

### Requirement: relationshipService
- `list(supabase, graphId)` — 查询角色关系列表（含 source/target join）
- `create(supabase, graphId, data)` — 创建角色关系
- `delete(supabase, graphId, id)` — 删除角色关系

### Requirement: taskStatService
- `getStats(supabase, userId, period)` — 获取任务统计
- `getHeatmap(supabase, userId, year?, month?)` — 获取热力图数据

### Requirement: studyRouteService
- `createCardWithGraphNode(supabase, userId, data)` — 创建卡片（含 graphNode 查询）
- `createCardsBatchWithGraphNodes(supabase, userId, cards)` — 批量创建卡片（含 graphNode 查询）
- `getProgress(supabase, userId, graphId)` — 获取学习进度

### Requirement: templateRouteService
- `createFromTemplate(supabase, userId, template, graphId)` — 从模板创建知识点+图谱节点+边

### Requirement: analysisRouteService
- `analyzeDomain(supabase, userId, domain, count, contextDomainId?)` — 领域分析（含图谱查询 + AI 调用）

### Requirement: agentRouteService
- `applyRecommendations(supabase, userId, recommendations, graphIndex?)` — 应用推荐关系

### Requirement: aiConfigRouteService
- `testDatabaseConnection(admin)` — 测试数据库连接
- `testDatabaseConnectionWithConfig(admin, config)` — 测试新配置的数据库连接

### Requirement: systemMonitorService
- `checkDatabaseHealth(admin)` — 检查数据库健康状态

### Requirement: autoGraph 嵌入状态
- `getEmbeddingStatus(supabase)` — 获取嵌入状态（查询 null embedding 数量）

## MODIFIED Requirements
无额外修改。

## REMOVED Requirements
无。所有 API 行为保持不变。
