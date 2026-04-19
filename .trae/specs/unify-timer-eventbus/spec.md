# 统一时间管理与事件总线集成 Spec

## Why

项目中存在多个独立的倒计时实现（`useUnifiedTimer` 各组件各自实例化、`BreakTimer` 独立 setInterval、`useFocusStore.tick()` 残留逻辑），导致各模块时间不同步、资源浪费，且无法通过统一的事件总线实现模块间协作。需要建立唯一时间源，通过前端事件总线统一调度所有时间相关功能。

## 架构设计：前端事件总线 vs 后端事件总线

项目已有后端事件总线 `AppEventBus`（`api/services/core/eventBus.ts`），但它运行在 Node.js 服务器进程中，前端浏览器无法直接调用。两者职责不同：

| 维度 | 前端事件总线（新建） | 后端事件总线（已有） |
|------|---------------------|---------------------|
| 运行环境 | 浏览器 | Node.js 服务器 |
| 通信方式 | 内存中直接调用 | 内存中直接调用 |
| 适用场景 | 计时器 tick、UI 状态同步 | 数据持久化、跨服务协调 |
| 延迟 | 微秒级 | 不可用于前端实时交互 |
| 桥接方式 | 计时器完成时通过 API 调用后端 → 后端发布事件 → SSE 推送回前端 | - |

**为什么不能直接用后端事件总线？** 计时器每秒 tick 一次，如果每次都走网络请求到后端，延迟和带宽都不可接受。暂停/恢复等操作需要即时响应，不能等网络往返。因此计时器相关事件必须在前端本地处理，仅在关键节点（计时完成、保存会话）与后端交互。

## What Changes

- 创建前端事件总线（`FrontendEventBus`），作为前端模块间通信的唯一通道
- 创建集中式计时器服务（`TimerService`），作为唯一时间源管理所有倒计时状态
- 新增计时器相关事件类型到 `shared/types/events.ts`
- 重构 `useUnifiedTimer` hook，从本地状态管理改为订阅 `TimerService`
- 重构 `BreakTimer`，移除独立 `setInterval`，改用 `TimerService` 驱动
- 清理 `useFocusStore` 中残留的计时器逻辑（`tick()`、`timeLeft`、`isActive` 等）
- 确保 `FocusMode`、`FocusTimer`、`LearningFocusPanel`、`CurrentTask` 均通过事件总线获取时间数据
- 实现计时器事件与调度器时段管理的联动

## Impact

- Affected specs: 计时器系统、专注模式、调度器时段管理
- Affected code:
  - `src/hooks/scheduler/useUnifiedTimer.ts` - 核心重构
  - `src/components/Scheduler/BreakTimer.tsx` - 移除独立计时器
  - `src/store/useFocusStore.ts` - 清理计时器逻辑
  - `src/components/Scheduler/FocusMode.tsx` - 适配新架构
  - `src/components/common/FocusTimer.tsx` - 适配新架构
  - `src/components/Learning/LearningFocusPanel.tsx` - 适配新架构
  - `src/pages/CurrentTask.tsx` - 适配新架构
  - `src/components/Scheduler/MiniTimer.tsx` - 适配新架构
  - `src/components/Scheduler/TaskTimer.tsx` - 适配新架构
  - `shared/types/events.ts` - 新增事件类型
  - 新增 `src/services/timer/TimerService.ts` - 集中式计时器服务
  - 新增 `src/services/timer/FrontendEventBus.ts` - 前端事件总线

## ADDED Requirements

### Requirement: 前端事件总线

系统 SHALL 提供前端事件总线 `FrontendEventBus`，作为前端模块间通信的唯一通道。与后端 `AppEventBus` 不同，`FrontendEventBus` 运行在浏览器中，用于前端组件间的实时状态同步（如计时器 tick、UI 状态变更等），避免高频事件走网络请求。

