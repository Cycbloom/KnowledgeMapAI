# 倒计时/日历/调度系统架构统一优化 Spec

## Why

当前倒计时系统（TimerService 单例 + EventBus 桥接）、日历系统（CalendarPage 单体组件 + useState 数据加载）和调度系统（React Query + Zustand）之间存在严重的架构不一致：状态管理方式不同、通知模式不同、类型定义重复、组件职责不清。同时，任务/计时/学习/通知等子系统耦合度高，缺乏清晰的边界和统一的领域模型。需要自底向上统一基础设施，建立一致的架构模式。

## What Changes

### 基础设施层统一
- 统一类型系统：消除 TimerMode 重复定义，统一 CalendarEvent 与 UserTask 的关系
- 统一通知模式：建立统一通知服务，消除 message.success() 和 EventBus 通知的混用
- 统一状态管理模式：Calendar 从 useState+useEffect 迁移到 React Query + Zustand
- 计时器架构统一：TimerService 从单例+EventBus 迁移到 Zustand store

### EventBus 职责收窄
- 系统内部事件（timer_tick、scheduler_task_changed 等）迁移到 Zustand subscribe / React Query invalidation
- 保留 EventBus 仅用于跨系统/外部事件（SSE、sync、通知分发）

### 日历系统重构
- CalendarPage 拆分为子组件 + 自定义 hooks
- 日历定位为"任务的时间视图"，不引入独立事件概念
- 对齐 Scheduler 的 React Query + Zustand 模式

### 计时器系统重构
- TimerService 单例 → Zustand store（useTimerStore）
- useUnifiedTimer 桥接 hook → 直接使用 store
- 副作用（通知、标题更新、API 保存）通过 Zustand middleware 或 subscribe 隔离

### 任务模型统一
- 知识图谱学习任务和普通任务使用统一模型，通过类型字段区分
- 任务层级：Task → Subtask → Stage → Pomodoro Session
- 调度算法（优先级调度 + 时间片调度）与计时器解耦

## Impact

- Affected specs: scheduler-subtask-learning-enhancement, fix-pomodoro-complete-flow
- Affected code:
  - `src/services/timer/TimerService.ts` — 重写为 Zustand store
  - `src/services/timer/FrontendEventBus.ts` — 职责收窄
  - `src/store/useFocusStore.ts` — 拆分/重组
  - `src/hooks/scheduler/useUnifiedTimer.ts` — 简化或移除
  - `src/pages/CalendarPage.tsx` — 拆分重构
  - `src/types/calendar.ts` — 类型统一
  - `src/components/Scheduler/FocusMode.tsx` — 职责拆分
  - `src/components/Scheduler/FocusStreak.tsx` — 类型统一
  - 所有使用 timerService 的组件 — 迁移到新 store

## ADDED Requirements

### Requirement: 统一类型系统

系统 SHALL 提供统一的类型定义，消除跨文件的类型重复和不一致。

#### Scenario: TimerMode 类型统一
- **WHEN** 任何组件需要引用计时器模式类型
- **THEN** 应从单一来源（如 `@shared/types` 或统一的 store）导入，不允许多处重复定义

#### Scenario: CalendarEvent 与 UserTask 关系统一
- **WHEN** 日历系统需要展示任务数据
- **THEN** CalendarEvent 应为 UserTask 的视图投影类型，通过工具函数转换，而非独立维护的类型

### Requirement: 统一通知服务

系统 SHALL 提供统一的通知接口，所有子系统通过同一方式发送用户通知。

#### Scenario: 通知发送
- **WHEN** 任何子系统需要向用户显示通知
- **THEN** 应使用统一的 `notification` 服务（如现有的 `message` 工具），支持 toast、浏览器通知、声音等渠道
- **AND** 不再混用 `frontendEventBus.publish("message_show")` 和 `message.success()`

#### Scenario: 浏览器通知和声音
- **WHEN** 计时器完成需要提醒用户
- **THEN** 通知逻辑应封装在通知服务中，由 store 的 subscribe 触发，而非在 TimerService 中直接调用

### Requirement: 统一状态管理模式

系统 SHALL 使用一致的状态管理模式：React Query 管理服务端状态，Zustand 管理客户端状态。

#### Scenario: 日历数据加载
- **WHEN** 日历页面需要加载任务和执行记录数据
- **THEN** 应使用 React Query hooks（与 Scheduler 一致），而非 useState + useEffect

