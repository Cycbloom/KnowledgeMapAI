# Store 解耦修改审查报告

## 审查结果：修改基本完整，发现 2 个小问题

### 已验证通过的检查项

1. **`useFocusStore` 不再 import `useNoiseStore`** — 通过
2. **`useFocusStore.exitFocusMode` 通过事件发布** — 通过
3. **`useFocusStore.updateSettings` 通过事件发布** — 通过
4. **`useTimerStore` 不再 import `useFocusStore` 实例** — 通过（仅保留 `DEFAULT_SETTINGS` 常量导入）
5. **`useTimerStore` 维护 `focusSettings` 副本** — 通过
6. **`useTimerStore.syncFocusSettings` 动作** — 通过
7. **`storeIntegrations.ts` 事件订阅** — 通过
8. **`LearningMode.tsx` 冗余 `focus_exit` 已移除** — 通过
9. **`storeIntegrations` 在 `main.tsx` 中加载** — 通过
10. **`FrontendEventTypes.ts` 新增事件类型** — 通过
11. **Store 间无直接 Store 实例 import** — 通过
12. **`npm run check` 类型检查通过** — 通过
13. **无消费者依赖被移除的 re-export** — 通过（`WhiteNoiseType` 等类型无人从 `useFocusStore` 导入）

### 发现的问题

#### 问题 1：`TimerMode` 类型从 `useFocusStore` re-export，2 个文件依赖此 re-export

**文件**：
- `src/components/common/FocusTimer.tsx:3` — `import { useFocusStore, TimerMode } from "../../store/useFocusStore"`
- `src/components/common/MobileFocusTimer.tsx:4` — `import { useFocusStore, TimerMode } from "../../store/useFocusStore"`

**现状**：`useFocusStore.ts` 仍然 re-export `TimerMode`：
```typescript
import type { TimerMode } from "@shared/types";
export type { TimerMode };
```

**问题**：`TimerMode` 实际定义在 `@shared/types`，从 `useFocusStore` re-export 没有语义上的关联。`TimerMode` 是计时器模式类型，应从 `@shared/types` 或 `useTimerStore` 导入，而非 `useFocusStore`。

**建议修复**：
- 将 `FocusTimer.tsx` 和 `MobileFocusTimer.tsx` 中的 `TimerMode` 导入改为 `import type { TimerMode } from "@shared/types"`
- 移除 `useFocusStore.ts` 中的 `TimerMode` re-export

#### 问题 2：`FocusMode.tsx` 组件级 `focus_exit` 事件与 Store 级事件可能重复触发

**文件**：`src/components/Scheduler/FocusMode.tsx:41`

**现状**：
```typescript
useEffect(() => {
  if (isOpen) {
    startMixer();
    if (taskId && !isActive) useTimerStore.getState().start(taskId, 25);
    frontendEventBus.publish("focus_enter", { taskId });
  } else {
    stopMixer();
    frontendEventBus.publish("focus_exit", {});  // ← 组件级发布
  }
}, [isOpen, startMixer, stopMixer, taskId, isActive]);
```

**分析**：`FocusMode` 组件在关闭时发布 `focus_exit` 事件，而 `useFocusStore.exitFocusMode()` 也会发布 `focus_exit` 事件。如果两者同时被调用，`storeIntegrations.ts` 中的噪音重置会被触发两次。

**影响**：`setNoise("none")` 是幂等操作，双重触发不会产生 bug，但语义上不够清晰。

**建议**：这是组件级行为（FocusMode 组件有自己的开/关生命周期），与 Store 的 `exitFocusMode` 是不同层面的事件源。当前行为是可接受的，无需修改。如果未来需要严格去重，可在 `storeIntegrations.ts` 中加防抖。

### 不需要修改的项

- **`Scheduler.tsx:366`** 和 **`messageHelper.ts:43`** 中的 `useFocusStore.getState()` — 这些是组件/工具函数读取 Store 状态，属于正常模式，不是 Store 间耦合
- **`useWhiteNoise.ts:121`** 中的 `useNoiseStore.getState()` — Hook 读取 Store 状态，正常模式
- **`FocusMode.tsx` 中的 `useTimerStore.getState()`** — 组件读取 Store 状态，正常模式

### 修复计划

仅修复问题 1（`TimerMode` re-export），问题 2 无需修改。

#### 修改文件

1. **`src/store/useFocusStore.ts`**：移除 `TimerMode` 的 import 和 re-export
2. **`src/components/common/FocusTimer.tsx`**：`TimerMode` 改从 `@shared/types` 导入
3. **`src/components/common/MobileFocusTimer.tsx`**：`TimerMode` 改从 `@shared/types` 导入

#### 验证

- `npm run check` 类型检查通过
- `npm run lint` 代码检查通过
