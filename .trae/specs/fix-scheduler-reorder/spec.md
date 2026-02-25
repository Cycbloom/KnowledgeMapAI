# 修复任务拖拽排序问题 Spec

## Why
任务拖拽排序存在两个关键问题：
1. 同队列内排序时，目标位置计算错误 - 拖拽落点位置没有其他任务，导致无法正确识别插入位置
2. 任务移回原队列后无法再被拖动 - 状态管理问题导致拖拽功能失效

## What Changes
- 修复同队列排序的目标位置计算逻辑
- 修复移回原队列后任务无法拖动的问题
- 清理调试日志

## Impact
- Affected code: `src/pages/Scheduler.tsx`

## ADDED Requirements

### Requirement: 同队列排序目标位置计算
系统 SHALL 正确计算同队列内排序的目标位置。

#### Scenario: 拖拽到其他任务上方
- **WHEN** 用户拖拽任务到同队列内另一个任务上方
- **THEN** 系统应计算目标插入位置为该任务之前的位置
- **AND** 其他任务自动让位显示插入空间

#### Scenario: 拖拽到队列空白区域
- **WHEN** 用户拖拽任务到队列底部空白区域
- **THEN** 系统应将目标位置设为队列末尾
- **AND** 正确发送排序 API 请求

### Requirement: 跨队列移动后状态保持
系统 SHALL 在跨队列移动后保持任务可拖动状态。

#### Scenario: 移回原队列
- **WHEN** 用户将任务从 Q0 移到 Q1，再移回 Q0
- **THEN** 任务应保持可拖动状态
- **AND** 拖拽功能正常工作

## Root Cause Analysis

### 问题1: 目标位置计算
当前逻辑依赖 `over.id` 来确定目标位置，但拖拽落点可能没有其他任务（空白区域），导致：
- `over.id` 等于 `active.id`（指向自己）
- `targetIndexRef` 没有被正确设置

**解决方案**: 在 `handleDragEnd` 中，如果 `targetIndexRef.current === -1`，则根据 `over` 对象重新计算目标位置，或默认移动到队列末尾。

### 问题2: 移回原队列后无法拖动
可能原因：
- `localQueues` 状态残留
- React Query 缓存数据与实际数据不一致
- `useSortable` 的 `id` 冲突

**解决方案**: 确保 `handleDragEnd` 完成后正确清除所有状态，并强制刷新数据。