#### Scenario: 计时器状态管理
- **WHEN** 计时器需要管理 timeLeft、isActive、mode 等状态
- **THEN** 应使用 Zustand store，组件直接通过 selector 订阅，无需 EventBus 桥接

### Requirement: 计时器 Zustand Store

系统 SHALL 将 TimerService 单例迁移为 Zustand store，简化数据流。

#### Scenario: 计时器启动
- **WHEN** 用户启动一个任务的计时器
- **THEN** 直接调用 store action（如 `useTimerStore.getState().start(taskId, duration)`）
- **AND** 所有订阅了相关 selector 的组件自动更新

#### Scenario: 计时器副作用
- **WHEN** 计时器状态变化需要触发副作用（保存专注记录、更新页面标题、播放声音）
- **THEN** 通过 Zustand 的 `subscribe` 或 middleware 触发，不混入 store action 中

#### Scenario: 渐进迁移
- **WHEN** 新的 Zustand timer store 上线
- **THEN** 现有使用 `timerService` 和 `useUnifiedTimer` 的组件可以逐步迁移，两种模式可共存

### Requirement: EventBus 职责收窄

系统 SHALL 将 EventBus 的使用范围限制在跨系统/外部事件。

#### Scenario: 系统内部状态变化
- **WHEN** Timer 状态变化或 Scheduler 任务变更
- **THEN** 使用 Zustand subscribe 或 React Query invalidation 通知，不通过 EventBus

#### Scenario: 外部事件推送
- **WHEN** SSE 推送服务端事件或同步状态变化
- **THEN** 仍通过 EventBus 分发，因为这是真正的跨系统事件

### Requirement: 日历系统重构

系统 SHALL 将日历重构为"任务的时间视图"，使用与 Scheduler 一致的架构模式。

#### Scenario: 日历数据加载
- **WHEN** 日历页面加载
- **THEN** 使用 `useCalendarEvents()` 等 React Query hooks 获取数据，与 `useSchedulerTasks()` 模式一致

#### Scenario: CalendarPage 拆分
- **WHEN** 日历页面渲染
- **THEN** 页面组件仅负责布局和组合，数据逻辑在 hooks 中，UI 在子组件中
- **AND** 任务创建弹窗、导出弹窗等抽取为独立组件

#### Scenario: 日历导航
- **WHEN** 用户切换日期/视图
- **THEN** 导航逻辑封装在 `useCalendarNavigation` hook 中

### Requirement: 任务模型统一

系统 SHALL 使用统一的任务模型，知识图谱学习任务和普通任务通过类型字段区分。

#### Scenario: 任务类型区分
- **WHEN** 创建知识图谱学习任务
- **THEN** 任务带有 `task_type: "knowledge_learning"` 标识，关联 graph_id 和 knowledge_point_id
- **AND** 普通任务使用 `task_type: "general"` 或其他类型

#### Scenario: 任务层级
- **WHEN** 任务包含子任务和阶段
- **THEN** 统一的层级关系为 Task → Subtask → PomodoroSession
- **AND** 学习活动的阶段信息通过 subtask 的 metadata 或 type 字段表达

## MODIFIED Requirements

### Requirement: 计时器模式切换（原 TimerService.transitionToNextMode）

计时器模式切换逻辑 SHALL 保留在 Zustand store 的 action 中，但副作用（保存专注记录、播放声音）通过 subscribe 机制触发，而非在 action 内直接调用。

### Requirement: 专注模式 UI（原 FocusMode.tsx）

FocusMode 组件 SHALL 仅负责 UI 渲染，计时器状态从 useTimerStore 获取，白噪音控制从 useWhiteNoise 获取，全屏逻辑抽取为独立 hook。

## REMOVED Requirements

### Requirement: useUnifiedTimer 桥接 Hook
**Reason**: Zustand store 替代后，组件直接通过 selector 订阅 store，无需 EventBus → useState 桥接
**Migration**: 所有使用 useUnifiedTimer 的组件迁移为直接使用 useTimerStore

### Requirement: TimerService 单例中的 UI 逻辑
**Reason**: 页面标题更新、通知声音、浏览器通知等 UI 逻辑不应在 Service/Store 层
**Migration**: 迁移到 Zustand subscribe 或 React useEffect 中
