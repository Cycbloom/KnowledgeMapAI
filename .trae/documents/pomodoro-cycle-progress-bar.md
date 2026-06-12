# 专注模式：用"番茄周期进度条"替代"模式切换标签"

## 问题

右下角悬浮球（FocusTimer）和移动端（MobileFocusTimer）有三个模式标签：专注 / 小憩 / 长休。点击任意标签会调用 `setMode()`，该方法**完全重置计时器**——清空进度、停止倒计时、丢失已用时间。用户误触标签就会丢失专注进度。

## 方案

用**番茄周期进度条**（类似地铁线路图）替代三个模式标签：

```
●──○──●──○──●──○──●──○
专  短  专  短  专  短  专  长
```

- 当前阶段高亮 + 倒计时显示
- 已完成阶段用实心圆/勾号
- 未来阶段灰色
- **不允许随意切换模式**，只提供"跳到下一站"按钮
- 符合番茄工作法"一个番茄不可分割"原则

## 参考依据

- Pomodo.io：用进度点（dots）显示周期，只提供 Next/Rewind 按钮
- iOS Pomodoro — Focus Timer：Start/Pause/Stop/Restart，Reset 需二次确认
- 番茄工作法原则：专注阶段不可中断，休息是专注的奖励而非可选操作

---

## 具体修改

### 1. 新建 `src/components/common/PomodoroCycleBar.tsx`

独立的番茄周期进度条组件，供 FocusTimer / MobileFocusTimer / LearningFocusPanel 复用。

**Props：**
```ts
interface PomodoroCycleBarProps {
  mode: TimerMode;
  completedSessions: number;
  longBreakInterval?: number; // 默认 4
  size?: "sm" | "md"; // sm 用于悬浮球，md 用于面板
}
```

**视觉设计（sm 尺寸，悬浮球用）：**
- 水平排列 8 个小圆点（4 专注 + 3 短休 + 1 长休），用细线连接
- 已完成：实心绿色圆 + 勾号
- 当前：脉冲动画 + 模式对应颜色（蓝=专注，绿=短休，紫=长休）
- 未来：灰色空心圆
- 圆点下方可显示极小文字（专/休/长），或仅用颜色区分

**视觉设计（md 尺寸，面板用）：**
- 同上但圆点更大，下方显示文字标签
- 当前阶段圆点旁显示倒计时

**周期计算逻辑：**
```ts
// 生成当前周期的站点列表
function getCycleStations(completedSessions: number, longBreakInterval: number) {
  const stations = [];
  for (let i = 0; i < longBreakInterval; i++) {
    stations.push({ type: "focus", index: i });
    if (i < longBreakInterval - 1) {
      stations.push({ type: "shortBreak", index: i });
    }
  }
  stations.push({ type: "longBreak", index: 0 });
  return stations;
  // 例：[专注0, 短休0, 专注1, 短休1, 专注2, 短休2, 专注3, 长休]
}
```

当前站索引 = 根据 `completedSessions % longBreakInterval` 和 `mode` 计算。

### 2. 修改 `src/store/useTimerStore.ts`

**2a. 修改 `skipToBreak` → 重命名为 `skipToNext`**

当前 `skipToBreak` 只处理 focus→break 和 break→focus 两种情况，且不保存专注记录。改为：

```ts
skipToNext: async () => {
  const { totalTime, timeLeft, taskId, mode, completedSessions, startTimeRef } = get();

  // 保存当前阶段的记录（即使未完成）
  const elapsedDuration = totalTime - timeLeft;
  if (elapsedDuration > 60) { // 至少 1 分钟才保存
    await saveFocusSession(taskId, startTimeRef, elapsedDuration, completedSessions, mode);
    await tickTaskExecution(taskId, mode, elapsedDuration);
  }

  // 计算下一阶段
  const newCompletedSessions = mode === "focus" ? completedSessions + 1 : completedSessions;
  const transition = transitionToNextMode(mode, newCompletedSessions);

  clearTimerInterval();
  set({ completedSessions: newCompletedSessions, ...transition });
  startInterval();
}
```

**2b. 标记 `setMode` 为 @deprecated**

