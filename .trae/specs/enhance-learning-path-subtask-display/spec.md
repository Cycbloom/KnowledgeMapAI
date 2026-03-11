# 学习路径自动排程子任务显示优化 Spec

## Why
当前学习路径的自动排程功能虽然会将每个学习节点转换为子任务，但在任务调度界面的任务卡片上没有直观显示子任务信息。用户只能看到主任务，无法直接看到每个学习节点作为子任务的情况，导致学习进度跟踪不直观。

## What Changes
- 在任务卡片上显示子任务数量和完成进度
- 在任务卡片展开时显示子任务列表预览
- 优化学习路径任务的视觉标识，区分普通任务和学习路径任务
- 在任务列表中支持直接查看和操作子任务

## Impact
- Affected specs: 任务调度系统、学习路径功能
- Affected code:
  - `src/components/Scheduler/TaskCard.tsx` - 添加子任务显示
  - `src/components/Scheduler/TaskQueue.tsx` - 支持子任务预览
  - `api/routes/scheduler/tasks.ts` - 返回子任务数量
  - `api/services/schedulerService.ts` - 优化任务查询

## ADDED Requirements

### Requirement: 任务卡片显示子任务信息
系统应当在任务卡片上显示子任务的数量和完成进度。

#### Scenario: 显示子任务数量
- **WHEN** 任务包含子任务
- **THEN** 任务卡片上应当显示子任务数量（如"3/5 完成"）
- **AND** 应当显示进度条表示完成比例
- **AND** 子任务信息应当清晰可见，不占用过多空间

#### Scenario: 无子任务时
- **WHEN** 任务不包含子任务
- **THEN** 任务卡片不显示子任务相关信息
- **AND** 保持原有的展示样式

### Requirement: 任务卡片展开显示子任务列表
系统应当支持在任务卡片展开时显示子任务列表预览。

#### Scenario: 展开任务卡片查看子任务
- **WHEN** 用户点击任务卡片的展开按钮
- **THEN** 应当显示该任务的子任务列表
- **AND** 每个子任务应当显示标题、状态、预计时长
- **AND** 子任务列表应当支持滚动（如果有多个子任务）
- **AND** 用户可以直接在列表中切换子任务状态

#### Scenario: 子任务状态同步
- **WHEN** 用户在任务卡片中完成一个子任务
- **THEN** 子任务状态应当立即更新
- **AND** 主任务的进度应当自动更新
- **AND** 如果所有子任务完成，主任务状态应更新为可完成

### Requirement: 学习路径任务视觉标识
系统应当为学习路径生成的任务提供特殊的视觉标识。

#### Scenario: 学习路径任务标识
- **WHEN** 任务是由学习路径自动排程生成的
- **THEN** 任务卡片应当显示学习路径标识（如书本图标）
- **AND** 应当显示关联的学习路径名称
- **AND** 点击标识可以跳转到对应的学习路径

#### Scenario: 学习节点子任务标识
- **WHEN** 子任务关联了学习路径节点
- **THEN** 子任务应当显示知识点标识
- **AND** 点击可以跳转到对应的知识点详情

### Requirement: 子任务快速操作
系统应当支持在任务卡片中直接操作子任务。

#### Scenario: 快速完成子任务
- **WHEN** 用户点击子任务的完成按钮
- **THEN** 子任务状态应当切换为完成
- **AND** 应当显示完成动画效果
- **AND** 进度条应当平滑更新

#### Scenario: 子任务时间记录
- **WHEN** 用户完成一个子任务
- **THEN** 系统应当记录实际用时（如果任务正在执行中）
- **AND** 更新学习路径节点的进度

## MODIFIED Requirements

### Requirement: 任务列表API增强
原有的任务列表API需要返回子任务统计信息。

#### 新增返回字段
- `subtask_count` - 子任务总数
- `subtask_completed` - 已完成子任务数
- `has_subtasks` - 是否包含子任务

### Requirement: TaskCard组件增强
原有的TaskCard组件需要支持显示子任务信息。

#### 新增属性
- `subtaskCount?: number` - 子任务总数
- `subtaskCompleted?: number` - 已完成子任务数
- `showSubtaskPreview?: boolean` - 是否显示子任务预览

## REMOVED Requirements
无移除的需求。