#### Scenario: 事件发布与订阅
- **WHEN** 任何模块发布一个事件到 `FrontendEventBus`
- **THEN** 所有订阅该事件类型的处理器 SHALL 被调用

#### Scenario: 事件总线单例
- **WHEN** 应用启动
- **THEN** `FrontendEventBus` SHALL 作为单例存在，全局唯一

#### Scenario: 取消订阅
- **WHEN** 组件卸载时调用 unsubscribe
- **THEN** 该组件的事件处理器 SHALL 不再被调用

#### Scenario: 与后端事件总线桥接
- **WHEN** 前端计时器完成一个专注会话
- **THEN** `TimerService` SHALL 通过 API 调用后端保存会话，后端通过 `AppEventBus` 发布 `focus_session_ended` 事件，其他后端服务（成就系统、SSE 通知等）可正常响应

### Requirement: 集中式计时器服务

系统 SHALL 提供集中式计时器服务 `TimerService`，作为唯一时间源管理所有倒计时状态。

#### Scenario: 启动专注计时
- **WHEN** 用户启动专注计时
- **THEN** `TimerService` SHALL 开始倒计时，并通过事件总线发布 `timer_started` 事件

#### Scenario: 计时每秒更新
- **WHEN** 计时器每秒 tick
- **THEN** `TimerService` SHALL 通过事件总线发布 `timer_tick` 事件，携带当前 `timeLeft`、`progress` 等数据

#### Scenario: 计时暂停
- **WHEN** 用户暂停计时
- **THEN** `TimerService` SHALL 暂停倒计时，并通过事件总线发布 `timer_paused` 事件

#### Scenario: 计时恢复
- **WHEN** 用户恢复计时
- **THEN** `TimerService` SHALL 恢复倒计时，并通过事件总线发布 `timer_resumed` 事件

#### Scenario: 计时完成
- **WHEN** 倒计时归零
- **THEN** `TimerService` SHALL 停止计时，通过事件总线发布 `timer_completed` 事件，并通过 API 调用后端保存专注会话（与后端 AppEventBus 桥接）

#### Scenario: 模式切换
- **WHEN** 用户切换计时模式（focus/shortBreak/longBreak）
- **THEN** `TimerService` SHALL 更新模式和时长，通过事件总线发布 `timer_mode_changed` 事件

#### Scenario: 跳转到休息
- **WHEN** 用户跳转到休息
- **THEN** `TimerService` SHALL 切换到休息模式，通过事件总线发布 `timer_skip_to_break` 事件

#### Scenario: 唯一时间源
- **WHEN** 任何组件需要获取当前计时器状态
- **THEN** 该组件 SHALL 通过 `TimerService` 的 getter 或事件总线获取，而非维护本地计时器

### Requirement: 计时器事件类型

系统 SHALL 在 `shared/types/events.ts` 中定义前端计时器相关的事件类型。

#### Scenario: 事件类型定义
- **WHEN** 开发者查看事件类型定义
- **THEN** SHALL 能看到以下新增事件类型：`timer_started`、`timer_paused`、`timer_resumed`、`timer_completed`、`timer_tick`、`timer_mode_changed`、`timer_skip_to_break`、`timer_reset`

### Requirement: 重构 useUnifiedTimer Hook

系统 SHALL 重构 `useUnifiedTimer` hook，使其从本地状态管理改为订阅 `TimerService`。

#### Scenario: Hook 订阅计时器服务
- **WHEN** 组件使用 `useUnifiedTimer()`
- **THEN** 该 hook SHALL 从 `TimerService` 获取状态，而非创建本地计时器

#### Scenario: Hook 操作转发
- **WHEN** 用户通过 hook 调用 start/pause/resume/complete 等操作
- **THEN** 这些操作 SHALL 委托给 `TimerService` 执行

#### Scenario: Hook 接口兼容
- **WHEN** 重构后的 `useUnifiedTimer` 被现有组件使用
- **THEN** 其返回值接口 SHALL 保持与原有一致，确保现有组件无需修改调用方式

