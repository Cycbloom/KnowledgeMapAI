# 统一学习路径路由命名 Spec

## Why
`learningPath.ts` 和 `learningPaths.ts` 两个路由文件同时存在，挂载到不同路径（`/api/learning-path` vs `/api/learning-paths`），且 `/generate` 端点在两个文件中功能重叠但调用不同服务，容易混淆和维护困难。

## What Changes
- 将 `learningPath.ts` 中独有的 3 个端点（`/generate`、`/progress/:graphId`、`/questions`）合并到 `learningPaths.ts`
- 删除 `learningPath.ts` 文件
- 在 `app.ts` 中移除 `/api/learning-path` 路由挂载
- 更新前端 API 客户端，将 `learningPathApi` 的请求路径从 `/learning-path/` 改为 `/learning-paths/`
- **BREAKING**：`/api/learning-path/*` 路径废弃，统一为 `/api/learning-paths/*`

## Impact
- Affected code:
  - `api/routes/learningPath.ts` — 删除
  - `api/routes/learningPaths.ts` — 合入 3 个端点
  - `api/app.ts` — 移除旧路由挂载
  - `src/services/api/learningPaths.ts` — 更新 `learningPathApi` 的请求路径
  - `src/services/api/contracts/IApi.ts` — 可能需要更新接口（如路径注释）

## ADDED Requirements

### Requirement: 统一学习路径 API 路径
系统 SHALL 将所有学习路径相关的 API 端点统一到 `/api/learning-paths` 路径下。

#### Scenario: 旧路径端点迁移到新路径
- **WHEN** 客户端请求 `/api/learning-paths/generate`（原 `/api/learning-path/generate`）
- **THEN** 系统正常处理请求，行为与原端点一致

#### Scenario: 按图谱获取进度
- **WHEN** 客户端请求 `/api/learning-paths/progress/:graphId`（原 `/api/learning-path/progress/:graphId`）
- **THEN** 系统返回该图谱的学习进度统计

#### Scenario: 生成前置知识问题
- **WHEN** 客户端请求 `/api/learning-paths/questions`（原 `/api/learning-path/questions`）
- **THEN** 系统返回前置知识评估问题

### Requirement: 合并后 generate 端点行为兼容
合并后 `learningPaths.ts` 中的 `POST /generate` 端点 SHALL 保持现有行为（使用 `learningPathService.generateAndSavePath`），同时 `learningPathRouteService.generatePath` 的不保存行为 SHALL 通过可选参数支持。

#### Scenario: 生成但不保存
- **WHEN** 客户端请求 `/api/learning-paths/generate` 且 `save_path` 为 false 或未设置
- **THEN** 系统使用 `learningPathRouteService.generatePath` 返回生成结果但不保存到数据库

#### Scenario: 生成并保存
- **WHEN** 客户端请求 `/api/learning-paths/generate` 且 `save_path` 为 true
- **THEN** 系统使用 `learningPathService.generateAndSavePath` 生成路径并保存到数据库

## MODIFIED Requirements

### Requirement: 前端 API 客户端路径
`learningPathApi` 中的请求路径 SHALL 从 `/learning-path/` 更新为 `/learning-paths/`。

## REMOVED Requirements

### Requirement: `/api/learning-path` 路由
**Reason**: 与 `/api/learning-paths` 功能重叠，统一命名避免混淆
**Migration**: 前端 API 客户端路径同步更新，无需用户操作
