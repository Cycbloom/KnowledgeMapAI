# ActiveTaskPanel 增强：计时器修复 + 点击导航 + UI 丰富

## Summary

ActiveTaskPanel 存在 3 个核心问题：
1. **倒计时显示 00:00** — `handleStartTask` 未调用 `timerService.start()`，计时器从未初始化
2. **无法点击进入详情** — 面板区域没有导航到 `/scheduler/task/:taskId` 的点击事件
3. **UI 过于简陋** — 子任务信息条件隐藏、缺少进度概览等

## Current State Analysis

### 问题 1：计时器 00:00
- [useUnifiedTimer.ts](src/hooks/scheduler/useUnifiedTimer.ts) 的 `start(taskId, duration, queueLevel?)` 方法存在但从未被调用
- [Scheduler.tsx#L354-367](src/pages/Scheduler.tsx#L354) `handleStartTask` 只调了 `startTaskMutation.mutateAsync()` + 激活子任务，**没有启动计时器**
- ActiveTaskPanel 接收了 `timeSlice` prop（来自 `activeTaskTimeSlice`，即 Q1/Q2/Q3 对应的时长），但命名为 `_timeSlice`（未使用）
- 结果：`timeLeft` 初始值为 timerService 默认值 0 → 显示 00:00

### 问题 2：无法点击导航
- ActiveTaskPanel 内部无任何 onClick 导航逻辑
- Scheduler 页面有 `navigate` 函数和路由 `/scheduler/task/${task.id}`（第 401 行用于"查看详情"按钮）
- 但面板本身不可点击

### 问题 3：UI 简陋
- 子任务区域仅在 `activeSubtaskId && currentActiveSubtask` 同时满足时才渲染，否则完全空白
- 缺少子任务进度概览（如 "1/5 子任务"）
- 整体缺少可交互的视觉引导

## Proposed Changes

### 改动 1：修复计时器（[Scheduler.tsx](src/pages/Scheduler.tsx)）

在 `handleStartTask` 中，任务启动成功后调用 `timerService.start()`：

```typescript
// handleStartTask 中，mutation 成功后添加：
const duration = activeTaskTimeSlice * 60; // 分钟转秒
timerService.start(task.id, duration, task.queue_level);
```

需要 import timerService。同时确保 ActiveTaskPanel 使用传入的 timeSlice 来初始化。

**具体位置**：Scheduler.tsx 第 354-367 行的 `handleStartTask` 函数

### 改动 2：面板可点击导航（[ActiveTaskPanel.tsx](src/components/Scheduler/ActiveTaskPanel.tsx)）

2a. 新增 `onViewDetail` 可选 props：
```typescript
interface ActiveTaskPanelProps {
  // ...existing
  onViewDetail?: () => void;  // 新增
}
```

2b. 将整个面板主内容区包裹为可点击区域：
```tsx
<div className="flex items-center gap-4 cursor-pointer hover:opacity-90 transition-opacity"
     onClick={onViewDetail}>
  {/* 图标 + 标题 + 描述 */}
</div>
```

2c. Scheduler.tsx 传递回调：
```tsx
<ActiveTaskPanel
  ...
  onViewDetail={() => navigate(`/scheduler/task/${activeTask.id}`)}
/>
```

### 改动 3：UI 丰富化（[ActiveTaskPanel.tsx](src/components/Scheduler/ActiveTaskPanel.tsx)）

3a. 始终显示子任务进度概览（即使没有活跃子任务）：
- 在标题下方增加一行：`子任务：已完成数/总数`
- 数据来源：已有的 `subtasks` state

3b. 当有活跃子任务时，保持现有的详细子任务区域不变

3c. 计时器状态文字优化：
- `isActive ? "专注中..." : "已暂停"` → 未启动时显示"准备开始"

## Assumptions & Decisions
- `activeTaskTimeSlice` 单位为分钟（从 timeSlices 配置推断），需乘以 60 转秒传给 timerService
- timerService.start() 是同步操作，不需要 await
- 点击面板主体区域导航，按钮区域不触发导航（避免误触）

## Verification Steps
1. 从智能推荐点击"开始学习" → ActiveTaskPanel 出现 → 倒计时应立即开始走动（非 00:00）
2. 点击面板标题/图标区域 → 应跳转到 `/scheduler/task/:id` 详情页
3. 点击暂停/完成按钮 → 不应触发导航
4. 子任务进度始终可见
5. TypeScript 编译通过
