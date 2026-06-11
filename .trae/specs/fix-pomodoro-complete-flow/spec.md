# 番茄钟完成后自动切换与进度同步修复 Spec

## Why

用户在 Scheduler 页面点击番茄钟"完成"按钮后，存在三个核心功能缺陷：
1. 番茄钟完成后不会自动切换到下一个（第一个番茄钟应自动进入休息或第二个番茄钟）
2. 任务的 `progress_percentage` 和子任务进度条未随番茄钟完成而正确更新
3. 执行记录 (`task_executions`) 未正确反映已完成的番茄钟信息

## What Changes

- **修复 TimerService.complete()**：完成时保留 taskId 上下文，增加 completedSessions 计数，发布包含 taskId 的完成事件
- **修复 TimerService.onTimerEnd()**：focus 模式结束后自动切换到 break 模式（复用 skipToBreak 的逻辑），实现 Pomodoro 循环
- **修复 ActiveTaskPanel.handleComplete()**：完成当前番茄钟后，根据是否有子任务决定下一步行为（启动新番茄钟 / 切换到休息 / 完成任务）
- **修复 Scheduler.tsx onSubtaskComplete 回调**：子任务完成后自动启动新一轮番茄钟
- **新增任务进度更新逻辑**：每次番茄钟完成后，调用后端 API 更新任务的 `progress_percentage` 和 `actual_duration`
- **修复 task_executions 语义**：确保执行记录正确记录每个番茄钟的时长和状态

## Impact

- Affected specs: 无直接关联的已有 spec
- Affected code:
  - `src/services/timer/TimerService.ts` — 核心修改：`onTimerEnd()`、`complete()` 方法
  - `src/components/Scheduler/ActiveTaskPanel.tsx` — 修改 `handleComplete()` 逻辑
  - `src/pages/Scheduler.tsx` — 修改 `onSubtaskComplete` 回调，添加进度更新
  - `api/services/scheduler/taskService.ts` — 可能需新增 `updateProgress` 方法
  - `api/routes/scheduler/tasks.ts` — 可能需新增进度更新路由

## ADDED Requirements

### Requirement: 番茄钟完成后自动模式切换

系统 SHALL 在番茄钟（focus 模式）自然结束或手动完成时，自动按 Pomodoro 标准流程切换到下一阶段：

#### Scenario: Focus 番茄钟自然倒计时结束 (onTimerEnd)
- **WHEN** 当前 mode 为 `focus` 且计时器归零
- **THEN** 系统：
  1. 保存 focus_session 记录
  2. `completedSessions` +1
  3. 自动切换到 `shortBreak` 或 `longBreak`（每 4 个 focus 后长休息）
  4. 新的 break 计时器自动开始运行
  5. 发布 `timer_completed` 事件（含正确的 taskId）

#### Scenario: 用户手动点击"完成"按钮 (complete)
- **WHEN** 用户在 ActiveTaskPanel 点击完成按钮且当前有活跃子任务
- **THEN** 系统：
  1. 保存 focus_session 记录（保留 taskId 不清空）
  2. `completedSessions` +1
  3. 调用 `onSubtaskComplete` 完成当前子任务
  4. 如果存在下一个 pending 子任务 → 自动启动新的 focus 番茄钟（关联新子任务）
  5. 如果所有子任务已完成 → 自动切换到 break 模式

#### Scenario: 用户手动点击"完成"按钮（无子任务）
- **WHEN** 用户点击完成按钮且当前任务无子任务
- **THEN** 系统：
  1. 保存 focus_session 记录
  2. 更新任务整体进度（progress_percentage、actual_duration）
  3. 自动切换到 break 模式

### Requirement: 任务与子任务进度自动更新

系统 SHALL 在每次番茄钟完成后自动更新任务和子任务的进度数据：

#### Scenario: 有子任务的任务 — 番茄钟完成
- **WHEN** 一个关联子任务的番茄钟完成
- **THEN** 系统：
  1. 当前活跃子任务标记为 `completed`
  2. 下一个 pending 子任务标记为 `in_progress`
  3. 任务级 `progress_percentage` = 已完成子任务数 / 总子任务数 × 100
  4. 前端子任务进度条实时刷新显示

#### Scenario: 无子任务的任务 — 番茄钟完成
- **WHEN** 一个无子任务的任务的番茄钟完成
- **THEN** 系统：
  1. `actual_duration` += 本次番茄钟时长（分钟）
  2. `progress_percentage` = min(100, actual_duration / estimated_duration × 100)
  3. 如果 progress_percentage >= 100 且所有计划番茄已完成 → 可选标记任务为 completed

### Requirement: 执行记录同步更新

系统 SHALL 确保 task_executions 正确反映每个番茄钟的执行情况：

#### Scenario: 每个 focus 番茄钟完成时
- **WHEN** 一个 focus 模式的番茄钟完成
- **THEN** 系统：
  1. 创建或更新一条 task_execution 记录
  2. 记录正确的 started_at、ended_at、duration（秒）
  3. status 设为 `time_slice_ended`（表示一个时间片完成，非整个任务完成）

## MODIFIED Requirements

### Requirement: TimerService.complete() 方法

`complete()` 方法 SHALL 修改为：
1. 保留 `_taskId` 不设为 null（直到用户明确切换/重置任务）
2. 增加 `_completedSessions` 计数（与 onTimerEnd 行为一致）
3. 发布事件时携带正确的 `taskId`（非 null）
4. 完成后自动触发模式切换（与 onTimerEnd 一致的行为）

### Requirement: TimerService.onTimerEnd() 方法

`onTimerEnd()` 方法 SHALL 修改为：
1. 在保存 focus_session 并发送通知后，自动判断下一步模式
2. 如果是 focus 结束 → 自动启动 shortBreak/longBreak（复用 skipToBreak 内部逻辑）
3. 如果是 break 结束 → 自动启动新的 focus（保持原 taskId）

## REMOVED Requirements

无。
