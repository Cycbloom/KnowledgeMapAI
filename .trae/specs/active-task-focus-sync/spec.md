# 进行中任务与番茄钟同步功能

## Why

当前任务调度器存在以下问题：

1. **暂停后任务消失**：用户点击暂停后，任务从队列中消失，因为 `visibleTasks` 只包含 `in_progress` 和 `pending` 状态，没有包含 `paused` 状态
2. **进行中任务无倒计时**：进行中的任务没有与全局番茄钟同步，用户无法看到剩余时间
3. **进行中任务无特殊展示**：没有专门区域展示当前正在进行的任务
4. **进行中任务可拖动**：进行中的任务应该禁止拖动，需要先暂停才能移动

## What Changes

- **修复暂停任务消失问题**：将 `paused` 状态的任务也显示在队列中
- **新增当前任务展示区**：在队列上方添加专门区域展示当前进行中的任务
- **番茄钟同步**：进行中任务的倒计时与全局番茄钟一对一同步
- **禁止拖动进行中任务**：进行中的任务不可拖动，显示提示信息

## Impact

- Affected specs: 任务调度器核心功能
- Affected code:
  - `src/components/Scheduler/HorizontalQueue.tsx` - 修复暂停任务显示，禁止拖动进行中任务
  - `src/components/Scheduler/DraggableTaskCard.tsx` - 禁止拖动进行中任务
  - `src/pages/Scheduler.tsx` - 添加当前任务展示区
  - `src/store/useFocusStore.ts` - 番茄钟状态管理
  - `src/components/FocusTimer.tsx` - 番茄钟组件

---

## ADDED Requirements

### Requirement: 当前任务展示区

系统 SHALL 在队列视图顶部提供专门区域展示当前进行中的任务。

#### Scenario: 显示当前任务

- **WHEN** 有任务处于 `in_progress` 状态
- **THEN** 系统应在队列上方显示"当前任务"区域
- **AND** 显示任务标题、描述、预计时长
- **AND** 显示倒计时（与番茄钟同步）
- **AND** 显示暂停和完成按钮

#### Scenario: 无进行中任务

- **WHEN** 没有任务处于 `in_progress` 状态
- **THEN** 系统应隐藏"当前任务"区域
- **OR** 显示"选择一个任务开始"提示

### Requirement: 番茄钟同步

系统 SHALL 将进行中任务的倒计时与全局番茄钟同步。

#### Scenario: 开始任务时同步

- **WHEN** 用户开始一个任务
- **THEN** 番茄钟应自动启动
- **AND** 番茄钟时间应等于任务所在队列的时间片
- **AND** 当前任务区域显示倒计时

#### Scenario: 暂停任务时同步

- **WHEN** 用户暂停任务
- **THEN** 番茄钟应暂停
- **AND** 剩余时间应保存

#### Scenario: 完成任务时同步

- **WHEN** 用户完成任务
- **THEN** 番茄钟应停止
- **AND** 记录本次专注时长

### Requirement: 禁止拖动进行中任务

系统 SHALL 禁止用户拖动处于 `in_progress` 状态的任务。

#### Scenario: 尝试拖动进行中任务

- **WHEN** 用户尝试拖动进行中的任务
- **THEN** 系统应阻止拖动
- **AND** 显示提示消息"请先暂停任务再移动"

#### Scenario: 拖动暂停的任务

- **WHEN** 用户拖动处于 `paused` 状态的任务
- **THEN** 系统应允许拖动
- **AND** 任务可移动到其他队列

---

## MODIFIED Requirements

### Requirement: 队列任务显示

队列 SHALL 显示 `pending`、`in_progress` 和 `paused` 状态的任务。

#### 原有逻辑

```tsx
const visibleTasks = [...inProgressTasks, ...pendingTasks];
```

#### 修改后逻辑

```tsx
const pausedTasks = tasks.filter(t => t.status === 'paused');
const visibleTasks = [...inProgressTasks, ...pausedTasks, ...pendingTasks];
```

---

## 技术设计

### 1. 当前任务展示区组件

```tsx
interface ActiveTaskPanelProps {
  task: ScheduledTask;
  remainingTime: number;
  onPause: () => void;
  onComplete: () => void;
}
```

### 2. 番茄钟同步逻辑

- 使用 `useFocusStore` 管理番茄钟状态
- 开始任务时，设置 `taskId` 和 `duration`
- 暂停/完成时，更新番茄钟状态

### 3. 拖动限制

- 在 `DraggableTaskCard` 中检查任务状态
- 如果 `status === 'in_progress'`，设置 `isDragDisabled={true}`
- 显示拖动禁用提示
