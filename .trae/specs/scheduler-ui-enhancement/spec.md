# 任务调度器 UI 增强与重构 Spec

## Why
当前任务调度器存在多个问题：
1. 拖拽排序功能仍然有验证错误
2. 拖拽动画效果缺失，用户体验不佳
3. 任务排序使用简单的 reorder，而非链表/拓扑排序结构
4. 视图切换功能缺失，只显示单一视图
5. 任务卡片 UI 不美观，悬浮按钮遮挡文字

## What Changes
- 修复拖拽排序的 API 验证错误
- 添加拖拽占位符和动画效果
- 重构任务排序为链表结构（prev_id/next_id）
- 恢复多视图切换（看板视图、时间轴视图、列表视图）
- 优化任务卡片 UI 布局

## Impact
- Affected specs: mlfq-task-scheduler, task-scheduler-enhancement
- Affected code: 
  - `src/pages/Scheduler.tsx`
  - `src/components/Scheduler/TaskCard.tsx`
  - `src/components/Scheduler/QueueColumn.tsx`
  - `api/routes/scheduler.ts`
  - `api/services/schedulerService.ts`

## ADDED Requirements

### Requirement: 拖拽动画效果
系统 SHALL 提供流畅的拖拽动画效果。

#### Scenario: 拖拽开始
- **WHEN** 用户开始拖拽任务卡片
- **THEN** 原位置显示占位符（虚线框或半透明副本）
- **AND** 被拖拽的卡片显示拖拽状态（放大、阴影）

#### Scenario: 拖拽过程中
- **WHEN** 用户拖拽任务到目标位置
- **THEN** 其他任务卡片自动让位，显示插入位置指示器
- **AND** 目标队列高亮显示

#### Scenario: 拖拽完成
- **WHEN** 用户释放任务
- **THEN** 任务平滑移动到新位置
- **AND** 显示成功消息

### Requirement: 任务链表排序
系统 SHALL 使用链表结构管理任务顺序。

#### Scenario: 任务创建
- **WHEN** 创建新任务
- **THEN** 任务添加到队列末尾
- **AND** 更新前一个任务的 next_id

#### Scenario: 任务移动
- **WHEN** 移动任务到新位置
- **THEN** 更新相关任务的 prev_id 和 next_id
- **AND** 保持链表完整性

#### Scenario: 任务删除
- **WHEN** 删除任务
- **THEN** 更新前后任务的链接关系
- **AND** 保持链表完整性

### Requirement: 多视图切换
系统 SHALL 提供多种任务视图。

#### Scenario: 看板视图
- **WHEN** 用户选择看板视图
- **THEN** 显示三列队列视图（Q0/Q1/Q2）
- **AND** 支持拖拽排序

#### Scenario: 时间轴视图
- **WHEN** 用户选择时间轴视图
- **THEN** 按时间线显示任务
- **AND** 显示截止日期和执行时间

#### Scenario: 列表视图
- **WHEN** 用户选择列表视图
- **THEN** 以紧凑列表形式显示所有任务
- **AND** 支持排序和筛选

### Requirement: 任务卡片 UI 优化
系统 SHALL 提供美观的任务卡片界面。

#### Scenario: 按钮布局
- **WHEN** 用户悬浮在任务卡片上
- **THEN** 操作按钮显示在卡片右侧专用区域
- **AND** 不遮挡任务描述文字

#### Scenario: 卡片样式
- **WHEN** 显示任务卡片
- **THEN** 卡片有清晰的视觉层次
- **AND** 不同队列有不同颜色标识
- **AND** 状态有明确的视觉区分

## MODIFIED Requirements

### Requirement: 拖拽排序 API
系统 SHALL 正确处理任务排序请求。

#### Scenario: 同队列排序
- **WHEN** 用户在同一队列内拖拽任务
- **THEN** 发送正确的 API 请求到 `/tasks/reorder`
- **AND** 请求体包含 `queue_level` 和 `task_ids`

## REMOVED Requirements
（无）
