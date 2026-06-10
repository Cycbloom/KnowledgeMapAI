# 智能推荐与任务执行增强：子任务级学习引导 Spec

## Why

当前智能推荐和任务执行系统只关注**主任务级别**，但学习型任务（如"学习图谱：量子计算入门"）的核心价值在于其**子任务**（每个子任务对应一个知识点节点）。用户希望：

1. 智能推荐栏不仅显示主任务名称，更要体现**当前应该学习的具体子任务**
2. 点击"开始任务"后，应按**子任务逐个推进**，而非笼统地标记主任务为进行中
3. 进行中的任务面板应展示**当前活跃子任务**信息，让用户明确知道正在学什么

## What Changes

### 1. 后端：智能推荐 API 返回子任务摘要
- `getSmartRecommendation` 接口在返回 `recommendedTask.task` 时，额外查询并附加该任务的**下一个待做子任务**（first pending subtask）和**子任务进度概览**
- 新增字段：`nextSubtask: { id, title, learning_state, mastery_level, position }`、`subtaskProgress: { total, completed, current }`

### 2. 前端：SmartRecommendationBar UI 增强
- 当推荐的任务有子任务时，在主任务标题下方展示**当前推荐子任务**的标题和学习状态 badge
- 展示子任务进度条（如 "子任务 3/8"）
- "开始任务"按钮文案根据是否有子任务动态调整（有子任务 → "开始学习"，无子任务 → "开始任务"）

### 3. 前端：任务启动逻辑增强
- `handleStartTask` 在启动主任务（status → in_progress）的同时，自动将第一个 pending 子任务标记为 `in_progress`
- 如果所有子任务已完成，则仅启动主任务

### 4. 前端：ActiveTaskPanel 增强
- 当活动任务有子任务时，在面板中展示**当前活跃子任务**区域：
  - 当前子任务标题 + 学习状态 badge + 掌握度进度条
  - "完成此子任务" / "跳到下一子任务" 操作按钮
  - 子任务列表概览（可折叠）

## Impact

- Affected specs: 无直接关联已有 spec
- Affected code:
  - `api/services/scheduler/taskRecommendationService.ts` — getSmartRecommendation 方法扩展
  - `src/components/Scheduler/SmartRecommendationBar.tsx` — UI 增强
  - `src/pages/Scheduler.tsx` — handleStartTask 逻辑增强、activeTask 状态管理
  - `src/components/Scheduler/ActiveTaskPanel.tsx` — 子任务展示增强
  - `src/services/api/modules/scheduler/tasks.ts` — 可能新增 API 调用方法

## ADDED Requirements

### Requirement: 智能推荐展示当前推荐子任务

系统 SHALL 在智能推荐结果中包含任务的下一个待做子任务信息。

#### Scenario: 推荐有子任务的学习任务
- **WHEN** 智能推荐算法推荐了一个拥有子任务的学习型任务
- **THEN** SmartRecommendationBar 展示：
  - 主任务标题（如"学习图谱：量子计算入门"）
  - 当前推荐子任务标题（如"量子比特基础"）
  - 子任务学习状态 badge（learning/review/practice/quiz）
  - 子任务整体进度（如 "3/8 已完成"）
  - "开始学习"按钮（替代"开始任务"）

#### Scenario: 推荐无子任务的普通任务
- **WHEN** 推荐的任务没有子任务
- **THEN** 行为保持不变，展示原有 UI

### Requirement: 启动任务时自动激活首个待做子任务

系统 SHALL 在用户点击"开始任务/开始学习"时，自动将第一个 pending 状态的子任务标记为 in_progress。

#### Scenario: 有待做子任务时启动
- **WHEN** 用户对有 pending 子任务的任务点击"开始"
- **THEN** 系统依次执行：
  1. 主任务 status → in_progress
  2. 第一个 pending 子 task（按 position 排序）status → in_progress
  3. ActiveTaskPanel 显示该子任务为当前活跃子任务

#### Scenario: 所有子任务已完成时启动
- **WHEN** 用户对所有子任务已完成的任务点击"开始"
- **THEN** 仅标记主任务为 in_progress，不操作子任务

### Requirement: ActiveTaskPanel 展示当前活跃子任务

系统 SHALL 在 ActiveTaskPanel 中展示当前正在进行的子任务信息。

#### Scenario: 活动任务有活跃子任务
- **WHEN** 存在 status=in_progress 的活动任务，且该任务有 status=in_progress 的子任务
- **THEN** ActiveTaskPanel 在主任务信息下方展示：
  - 当前子任务标题 + 学习状态 badge
  - 掌握度进度条
  - "完成此子任务"按钮（调用子任务 complete API）
  - 可折叠的子任务列表概览（显示所有子任务及状态）

#### Scenario: 完成当前子任务
- **WHEN** 用户点击"完成此子任务"
- **THEN** 系统将当前子任务标记为 completed，并自动激活下一个 pending 子任务；若无更多 pending 子任务则提示用户

## MODIFIED Requirements

### Requirement: 智能推荐 API 返回值扩展

修改后的 `getSmartRecommendation` 返回值的 `recommendedTask.task` 对象 SHALL 包含以下新增字段：

```typescript
{
  // ... 原有字段 ...
  nextSubtask: {                    // 下一个待做子任务（可选）
    id: string;
    title: string;
    learning_state: LearningState;
    mastery_level: number;          // 0-100
    position: number;
    estimated_duration?: number;
  } | null;
  subtaskProgress: {                // 子任务进度概览
    total: number;                  // 总数
    completed: number;              // 已完成数
  } | null;                         // 无子任务时为 null
}
```
