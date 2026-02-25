# 任务调度器拖拽功能重构 Spec

## Why
当前任务调度器的拖拽功能存在严重问题：
1. 同队列内任务排序功能完全无法工作
2. 跨队列拖动效果不稳定，视觉反馈不正确
3. `dnd-kit` 的 `SortableContext` 和 `DndContext` 混用导致事件处理冲突

## What Changes
- 重构拖拽系统，使用 `dnd-kit` 的正确模式实现排序和跨队列移动
- 实现同队列内任务的拖拽排序功能
- 实现跨队列拖拽移动功能
- 添加正确的视觉反馈（拖拽预览、放置指示器）
- **BREAKING**: 移除旧的拖拽事件处理逻辑

## Impact
- Affected code: `src/pages/Scheduler.tsx`, `src/components/Scheduler/QueueColumn.tsx`, `src/components/Scheduler/TaskCard.tsx`
- Affected specs: 任务调度器核心交互功能

## ADDED Requirements

### Requirement: 同队列内任务排序
系统 SHALL 支持用户通过拖拽在同一队列内重新排列任务顺序。

#### Scenario: 成功同队列排序
- **WHEN** 用户在同一队列内拖拽任务卡片到另一个任务的位置
- **THEN** 系统应显示拖拽预览和放置指示器
- **AND** 释放后任务应移动到新位置
- **AND** 发送 `PUT /scheduler/tasks/reorder` 请求
- **AND** 显示成功消息 "任务顺序已更新"

#### Scenario: 拖拽到同队列空白区域
- **WHEN** 用户将任务拖拽到同队列的空白区域
- **THEN** 任务应移动到队列末尾
- **AND** 发送排序请求

### Requirement: 跨队列任务移动
系统 SHALL 支持用户通过拖拽将任务从一个队列移动到另一个队列。

#### Scenario: 成功跨队列移动
- **WHEN** 用户将任务卡片从一个队列拖拽到另一个队列
- **THEN** 系统应显示目标队列的高亮效果
- **AND** 释放后任务应出现在目标队列中
- **AND** 发送 `PUT /scheduler/tasks/:id/move` 请求
- **AND** 显示成功消息 "任务已移动到 Q{X}"

#### Scenario: 跨队列移动到特定位置
- **WHEN** 用户将任务从一个队列拖拽到另一个队列的特定任务位置
- **THEN** 任务应插入到目标位置
- **AND** 同时更新队列级别和顺序

### Requirement: 拖拽视觉反馈
系统 SHALL 提供清晰的拖拽视觉反馈。

#### Scenario: 拖拽开始
- **WHEN** 用户开始拖拽任务卡片
- **THEN** 被拖拽的卡片应显示半透明效果
- **AND** 原位置应显示占位符
- **AND** 显示跟随鼠标的拖拽预览

#### Scenario: 拖拽经过目标队列
- **WHEN** 用户拖拽任务经过目标队列
- **THEN** 目标队列应显示高亮边框
- **AND** 如果是同队列排序，显示插入位置指示器

#### Scenario: 拖拽取消
- **WHEN** 用户按下 Escape 或拖拽到无效区域
- **THEN** 任务应返回原位置
- **AND** 不发送任何请求

## Root Cause Analysis

当前实现的问题：

1. **SortableContext 未正确使用**: `QueueColumn` 中使用了 `SortableContext`，但没有传递 `onReorder` 回调，且 `items` 属性传递的是 `taskIds` 数组，这导致排序事件无法正确触发

2. **事件处理冲突**: `DndContext` 的 `onDragEnd` 和 `SortableContext` 的排序逻辑冲突，导致同队列排序无法工作

3. **缺少 Sortable 包装组件**: `TaskCard` 使用了 `useSortable`，但没有正确处理排序事件，且 `SortableContext` 没有正确配置

4. **跨队列逻辑问题**: `handleDragOver` 只处理跨队列移动，没有正确处理同队列排序预览

## Technical Approach

采用 `dnd-kit` 官方推荐的模式：

1. **使用单一 DndContext**: 在 `Scheduler.tsx` 中保持单一 `DndContext`
2. **正确使用 SortableContext**: 每个 `QueueColumn` 内使用 `SortableContext` 包装任务列表
3. **使用 useSortable hook**: `TaskCard` 继续使用 `useSortable`，但需要正确处理 transform
4. **统一事件处理**: 在 `handleDragEnd` 中统一处理排序和跨队列移动
5. **使用 arrayMove**: 同队列排序使用 `@dnd-kit/sortable` 的 `arrayMove` 函数

## Implementation Details

### 1. Scheduler.tsx 修改

```typescript
// handleDragEnd 需要区分三种情况：
// 1. 同队列排序：sourceQueue === overQueueKey && overId !== activeId
// 2. 跨队列移动：sourceQueue !== overQueueKey
// 3. 无效操作：activeId === overId 或 over === null
```

### 2. QueueColumn.tsx 修改

- 保持 `useDroppable` 用于跨队列检测
- `SortableContext` 需要正确配置 `items` 属性
- 添加拖拽悬停样式

### 3. TaskCard.tsx 修改

- 正确处理 `useSortable` 的 transform
- 添加拖拽状态样式
- 确保拖拽时不会被其他元素遮挡
