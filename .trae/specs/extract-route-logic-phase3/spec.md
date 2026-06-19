# 路由层业务逻辑下沉（第三轮）Spec

## Why
前两轮重构已解决 domains、graphs/crud、literature、expansion、backup 的泄漏问题，但路由层仍有大量业务逻辑滞留。本轮聚焦 **高优先级** 的 5 个文件，它们包含核心业务算法（进度分配、调度时间计算、循环依赖检测、模板变量替换、模板初始化编排）和大量跨表聚合逻辑，合计 **69 次直接 DB 调用**。

## What Changes
- **扩展** `api/services/scheduler/taskService.ts` — 添加任务列表聚合、详情聚合、进度更新、移动排序方法
- **新增** `api/services/scheduler/progressPlanService.ts` — 进度分配算法 + 进度计划 CRUD（从 `scheduler/progress.ts` 提取）
- **新增** `api/services/scheduler/scheduleService.ts` — 调度时间计算 + 调度 CRUD（从 `scheduler/schedules.ts` 提取）
- **新增** `api/services/scheduler/templateService.ts` — 模板变量替换 + 模板 CRUD（从 `scheduler/templates.ts` 提取）
- **新增** `api/services/story/structureService.ts` — 模板初始化编排 + 结构 CRUD（从 `story/structures.ts` 提取）
- **修改** `api/routes/scheduler/tasks.ts` — 路由精简，委托 taskService
- **修改** `api/routes/scheduler/progress.ts` — 路由精简，委托 progressPlanService
- **修改** `api/routes/scheduler/schedules.ts` — 路由精简，委托 scheduleService
- **修改** `api/routes/scheduler/templates.ts` — 路由精简，委托 templateService
- **修改** `api/routes/story/structures.ts` — 路由精简，委托 structureService

## Impact
- Affected specs: 无破坏性变更，所有 API 接口保持不变
- Affected code:
  - `api/routes/scheduler/tasks.ts`（精简列表/详情/进度/移动路由）
  - `api/routes/scheduler/progress.ts`（精简全部路由，移除 ~115 行计算逻辑）
  - `api/routes/scheduler/schedules.ts`（精简全部路由，移除 calculateNextRunAt 函数）
  - `api/routes/scheduler/templates.ts`（精简全部路由，移除模板变量替换逻辑）
  - `api/routes/story/structures.ts`（精简全部路由，移除 buildTree + initialize-template 编排）
  - `api/services/scheduler/taskService.ts`（扩展）
  - `api/services/scheduler/progressPlanService.ts`（新增）
  - `api/services/scheduler/scheduleService.ts`（新增）
  - `api/services/scheduler/templateService.ts`（新增）
  - `api/services/story/structureService.ts`（新增）

## ADDED Requirements

### Requirement: 任务服务扩展（taskService）
系统 SHALL 扩展 `taskService` 添加以下方法，从 `scheduler/tasks.ts` 提取：

- `listTasksWithStats(supabase, userId, filters)` — 查询任务列表 + 子任务统计聚合（消除重复的 subtaskCounts 计算）
- `getTaskDetail(supabase, userId, taskId)` — 跨 5 表聚合详情（任务 + 依赖 + 被依赖 + 进度计划 + 执行记录 + 子任务统计）
- `updateTaskProgress(supabase, userId, taskId, data)` — 含先读后写的累加逻辑（actual_duration_add）
- `moveTask(supabase, userId, taskId, data)` — 含 position 计算逻辑
- `listQueuesWithStats(supabase, userId)` — 队列视图 + 子任务统计聚合

#### Scenario: 获取任务详情
- **WHEN** 调用 `taskService.getTaskDetail(supabase, userId, taskId)`
- **THEN** 跨 5 表聚合返回完整任务详情，含依赖关系、进度计划、执行记录、子任务统计

#### Scenario: 子任务统计不重复
- **WHEN** 调用 `listTasksWithStats` 或 `listQueuesWithStats`
- **THEN** 子任务统计逻辑只实现一次，两处共享

### Requirement: 进度计划服务（progressPlanService）
系统 SHALL 提供 `progressPlanService` 封装进度分配算法和进度计划管理逻辑。

- `generateProgressAllocations(startDate, endDate, totalUnits, mode, dailyHours)` — 从 progress.ts 提取 5 个分配算法函数
- `createProgressPlan(supabase, userId, taskId, data)` — 验证任务 → 生成分配 → 删除旧计划 → 批量插入 → 更新任务 progress_mode
- `updateProgress(supabase, userId, taskId, planId, data)` — 验证 → 查找计划 → 更新 → 重算总进度 → 自动完成判定
- `listProgressPlans(supabase, userId, taskId)` — 查询进度计划列表
- `deleteProgressPlan(supabase, userId, planId)` — 删除进度计划

