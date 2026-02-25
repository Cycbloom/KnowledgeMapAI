# 修复任务调度器拖拽功能 Spec

## Why
任务调度器中，任务无法通过拖拽在不同队列之间移动。用户拖拽任务卡片到另一个队列时，API 请求从未发出，导致任务无法真正移动到目标队列。

## What Changes
- 修复 `handleDragEnd` 中 `over` 对象为 null 或无法正确识别目标队列的问题
- 修复 `closestCorners` 碰撞检测在跨队列拖拽时的识别问题
- 添加调试日志以便追踪拖拽事件流程

## Impact
- Affected code: `src/pages/Scheduler.tsx`, `src/components/Scheduler/QueueColumn.tsx`

## ADDED Requirements

### Requirement: 跨队列拖拽功能
系统 SHALL 支持用户通过拖拽将任务从一个队列移动到另一个队列。

#### Scenario: 成功跨队列移动
- **WHEN** 用户将任务卡片从 Q0 拖拽到 Q1 或 Q2
- **THEN** 系统应发送 `PUT /scheduler/tasks/:id/move` 请求
- **AND** 任务应在目标队列中显示
- **AND** 显示成功消息 "任务已移动到 Q{X}"

#### Scenario: 拖拽到队列空白区域
- **WHEN** 用户将任务拖拽到目标队列的空白区域（而非另一个任务卡片上）
- **THEN** 系统应正确识别目标队列
- **AND** 发送移动请求

## Root Cause Analysis

经过代码分析，发现以下潜在问题：

1. **碰撞检测问题**: `closestCorners` 策略可能无法正确识别队列的 droppable 区域，特别是当队列中没有其他任务时

2. **`over` 对象识别问题**: 在 `handleDragEnd` 中，`getQueueKeyFromOver` 使用原始 `queues` 数据查找任务，但如果任务已经通过 `handleDragOver` 移动到了 `localQueues`，可能导致查找失败

3. **droppable 区域配置**: `QueueColumn` 中的 `useDroppable` 可能需要调整，确保整个队列区域都能接收拖放
