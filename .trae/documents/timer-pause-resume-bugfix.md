# 修复计时器暂停/恢复 Bug 计划

## 问题概述

用户报告两个 bug：
1. **Scheduler 任务卡片点击暂停按钮后，面板直接消失**（而不是保持暂停状态）
2. **右下角悬浮球（FocusTimer）点击暂停后无法恢复**（再点没反应）

---

## 根因分析

### Bug #1：ActiveTaskPanel 暂停后面板消失

**调用链路：**
```
用户点击暂停 → handlePauseResume()
  ├─ useTimerStore.pause()        ← 正确：计时器暂停
  └─ onPause()                     ← 问题！调用父组件回调
       → handlePauseTask(task)
         → api.scheduler.pause(task.id)   ← 后端将任务 status 从 in_progress 改为 paused
           → invalidateTaskChange → React Query 重新获取
             → activeTask = allTasks.find(t => t.status === "in_progress") 返回 null
               → {activeTask && <ActiveTaskPanel />} 条件不满足 → 面板卸载
```

**根因**：`ActiveTaskPanel.tsx:92-99` 的 `handlePauseResume()` 在每次点击时都调用 `onPause()` 回调，该回调会通过 API 将任务状态改为 `paused`，导致 `activeTask` 派生值为 null，面板被条件渲染卸载。

### Bug #2：FocusTimer / MobileFocusTimer 暂停后无法恢复

**FocusTimer.tsx:60-68 的判断逻辑：**
```typescript
const handleStartPause = () => {
  if (isActive) {              // ← 问题：只看 isActive，不看 isPaused
    useTimerStore.getState().pause();
  } else {
    useTimerStore.getState().resume();
  }
};
```

**状态变化过程：**
```
运行中: { isActive: true,  isPaused: false }
  点击 → pause() → { isActive: true,  isPaused: true }
  再次点击 → if(isActive)=true → 调用 pause() → store 守卫 return（已暂停）→ 什么都没发生
  永远无法进入 else 分支调用 resume()！
```

**根因**：代码用 `isActive` 判断是否在运行，但 `pause()` 不改变 `isActive`（只设 `isPaused=true`），所以暂停后永远走 `if (isActive)` 分支。正确做法是使用 `isActive && !isPaused` 判断是否正在运行。

**MobileFocusTimer.tsx:137-143 和 :179-187 有完全相同的问题。**

---

## 修复方案

### Fix #1：ActiveTaskPanel — 暂停时不触发任务级 API 暂停

**文件**: [ActiveTaskPanel.tsx](src/components/Scheduler/ActiveTaskPanel.tsx)

**修改内容**：
- `handlePauseResume()` 中移除无条件调用 `onPause()` 的逻辑
- 暂停/恢复只操作计时器 store，不改变任务的后端状态
- 如果未来需要任务级暂停功能，应作为独立按钮提供，而非与计时器暂停绑定

```typescript
// 修改前 (第 92-99 行)
const handlePauseResume = () => {
  if (isActive) {
    pause();
  } else {
    resume();
  }
  onPause();  // ← 移除这行
};
```

```typescript
// 修改后
const handlePauseResume = () => {
  if (isActive && !isPaused) {
    pause();
  } else if (!isActive || isPaused) {
    resume();
  }
  // 不再调用 onPause() — 计时器暂停不应影响任务状态
};
```

同时修复按钮的显示逻辑（第 224 行和 231 行），使其也考虑 `isPaused`：

```typescript
// 按钮样式： isActive && !isPaused 时显示暂停态（琥珀色）
className={`... ${
  isActive && !isPaused
    ? "bg-amber-100 ..."   // 正在运行 → 显示暂停按钮
    : "bg-primary-100 ..." // 已暂停或未开始 → 显示播放按钮
}`}

// 图标：同上
{isActive && !isPaused ? <Pause size={20} /> : <Play size={20} />}
```

### Fix #2：FocusTimer — 使用 isRunning 判断

**文件**: [FocusTimer.tsx](src/components/common/FocusTimer.tsx)

**修改 1**：添加 `isPaused` 订阅（第 38-42 行区域）

```typescript
// 新增
const isPaused = useTimerStore((s) => s.isPaused);
const isRunning = isActive && !isPaused;
```

**修改 2**：修复 `handleStartPause`（第 60-68 行）

```typescript
const handleStartPause = () => {
  if (isRunning) {
    useTimerStore.getState().pause();
  } else if (timeLeft === focusDuration * 60 && mode === "focus") {
    useTimerStore.getState().start("manual", focusDuration);
  } else {
    useTimerStore.getState().resume();
  }
};
```

**修改 3**：修复主按钮图标和颜色（第 320-333 行）

```typescript
<button
  onClick={handleStartPause}
  className={`... ${
    isRunning
      ? "bg-amber-100 text-amber-600 hover:bg-amber-200"
      : "bg-primary-600 text-white hover:bg-primary-700"
  }`}
>
  {isRunning ? (
    <Pause size={28} fill="currentColor" />
  ) : (
    <Play size={28} fill="currentColor" className="ml-1" />
  )}
</button>
```

**修改 4**：修复迷你视图的状态文字（第 129 行）

```typescript
{isRunning && (
  <span className="text-[10px] ...">
    {t("focusTimer.inProgress")}...
  </span>
)}
```

**修改 5**：修复展开视图的状态文字（第 303 行）

```typescript
<span className="text-sm text-gray-400 mt-1">
  {isRunning
    ? mode === "focus"
      ? t("focusTimer.inProgress")
      : t("focusTimer.breakInProgress")
    : t("focusTimer.paused")}
</span>
```

### Fix #3：MobileFocusTimer — 同样修复

**文件**: [MobileFocusTimer.tsx](src/components/common/MobileFocusTimer.tsx)

与 FocusTimer 相同的模式，需要检查并修复：
1. 双击处理中的 `isActive` 判断（第 137 行）
2. `handleStartPause` 中的 `isActive` 判断（第 180 行）
3. 所有按钮图标渲染处的 `isActive` 判断
4. 添加 `isPaused` 订阅和 `isRunning` 派生值

---

## 涉及文件清单

| 文件 | 修改类型 |
|------|---------|
| `src/components/Scheduler/ActiveTaskPanel.tsx` | 修复暂停逻辑 + UI 状态判断 |
| `src/components/common/FocusTimer.tsx` | 添加 isPaused 订阅 + 修复暂停/恢复判断 |
| `src/components/common/MobileFocusTimer.tsx` | 同上 |

## 验证步骤

1. `npm run check` 类型检查通过
2. `npm run lint` 通过
3. 手动验证场景：
   - Scheduler 任务卡片：点击暂停 → 面板保持可见，计时器暂停，显示 Play 图标 → 点击继续 → 计时器恢复
   - 悬浮球（FocusTimer）：点击暂停 → 图标变为 Play → 再次点击 → 计时器恢复
   - MobileFocusTimer：双击暂停 → 可恢复