#### Scenario: 生成进度分配
- **WHEN** 调用 `progressPlanService.generateProgressAllocations(...)` with mode="average"
- **THEN** 返回按平均分配的日期-单元映射

#### Scenario: 进度自动完成
- **WHEN** 更新进度后总进度 >= 100
- **THEN** 自动将任务状态标记为 completed

### Requirement: 调度服务（scheduleService）
系统 SHALL 提供 `scheduleService` 封装调度时间计算和调度管理逻辑。

- `calculateNextRunAt(schedule)` — 从 schedules.ts 提取，根据 schedule_type（daily/weekly/custom/smart）计算下次运行时间
- `createSchedule(supabase, userId, data)` — 创建调度 + 计算 next_run_at
- `updateSchedule(supabase, userId, scheduleId, data)` — 更新调度 + 重算 next_run_at
- `runSchedule(supabase, userId, scheduleId)` — 读调度+模板 → 创建任务 → 更新 last_run_at/next_run_at
- `listSchedules(supabase, userId)` — 查询调度列表
- `deleteSchedule(supabase, userId, scheduleId)` — 删除调度

#### Scenario: 计算下次运行时间
- **WHEN** 调用 `scheduleService.calculateNextRunAt(schedule)` with schedule_type="daily"
- **THEN** 返回基于当前时间的下次运行时间

### Requirement: 模板服务（templateService）
系统 SHALL 提供 `templateService` 封装模板变量替换和模板管理逻辑。

- `applyTemplate(supabase, userId, templateId, variables)` — 读模板 → 变量替换 → count 任务 → 插入任务 → 更新 usage_count
- `duplicateTemplate(supabase, userId, templateId)` — 复制模板数据
- `setDefaultTemplate(supabase, userId, templateId, category)` — 清除同分类现有默认 → 设置新默认
- `listTemplates(supabase, userId, filters)` — 查询模板列表
- `getTemplateCategories(supabase, userId)` — 分类统计聚合
- `createTemplate(supabase, userId, data)` — 创建模板
- `updateTemplate(supabase, userId, templateId, data)` — 更新模板
- `deleteTemplate(supabase, userId, templateId)` — 删除模板

#### Scenario: 模板变量替换
- **WHEN** 调用 `templateService.applyTemplate(supabase, userId, templateId, { topic: "机器学习" })`
- **THEN** 模板中 `{{topic}}` 被替换为 "机器学习"，未解析占位符回退为空字符串

### Requirement: 故事结构服务（structureService）
系统 SHALL 提供 `structureService` 封装故事结构管理和模板初始化逻辑。

- `initializeFromTemplate(supabase, userId, structureId, templateId)` — 读模板 → 解析 beats → 批量插入 → 构建 actMap → 更新 parent_structure_id → 重新查询 → 构建树
- `listStructures(supabase, userId)` — 查询结构列表（含树形构建）
- `createStructure(supabase, userId, data)` — 创建结构
- `updateStructure(supabase, userId, structureId, data)` — 更新结构
- `deleteStructure(supabase, userId, structureId)` — 删除结构

#### Scenario: 从模板初始化结构
- **WHEN** 调用 `structureService.initializeFromTemplate(supabase, userId, structureId, templateId)`
- **THEN** 完整执行模板初始化编排，返回构建好的树形结构

## MODIFIED Requirements

### Requirement: scheduler/tasks.ts 路由
原路由内子任务统计聚合、详情聚合、进度更新、移动排序逻辑修改为调用 `taskService` 对应方法。

### Requirement: scheduler/progress.ts 路由
原路由内 ~115 行进度分配算法和进度计划管理逻辑修改为调用 `progressPlanService` 对应方法。

### Requirement: scheduler/schedules.ts 路由
原路由内 calculateNextRunAt 函数和调度管理逻辑修改为调用 `scheduleService` 对应方法。

### Requirement: scheduler/templates.ts 路由
原路由内模板变量替换逻辑和模板管理逻辑修改为调用 `templateService` 对应方法。

### Requirement: story/structures.ts 路由
原路由内 buildTree 函数和模板初始化编排逻辑修改为调用 `structureService` 对应方法。

## REMOVED Requirements

无。所有 API 行为保持不变。