在接口和实现上添加 `@deprecated Use skipToNext() instead` 注释。保留实现但不再从 UI 调用。

**2c. 修改 `reset` action**

当前 `reset` 调用 `setMode`，改为直接重置当前模式：

```ts
reset: () => {
  clearTimerInterval();
  const { mode } = get();
  const { focusDuration, shortBreakDuration, longBreakDuration } = useFocusStore.getState();
  let duration = focusDuration;
  if (mode === "shortBreak") duration = shortBreakDuration;
  if (mode === "longBreak") duration = longBreakDuration;
  const totalTime = duration * 60;
  set({
    timeLeft: totalTime,
    totalTime,
    isActive: false,
    isPaused: false,
    startTimeRef: null,
    progress: 0,
  });
}
```

### 3. 修改 `src/components/common/FocusTimer.tsx`

**3a. 移除三个模式标签**

删除第 253-268 行的 tabs 区域：
```tsx
// 删除这段
<div className="flex p-1 bg-gray-100 dark:bg-slate-700 rounded-xl mb-6 w-full">
  {(["focus", "shortBreak", "longBreak"] as TimerMode[]).map((m) => (...))}
</div>
```

**3b. 替换为 PomodoroCycleBar**

```tsx
<PomodoroCycleBar
  mode={mode}
  completedSessions={completedSessions}
  size="sm"
/>
```

**3c. 修改 handleReset**

```ts
const handleReset = () => {
  useTimerStore.getState().reset(); // 不再调用 setMode(mode)
};
```

**3d. 保留 handleSkip（跳到下一站）**

已有 `skipToBreak` 按钮（SkipForward 图标），改为调用 `skipToNext`：
```ts
const handleSkip = () => {
  useTimerStore.getState().skipToNext();
};
```

**3e. 在计时器显示区域添加当前模式标签**

在圆形进度环上方或倒计时数字下方，显示当前阶段名称（专注/小憩/长休），让用户知道当前处于哪个阶段。

### 4. 修改 `src/components/common/MobileFocusTimer.tsx`

与 FocusTimer 相同的修改：
- 移除第 260-277 行的三个模式按钮
- 替换为 `<PomodoroCycleBar mode={mode} completedSessions={completedSessions} size="sm" />`
- handleReset 改为调用 `reset()`
- handleSkip 改为调用 `skipToNext()`

### 5. 修改 `src/components/Learning/LearningFocusPanel.tsx`

- 移除第 442-457 行的 focus/shortBreak 切换按钮
- 替换为 `<PomodoroCycleBar mode={mode} completedSessions={completedSessions} size="md" />`
- 保留"跳到下一站"按钮

### 6. 添加 i18n 翻译

在 `src/i18n/locales/zh-CN.json` 和 `en-US.json` 中添加：

```json
{
  "focusTimer": {
    "skipToNext": "跳到下一站 / Skip to next",
    "currentPhase": "当前阶段",
    "cycleProgress": "周期进度"
  }
}
```

### 7. 清理

- 从 FocusTimer / MobileFocusTimer 中移除 `setMode` 的调用
- 确认 `setMode` 仅在 `reset` 内部使用（已改为直接实现），无其他 UI 调用点
- 运行 `npm run check` 和 `npm run lint`

---

## 不修改的部分

- `FocusMode.tsx`（全屏专注模式）— 不含模式切换标签，无需修改
- `BreakTimer.tsx`（休息弹窗）— 仅显示重置按钮，改为调用 `reset()` 即可
- `MiniTimer.tsx`（调度器迷你计时器）— 纯展示组件，无模式切换
- `useFocusStore.ts` — 专注模式配置不变

---

## 验证步骤

1. `npm run check` 类型检查通过
2. `npm run lint` 代码规范通过
3. 悬浮球展开后：无模式标签，有周期进度条 + 跳到下一站按钮
4. 点击"跳到下一站"：保存当前进度，自动开始下一阶段
5. 点击"重置"：当前阶段倒计时归零但不切换模式
6. 完成一个专注阶段后：自动切换到休息，进度条更新
7. 完成 4 个专注阶段后：自动切换到长休
8. 移动端和学习面板同样验证
