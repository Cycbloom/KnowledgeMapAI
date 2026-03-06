# 任务调度器拖拽功能测试 Spec

## Why
任务调度器是系统的核心功能模块，用户通过拖拽操作来管理任务在不同队列间的分配和排序。需要确保拖拽功能的流畅性、准确性和数据持久化的可靠性，以提供良好的用户体验。

## What Changes
- 新增 Playwright 测试文件，验证任务调度器的拖拽功能
- 新增 Page Object Model 文件，封装任务调度器页面元素和操作
- 新增测试辅助函数，支持拖拽操作和状态验证

## Impact
- Affected specs: 任务调度器功能测试覆盖
- Affected code: 
  - `tests/pages/SchedulerPage.ts` (新增)
  - `tests/utils/schedulerHelpers.ts` (新增)
  - `tests/scheduler-drag.spec.ts` (新增)

## ADDED Requirements

### Requirement: 任务卡片拖拽功能测试
系统 SHALL 提供完整的拖拽功能测试，验证任务在队列间移动和队列内排序的正确性。

#### Scenario: 同一队列内任务排序
- **WHEN** 用户在同一个队列内拖拽任务卡片到新位置
- **THEN** 任务顺序应立即更新
- **AND** API 应调用 reorderTasks 接口保存新顺序
- **AND** 页面刷新后任务顺序保持不变

#### Scenario: 跨队列移动任务
- **WHEN** 用户将任务卡片从一个队列拖拽到另一个队列
- **THEN** 任务应从源队列消失并出现在目标队列
- **AND** API 应调用 moveTask 接口更新任务队列级别
- **AND** 页面刷新后任务仍在目标队列中

#### Scenario: 拖拽到空队列
- **WHEN** 用户将任务拖拽到空队列
- **THEN** 任务应成功添加到该队列
- **AND** 队列应显示该任务

#### Scenario: 拖拽取消操作
- **WHEN** 用户开始拖拽任务但未放置到有效位置
- **THEN** 任务应返回原位置
- **AND** 不应触发任何 API 调用

### Requirement: 拖拽操作流畅性验证
系统 SHALL 验证拖拽操作的视觉反馈和交互流畅性。

#### Scenario: 拖拽视觉反馈
- **WHEN** 用户开始拖拽任务卡片
- **THEN** 被拖拽的卡片应有视觉高亮效果
- **AND** 目标队列应有高亮边框指示可放置区域
- **AND** 拖拽过程中应有 DragOverlay 显示

#### Scenario: 队列悬停状态
- **WHEN** 拖拽中的任务悬停在某个队列上方
- **THEN** 该队列应显示高亮边框
- **AND** 应有视觉提示表示可以放置

### Requirement: 队列状态实时更新验证
系统 SHALL 验证队列状态的实时更新能力。

#### Scenario: 任务计数更新
- **WHEN** 任务被移动到新队列
- **THEN** 源队列的任务计数应减少
- **AND** 目标队列的任务计数应增加
- **AND** 页面顶部的统计信息应同步更新

#### Scenario: 预计时长更新
- **WHEN** 带有预计时长的任务被移动
- **THEN** 源队列的预计总时长应减少
- **AND** 目标队列的预计总时长应增加

### Requirement: 数据持久化验证
系统 SHALL 验证拖拽操作后的数据持久化功能。

#### Scenario: 页面刷新后数据保持
- **WHEN** 用户完成拖拽操作后刷新页面
- **THEN** 任务应在正确的队列中
- **AND** 任务顺序应与拖拽后的顺序一致

#### Scenario: 多次连续拖拽
- **WHEN** 用户连续拖拽多个任务
- **THEN** 每次拖拽都应正确保存
- **AND** 最终状态应与操作序列一致

## Test Data Requirements

### 测试数据准备
- 需要在测试数据库中创建至少 3 个测试任务
- 任务分布在不同的队列中（Q0、Q1、Q2）
- 每个队列至少有一个任务用于排序测试

### 测试环境要求
- 需要登录测试账号
- 需要后端 API 服务正常运行
- 需要数据库服务正常运行
