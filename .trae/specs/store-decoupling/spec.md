# Store 间解耦 Spec

## Why
当前 `useFocusStore` 和 `useTimerStore` 存在直接引用其他 Store 的隐式耦合：
- `useFocusStore` 在 `exitFocusMode` 中直接调用 `useNoiseStore.getState().setNoise("none")`
- `useTimerStore` 在 6 处直接调用 `useFocusStore.getState()` 读取专注设置

这种耦合违反了单向数据流原则，Store 之间不应直接互相引用。应通过 `frontendEventBus` 事件驱动解耦。

## What Changes
- 移除 `useFocusStore` → `useNoiseStore` 的直接引用，改为事件驱动
- 移除 `useTimerStore` → `useFocusStore` 的直接引用，TimerStore 维护自己的专注设置副本
- 在 `useFocusStore` 中发布 `focus_exit` 和 `focus_settings_changed` 事件
- 新增 `storeIntegrations.ts` 统一管理 Store 间的事件协调
- 移除 `LearningMode.tsx` 中冗余的 `focus_exit` 发布

## Impact
- Affected specs: 无
- Affected code: `src/store/useFocusStore.ts`, `src/store/useTimerStore.ts`, `src/services/FrontendEventTypes.ts`, `src/pages/LearningMode.tsx`, `src/store/storeIntegrations.ts` (新增)

## MODIFIED Requirements

### Requirement: Focus Store 退出专注模式
当用户退出专注模式时，系统 SHALL 通过 `frontendEventBus` 发布 `focus_exit` 事件，而非直接调用 `useNoiseStore`。

#### Scenario: 退出专注模式时发布事件
- **WHEN** 调用 `exitFocusMode()`
- **THEN** 系统设置 `isInFocusMode: false`
- **AND** 系统通过 `frontendEventBus.publish("focus_exit", { nodeId })` 发布事件
- **AND** 系统不再直接调用 `useNoiseStore.getState().setNoise("none")`

### Requirement: Focus Store 设置变更时同步事件
当用户修改专注设置时，系统 SHALL 通过 `frontendEventBus` 发布 `focus_settings_changed` 事件。

#### Scenario: 更新专注设置
- **WHEN** 调用 `updateSettings({ focusDuration: 30 })`
- **THEN** 系统更新设置
- **AND** 系统通过 `frontendEventBus.publish("focus_settings_changed", settings)` 发布事件

### Requirement: Timer Store 维护自己的专注设置副本
TimerStore SHALL 维护自己的专注设置副本，通过 `syncFocusSettings` 动作同步，而非直接读取 `useFocusStore`。

#### Scenario: TimerStore 使用自己的设置
- **WHEN** TimerStore 需要获取 `focusDuration` 等设置
- **THEN** 从自身状态中的 `focusSettings` 读取
- **AND** 不再从 `useFocusStore.getState()` 读取

#### Scenario: 专注设置变更时同步到 TimerStore
- **WHEN** `frontendEventBus` 发布 `focus_settings_changed` 事件
- **THEN** `storeIntegrations` 模块调用 `useTimerStore.getState().syncFocusSettings(settings)` 同步设置

### Requirement: Store 集成模块
系统 SHALL 提供 `storeIntegrations.ts` 模块，统一管理 Store 间的事件协调。

#### Scenario: 退出专注模式时重置白噪音
- **WHEN** `frontendEventBus` 发布 `focus_exit` 事件
- **THEN** `storeIntegrations` 模块调用 `useNoiseStore.getState().setNoise("none")`

#### Scenario: 专注设置变更时同步 TimerStore
- **WHEN** `frontendEventBus` 发布 `focus_settings_changed` 事件
- **THEN** `storeIntegrations` 模块调用 `useTimerStore.getState().syncFocusSettings(settings)`

## REMOVED Requirements

### Requirement: useFocusStore 直接引用 useNoiseStore
**Reason**: 违反 Store 间不应互相引用的原则
**Migration**: `exitFocusMode` 改为发布 `focus_exit` 事件，由 `storeIntegrations` 处理噪音重置

### Requirement: useTimerStore 直接引用 useFocusStore
**Reason**: 违反 Store 间不应互相引用的原则
**Migration**: TimerStore 维护自己的 `focusSettings` 副本，通过 `syncFocusSettings` 同步