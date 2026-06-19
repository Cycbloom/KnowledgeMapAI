# 路由层业务逻辑下沉（第五轮）Spec

## Why
前四轮重构已将路由层 DB 调用从 367 次降至 140 次（降幅 62%）。本轮聚焦剩余 **7 个中高优先级文件**（≥7 次 DB 调用），它们合计 61 次调用，占剩余总量的 43.6%。

## What Changes
- **新增** `api/services/scheduler/taskKnowledgePointService.ts` — 任务-知识点关联管理（从 `scheduler/knowledgePoints.ts` 提取，10 次 DB 调用）
- **新增** `api/services/common/notificationService.ts` — 通知 + 通知设置管理（从 `notifications.ts` 提取，10 次 DB 调用）
- **新增** `api/services/scheduler/taskDependencyService.ts` — 任务依赖管理 + 循环依赖检测（从 `scheduler/dependencies.ts` 提取，9 次 DB 调用）
- **新增** `api/services/scheduler/taskLinkService.ts` — 任务链接管理（从 `scheduler/links.ts` 提取，8 次 DB 调用）
- **新增** `api/services/scheduler/timeSlotService.ts` — 时间段管理 + 冲突检测（从 `scheduler/timeSlots.ts` 提取，8 次 DB 调用）
- **新增** `api/services/graph/regionService.ts` — 图谱区域管理（从 `regions.ts` 提取，7 次 DB 调用）
- **扩展** `api/services/scheduler/taskService.ts` — 补充 tasks.ts 剩余 9 次 DB 调用的方法
- **修改** 对应的 7 个路由文件，精简为委托调用

## Impact
- Affected specs: 无破坏性变更，所有 API 接口保持不变
- Affected code:
  - `api/routes/scheduler/knowledgePoints.ts`（精简全部路由）
  - `api/routes/notifications.ts`（精简全部路由）
  - `api/routes/scheduler/dependencies.ts`（精简全部路由）
  - `api/routes/scheduler/links.ts`（精简全部路由）
  - `api/routes/scheduler/timeSlots.ts`（精简全部路由）
  - `api/routes/regions.ts`（精简全部路由）
  - `api/routes/scheduler/tasks.ts`（精简剩余直接 DB 调用的路由）

## ADDED Requirements

### Requirement: 任务知识点关联服务（taskKnowledgePointService）
系统 SHALL 提供 `taskKnowledgePointService` 封装任务与知识点的关联管理逻辑。

- `list(supabase, userId, taskId)` — 查询任务关联的知识点列表（含知识点详情）
- `create(supabase, userId, taskId, data)` — 关联知识点（含任务归属验证、知识点访问权限验证、is_primary 互斥更新）
- `update(supabase, userId, taskId, kpId, updates)` — 更新关联（含 is_primary 互斥更新）
- `delete(supabase, userId, taskId, kpId)` — 取消知识点关联

### Requirement: 通知服务（notificationService）
系统 SHALL 提供 `notificationService` 封装通知和通知设置的管理逻辑。

- `list(supabase, userId, options)` — 查询通知列表（含 unread_only 过滤）
- `getUnreadCount(supabase, userId)` — 获取未读通知数量
- `create(supabase, userId, data)` — 创建通知
- `markAsRead(supabase, userId, notificationId)` — 标记单条已读
- `markAllAsRead(supabase, userId)` — 全部标记已读
- `delete(supabase, userId, notificationId)` — 删除单条通知
- `clearAll(supabase, userId)` — 清空全部通知
- `getSettings(supabase, userId)` — 获取通知设置（不存在时自动创建）
- `updateSettings(supabase, userId, updates)` — 更新通知设置

### Requirement: 任务依赖服务（taskDependencyService）
系统 SHALL 提供 `taskDependencyService` 封装任务依赖管理和循环依赖检测逻辑。

- `listDependencies(supabase, userId, taskId)` — 查询任务的前置依赖列表
- `listDependents(supabase, userId, taskId)` — 查询任务的后置任务列表
- `create(supabase, userId, taskId, data)` — 创建依赖关系（含自引用检查、任务存在性验证、重复检查、循环依赖检测）
- `delete(supabase, userId, taskId, dependencyId)` — 删除依赖关系
- `checkCircularDependency(supabase, taskId, dependsOnTaskId, userId)` — BFS 检测循环依赖

### Requirement: 任务链接服务（taskLinkService）
系统 SHALL 提供 `taskLinkService` 封装任务链接管理逻辑。

- `list(supabase, userId, taskId)` — 查询任务链接列表
- `create(supabase, userId, taskId, data)` — 创建链接（含任务归属验证、position 自动计算）
- `update(supabase, userId, taskId, linkId, updates)` — 更新链接
- `delete(supabase, userId, taskId, linkId)` — 删除链接

### Requirement: 时间段服务（timeSlotService）
系统 SHALL 提供 `timeSlotService` 封装时间段管理和冲突检测逻辑。

- `list(supabase, userId)` — 查询时间段列表（含 weekView 和 globalSlots 分组）
- `create(supabase, userId, data)` — 创建时间段（含时间冲突检测）
- `update(supabase, userId, slotId, updates)` — 更新时间段（含时间冲突检测）
- `delete(supabase, userId, slotId)` — 删除时间段
- `checkTimeOverlap(existingSlots, newStart, newEnd)` — 时间冲突检测辅助方法

### Requirement: 图谱区域服务（regionService）
系统 SHALL 提供 `regionService` 封装图谱区域管理逻辑（区域存储在图谱 settings.quadrantViewState.customRegions 中）。

- `list(supabase, userId, graphId)` — 获取图谱区域列表
- `create(supabase, userId, graphId, data)` — 创建区域
- `update(supabase, userId, graphId, regionId, updates)` — 更新区域
- `delete(supabase, userId, graphId, regionId)` — 删除区域

## MODIFIED Requirements

### Requirement: scheduler/tasks.ts 路由
原路由中剩余的 9 次直接 DB 调用（均为 `user_tasks` 表操作）修改为调用 `taskService` 对应方法。

## REMOVED Requirements

无。所有 API 行为保持不变。