### Requirement: 重构 BreakTimer

系统 SHALL 重构 `BreakTimer` 组件，移除独立的 `setInterval` 倒计时实现。

#### Scenario: BreakTimer 使用 TimerService
- **WHEN** BreakTimer 需要显示休息倒计时
- **THEN** 它 SHALL 从 `TimerService` 获取状态，而非维护本地 `setInterval`

#### Scenario: 休息计时与专注计时统一
- **WHEN** 专注计时结束自动进入休息
- **THEN** BreakTimer SHALL 通过事件总线接收到 `timer_mode_changed` 事件，并正确显示休息倒计时

### Requirement: 清理 useFocusStore 计时器逻辑

系统 SHALL 清理 `useFocusStore` 中残留的计时器逻辑。

#### Scenario: 移除 tick 方法
- **WHEN** 重构完成
- **THEN** `useFocusStore` 的 `tick()` 方法 SHALL 被移除，因为计时逻辑已由 `TimerService` 接管

#### Scenario: 移除计时器状态
- **WHEN** 重构完成
- **THEN** `useFocusStore` 中的 `isActive`、`timeLeft`、`startTimer`、`pauseTimer`、`resetTimer`、`setDuration` 等计时器相关状态和方法 SHALL 被移除

#### Scenario: 保留设置相关状态
- **WHEN** 重构完成
- **THEN** `useFocusStore` 中的 `focusDuration`、`shortBreakDuration`、`longBreakDuration`、`soundEnabled` 等设置项 SHALL 保留，因为它们是配置而非运行时计时状态

### Requirement: 计时器与调度器时段管理联动

系统 SHALL 实现计时器功能与调度器时段管理的无缝协作。

#### Scenario: 时间片结束触发调度器事件
- **WHEN** 计时器倒计时结束（时间片用完）
- **THEN** `TimerService` SHALL 通过前端事件总线发布 `timer_completed` 事件，调度器相关组件可订阅该事件执行降级等操作

#### Scenario: 调度器任务启动触发计时器
- **WHEN** 调度器启动一个任务
- **THEN** 可通过前端事件总线发布 `task_started` 事件，`TimerService` 监听该事件并自动启动对应时间片的倒计时

### Requirement: 页面标题同步

系统 SHALL 确保页面标题与计时器状态同步。

#### Scenario: 计时器运行时更新标题
- **WHEN** 计时器处于活跃状态
- **THEN** 页面标题 SHALL 显示剩余时间和当前模式

#### Scenario: 计时器停止时恢复标题
- **WHEN** 计时器停止或完成
- **THEN** 页面标题 SHALL 恢复为默认值

## MODIFIED Requirements

### Requirement: 专注模式计时器集成

原 `FocusMode` 组件直接调用 `useUnifiedTimer()` hook 获取本地计时器状态。重构后，`FocusMode` 仍通过 `useUnifiedTimer()` hook 获取状态，但 hook 内部从 `TimerService` 订阅，确保与其他组件共享同一时间源。

### Requirement: 学习专注面板计时器集成

原 `LearningFocusPanel` 组件直接调用 `useUnifiedTimer()` hook 获取本地计时器状态。重构后，`LearningFocusPanel` 仍通过 `useUnifiedTimer()` hook 获取状态，但 hook 内部从 `TimerService` 订阅，确保与 FocusMode、CurrentTask 等组件共享同一时间源。

## REMOVED Requirements

### Requirement: BreakTimer 独立倒计时
**Reason**: 违背唯一时间源原则，造成与 useUnifiedTimer 的状态不同步
**Migration**: BreakTimer 改为从 TimerService 获取休息模式状态

### Requirement: useFocusStore.tick() 外部驱动计时
**Reason**: tick() 方法需要外部 setInterval 驱动，且已被 useUnifiedTimer 替代，属于残留逻辑
**Migration**: 计时逻辑完全由 TimerService 接管
