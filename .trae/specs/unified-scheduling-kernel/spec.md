# 统一调度内核 (Unified Scheduling Kernel) Spec

## Why

当前调度系统功能覆盖面广但架构碎片化严重：17 个后端调度服务之间缺少统一编排层，事件驱动缺失导致级联更新依赖前端手动调用，定时执行缺失导致 TaskSchedule 和 PeriodicTask 的自动化能力无法实现，前端存在三套独立计时器实现，任务状态机分散在各页面组件中。

用户需要一个统一的调度内核，将知识图谱学习、题目生成、间隔复习、学习路径、番茄钟、自定义任务等所有调度相关功能整合为一个敏捷迭代循环（学习→测试→复习→迭代），实现任务间的智能调度与自动流转。

## What Changes

### Phase 1: 调度事件总线 + 统一状态机
- **新增** `SchedulerEventBus` 服务，基于发布/订阅模式，统一调度事件的分发与消费
- **新增** `TaskStateMachine` 服务，定义任务合法状态转换及每个转换的副作用
- **新增** 调度事件类型体系（TaskCompleted, TaskStarted, FocusSessionEnded, ReviewCompleted 等）
- **修改** 任务状态变更路由，通过状态机驱动而非直接数据库操作
- **修改** 任务完成时自动触发级联事件（效率更新、成就检查、进度同步、复习调度）

### Phase 2: 定时调度执行器
- **新增** `SchedulerCronService` 服务，统一管理定时调度执行
- **新增** 调度执行器，消费 `task_schedules` 表的 `next_run_at`，到期自动执行
- **修改** `AutoBackupScheduler` 迁移到统一调度框架
- **修改** `PeriodicTaskService` 进度自动从实际完成的任务/专注会话中聚合

### Phase 3: 统一计时器 + 专注模式整合
- **新增** 前端 `useUnifiedTimer` hook，统一所有计时场景
- **修改** `CurrentTask` 页面使用统一计时器替代自建计时逻辑
- **修改** `FocusMode` 组件感知任务上下文，与调度任务绑定
- **修改** `LearningMode` 专注模式通过统一调度内核处理
- **移除** 旧版 `api/services/focusService.ts`，统一使用 `api/services/scheduler/focusService.ts`

### Phase 4: 间隔重复算法统一
- **新增** `SpacedRepetitionBridge` 服务，桥接 SM-2 和 FSRS 双算法
- **修改** 复习任务调度统一走调度内核事件驱动
- **修改** 学习卡片复习完成触发调度事件

### Phase 5: 敏捷学习循环 + 调度编排
- **新增** `LearningLoopOrchestrator` 服务，编排「学习→测试→复习→迭代」循环
- **新增** `SchedulerOrchestrator` 前端服务层，封装跨模块业务流程
- **修改** 学习路径支持跨图谱（领域级）调度
- **修改** 番茄钟完成事件触发下一步调度决策

### Phase 6: 调度决策引擎统一
- **修改** 合并 `SmartSchedulerService` 和 `TaskRecommendationService` 为统一的 `SchedulerDecisionEngine`
- **修改** 所有调度决策统一走决策引擎
- **修改** 用户可用时段纳入所有调度决策

## Impact

- **Affected specs**:
  - 任务调度器核心功能（状态机重构）
  - 知识图谱关联机制（事件驱动）
  - 学习路径进度追踪（跨图谱支持）
  - 专注/番茄钟系统（统一计时器）
  - 间隔重复算法（双算法桥接）
  - 统计分析模块（事件驱动数据更新）

- **Affected code**:
  - `api/services/scheduler/` - 重构为事件驱动架构
  - `api/services/focusService.ts` - 移除旧版
  - `api/services/common/queueService.ts` - 激活或移除
  - `api/jobs/` - 统一定时调度
  - `src/pages/CurrentTask.tsx` - 使用统一计时器
  - `src/pages/LearningMode.tsx` - 通过调度内核处理
  - `src/pages/Scheduler.tsx` - 使用编排层
  - `src/pages/UnifiedWorkbench.tsx` - 消除重复逻辑
  - `src/components/Scheduler/` - 计时器统一
  - `src/components/common/FocusTimer.tsx` - 整合到统一计时器
  - `src/store/useFocusStore.ts` - 扩展为统一调度状态
  - `shared/types/scheduler.ts` - 扩展事件和状态机类型

---

## ADDED Requirements

### Requirement: 调度事件总线

系统 SHALL 提供统一的调度事件总线，实现调度事件的发布/订阅/消费。

#### Scenario: 任务完成事件自动触发级联更新
- **WHEN** 任务状态变更为 `completed`
- **THEN** 事件总线发布 `TaskCompleted` 事件
- **AND** 效率画像服务自动更新用户效率数据
- **AND** 成就服务自动检查是否解锁新成就
- **AND** 进度同步服务自动更新关联知识点掌握度
- **AND** 学习路径服务自动更新路径进度
- **AND** 周期任务服务自动更新周期任务进度

#### Scenario: 专注会话结束触发调度决策
- **WHEN** 专注会话结束（番茄钟倒计时归零）
- **THEN** 事件总线发布 `FocusSessionEnded` 事件
- **AND** 调度决策引擎自动评估下一步推荐
- **AND** 如果关联任务已完成，自动触发 `TaskCompleted` 事件链

#### Scenario: 复习完成触发下次复习调度
- **WHEN** 用户完成知识点复习并评分
- **THEN** 事件总线发布 `ReviewCompleted` 事件
- **AND** SM-2/FSRS 算法自动计算下次复习时间
- **AND** 自动创建新的复习任务

#### Scenario: 事件订阅者失败不影响发布者
- **WHEN** 某个事件订阅者处理失败
- **THEN** 发布者和其他订阅者不受影响
- **AND** 失败事件记录到日志，支持后续重试

---

### Requirement: 任务状态机

系统 SHALL 提供统一的任务状态机，定义合法状态转换及副作用。

#### Scenario: 合法状态转换
- **GIVEN** 任务当前状态为 `pending`
- **WHEN** 用户开始任务
- **THEN** 状态转换为 `in_progress`
- **AND** 创建执行记录（started_at）
- **AND** 发布 `TaskStarted` 事件

#### Scenario: 非法状态转换拒绝
- **GIVEN** 任务当前状态为 `completed`
- **WHEN** 尝试将状态改为 `in_progress`
- **THEN** 状态转换被拒绝
- **AND** 返回错误信息说明不允许的转换

#### Scenario: 任务完成触发完整事件链
- **GIVEN** 任务当前状态为 `in_progress`
- **WHEN** 用户完成任务
- **THEN** 状态转换为 `completed`
- **AND** 更新执行记录（ended_at, duration）
- **AND** 发布 `TaskCompleted` 事件触发级联更新

#### Scenario: 任务暂停与恢复
- **GIVEN** 任务当前状态为 `in_progress`
- **WHEN** 用户暂停任务
- **THEN** 状态转换为 `paused`
- **AND** 记录暂停时间点
- **WHEN** 用户恢复任务
- **THEN** 状态转换回 `in_progress`
- **AND** 累计暂停时长

---

### Requirement: 定时调度执行器

系统 SHALL 提供统一的定时调度执行器，自动执行到期的调度任务。

#### Scenario: 周期调度自动执行
- **GIVEN** `task_schedules` 表中存在 `next_run_at` 已过期的调度
- **WHEN** 定时执行器扫描（每分钟）
- **THEN** 自动执行到期调度
- **AND** 更新 `last_run_at` 和 `next_run_at`
- **AND** 发布 `ScheduleExecuted` 事件

#### Scenario: 学习路径每日计划激活
- **GIVEN** 学习路径有每日学习计划
- **WHEN** 到达计划时间
- **THEN** 自动创建当日学习任务
- **AND** 通知用户开始学习

#### Scenario: 复习提醒自动触发
- **GIVEN** 存在今日到期的复习任务
- **WHEN** 到达用户设定的提醒时间
- **THEN** 通过 SSE 发送复习提醒通知
- **AND** 推荐最紧急的复习任务

#### Scenario: 周期任务进度自动聚合
- **GIVEN** 周期任务（周/月/季）关联了标签或队列
- **WHEN** 定时执行器扫描周期任务
- **THEN** 自动从 `scheduled_tasks` 和 `focus_sessions` 聚合计算进度
- **AND** 更新周期任务的 `current_value`

---

### Requirement: 统一计时器

系统 SHALL 提供统一的前端计时器，收敛所有计时场景。

#### Scenario: 所有计时场景使用统一计时器
- **GIVEN** 用户在任意页面（Scheduler/CurrentTask/LearningMode/UnifiedWorkbench）
- **WHEN** 用户开始计时
- **THEN** 使用 `useUnifiedTimer` hook 管理计时状态
- **AND** 计时状态全局唯一，不会出现多页面同时计时

#### Scenario: 计时器与调度任务绑定
- **WHEN** 用户开始计时
- **THEN** 计时器自动绑定当前任务 ID
- **AND** 倒计时结束自动保存专注会话
- **AND** 发布 `FocusSessionEnded` 事件

#### Scenario: 专注模式感知任务上下文
- **WHEN** 用户进入专注模式
- **THEN** 显示当前任务标题和进度
- **AND** 专注完成自动更新任务进度
- **AND** 退出专注模式返回任务上下文

#### Scenario: 学习时长统一同步
- **WHEN** 用户在任意场景学习
- **THEN** 学习时长通过统一管道上报
- **AND** 自动同步到关联任务的 `actual_duration`
- **AND** 自动同步到关联知识点的 `total_study_duration`

---

### Requirement: 间隔重复算法桥接

系统 SHALL 桥接 SM-2 和 FSRS 双算法，提供统一的间隔重复调度接口。

#### Scenario: 统一复习调度入口
- **WHEN** 需要调度复习任务
- **THEN** 通过 `SpacedRepetitionBridge` 统一入口
- **AND** 根据知识点类型自动选择算法（知识图谱用 SM-2，学习卡片用 FSRS）
- **AND** 返回统一的下次复习时间

#### Scenario: 复习完成统一处理
- **WHEN** 用户完成任意类型的复习
- **THEN** 通过桥接层统一处理
- **AND** 发布 `ReviewCompleted` 事件
- **AND** 自动调度下次复习

#### Scenario: 复习队列统一视图
- **WHEN** 用户查看待复习内容
- **THEN** 显示 SM-2 和 FSRS 的合并复习队列
- **AND** 按紧急程度统一排序

---

### Requirement: 敏捷学习循环编排

系统 SHALL 提供「学习→测试→复习→迭代」的敏捷学习循环编排。

#### Scenario: 学习循环自动推进
- **GIVEN** 用户选择一个知识点开始学习
- **WHEN** 学习完成
- **THEN** 编排器自动推荐下一步：生成测试题
- **WHEN** 测试完成
- **THEN** 编排器根据测试结果调度复习
- **WHEN** 复习完成
- **THEN** 编排器推荐下一个学习目标

#### Scenario: 学习循环中的任务调度
- **WHEN** 学习循环推进到下一步
- **THEN** 自动创建对应任务并加入调度队列
- **AND** 根据当前时段和效率数据分配优先级
- **AND** 设置任务依赖关系（测试依赖学习完成）

#### Scenario: 番茄钟与学习循环联动
- **WHEN** 番茄钟完成一个专注周期
- **THEN** 编排器评估当前学习循环进度
- **AND** 推荐休息或继续下一步
- **AND** 如果达到学习目标，建议切换到测试环节

#### Scenario: 自定义任务融入学习循环
- **WHEN** 用户有自定义任务与学习循环并行
- **THEN** 编排器根据优先级和时段智能穿插
- **AND** 高优先级自定义任务可中断学习循环
- **AND** 学习循环任务在高效时段优先调度

---

### Requirement: 跨图谱学习路径调度

系统 SHALL 支持跨知识图谱（领域级）的学习路径调度。

#### Scenario: 领域级学习路径
- **WHEN** 用户创建领域级学习路径
- **THEN** 路径可包含多个知识图谱的节点
- **AND** 调度器根据图谱间依赖关系排课
- **AND** 前置图谱未完成时阻塞后续图谱任务

#### Scenario: 跨图谱进度追踪
- **WHEN** 用户在领域级路径中学习
- **THEN** 每个图谱的进度独立追踪
- **AND** 整体路径进度为各图谱进度的加权平均
- **AND** 完成一个图谱自动解锁下一个图谱的任务

---

### Requirement: 调度决策引擎统一

系统 SHALL 提供统一的调度决策引擎，合并现有推荐和智能调度能力。

#### Scenario: 统一调度推荐入口
- **WHEN** 用户请求任务推荐
- **THEN** 通过 `SchedulerDecisionEngine` 统一计算
- **AND** 综合考虑：时段效率、掌握度、依赖关系、任务类型、用户可用时段
- **AND** 返回带推荐理由的排序任务列表

#### Scenario: 时间感知调度
- **WHEN** 调度决策引擎计算推荐
- **THEN** 读取用户可用时段配置
- **AND** 只在用户可用时段内推荐任务
- **AND** 高效时段推荐重要/困难任务，低效时段推荐简单/轻松任务

#### Scenario: 调度决策透明化
- **WHEN** 引擎返回推荐结果
- **THEN** 每个推荐附带决策理由
- **AND** 显示影响推荐的关键因素（时段效率、掌握度、紧急度等）
- **AND** 用户可查看推荐详情并手动调整

---

## MODIFIED Requirements

### Requirement: 任务状态变更流程

原有任务状态变更 SHALL 通过统一状态机驱动。

#### Scenario: 所有状态变更走状态机
- **WHEN** 任何路由或服务需要变更任务状态
- **THEN** 必须通过 `TaskStateMachine.transition()` 方法
- **AND** 状态机验证转换合法性
- **AND** 状态机自动触发事件总线发布事件
- **AND** 状态机自动执行转换副作用

---

### Requirement: 前端调度数据层

原有前端调度 hooks SHALL 通过编排层访问调度功能。

#### Scenario: 跨模块业务流程通过编排层
- **WHEN** 前端需要执行跨模块操作（如"开始学习知识点"）
- **THEN** 通过 `SchedulerOrchestrator` 统一调用
- **AND** 编排层封装：创建任务 → 开始任务 → 同步时长 → 创建复习任务
- **AND** 前端不需要手动调用多个 API

---

## REMOVED Requirements

### Requirement: 旧版 FocusService
**Reason**: 与新版 `api/services/scheduler/focusService.ts` 字段不兼容，数据模型冲突
**Migration**: 将旧版调用迁移到新版，统一数据模型

### Requirement: 前端独立计时器实现
**Reason**: CurrentTask 页面自建的 `setInterval` 计时器与 `useFocusStore` 计时器状态不同步
**Migration**: 迁移到 `useUnifiedTimer` hook

---

## Technical Design

### 调度事件总线架构

```
┌─────────────────────────────────────────────────────┐
│                  SchedulerEventBus                   │
│                                                      │
│  publish(event) → dispatch to all subscribers        │
│  subscribe(eventType, handler) → register listener   │
│  unsubscribe(eventType, handler) → remove listener   │
│                                                      │
│  Event Types:                                        │
│  ├── TaskStarted                                     │
│  ├── TaskPaused                                      │
│  ├── TaskResumed                                     │
│  ├── TaskCompleted                                   │
│  ├── TaskDemoted                                     │
│  ├── TaskMoved                                       │
│  ├── FocusSessionStarted                             │
│  ├── FocusSessionEnded                               │
│  ├── ReviewCompleted                                 │
│  ├── ScheduleExecuted                                │
│  └── LearningProgressUpdated                         │
└─────────────────────────────────────────────────────┘
          │
          ├──→ EfficiencyService.onTaskCompleted()
          ├──→ AchievementService.onTaskCompleted()
          ├──→ ProgressSyncService.onTaskCompleted()
          ├──→ PathProgressService.onTaskCompleted()
          ├──→ PeriodicTaskService.onTaskCompleted()
          ├──→ ReviewTaskService.onReviewCompleted()
          ├──→ SchedulerDecisionEngine.onFocusSessionEnded()
          └──→ SSEService.onAnyEvent() → notify user
```

### 任务状态机

```
                    ┌──────────┐
          ┌────────→│ pending  │
          │         └────┬─────┘
          │              │ start
          │              ▼
          │         ┌──────────┐
          │    pause│in_progress│◄── resume
          │    ┌────┴────┬─────┘────┐
          │    │         │          │complete
          │    ▼         │          ▼
          │ ┌───────┐    │    ┌──────────┐
          │ │paused │────┘    │completed │
          │ └───────┘         └──────────┘
          │                       ▲
          └───────────────────────┘
                 reopen (optional)
```

### 统一计时器架构

```
┌─────────────────────────────────────────────────┐
│              useUnifiedTimer (Hook)              │
│                                                  │
│  State:                                          │
│  ├── taskId: string | null                       │
│  ├── mode: 'focus' | 'shortBreak' | 'longBreak' │
│  ├── timeLeft: number                            │
│  ├── isActive: boolean                           │
│  ├── isPaused: boolean                           │
│  ├── completedSessions: number                   │
│  └── queueLevel: 'q0' | 'q1' | 'q2'             │
│                                                  │
│  Actions:                                        │
│  ├── start(taskId, duration, queueLevel)         │
│  ├── pause()                                     │
│  ├── resume()                                    │
│  ├── complete()                                  │
│  ├── skipToBreak()                               │
│  └── switchTask(taskId)                          │
│                                                  │
│  Side Effects (on tick=0):                       │
│  ├── Save focus session via API                  │
│  ├── Publish FocusSessionEnded event             │
│  ├── Update task actual_duration                 │
│  ├── Play notification sound                     │
│  └── Trigger next scheduling decision            │
└─────────────────────────────────────────────────┘
```

### 敏捷学习循环

```
┌─────────────────────────────────────────────────────────┐
│              LearningLoopOrchestrator                     │
│                                                          │
│  ┌──────┐    ┌──────┐    ┌──────┐    ┌──────┐           │
│  │ 学习 │───→│ 测试 │───→│ 复习 │───→│ 迭代 │──→ 循环   │
│  └──────┘    └──────┘    └──────┘    └──────┘           │
│      │           │           │           │                │
│      ▼           ▼           ▼           ▼                │
│  创建学习任务  创建测试任务  创建复习任务  推荐下一目标    │
│  (Q1队列)     (Q1队列)     (Q0/Q1队列)  (基于掌握度)    │
│                                                          │
│  调度策略:                                               │
│  ├── 学习: 高效时段优先                                  │
│  ├── 测试: 学习后1-2小时                                 │
│  ├── 复习: SM-2/FSRS 算法驱动                           │
│  └── 迭代: 掌握度低于阈值时重新进入学习                   │
└─────────────────────────────────────────────────────────┘
```

### 服务架构变更

```
api/services/
├── scheduler/
│   ├── core/                          # 新增: 调度内核
│   │   ├── eventBus.ts                # 事件总线
│   │   ├── stateMachine.ts            # 任务状态机
│   │   ├── cronService.ts             # 定时调度执行器
│   │   ├── decisionEngine.ts          # 统一调度决策引擎
│   │   └── learningLoopOrchestrator.ts # 敏捷学习循环
│   ├── taskService.ts                 # 修改: 通过状态机驱动
│   ├── focusService.ts               # 保留: 新版专注服务
│   ├── sm2Service.ts                  # 保留: SM-2 算法
│   ├── reviewTaskService.ts           # 修改: 事件驱动
│   ├── efficiencyService.ts           # 修改: 事件订阅
│   ├── achievementService.ts          # 修改: 事件订阅
│   ├── progressSyncService.ts         # 修改: 事件订阅
│   ├── pathProgressService.ts         # 修改: 事件订阅
│   ├── pathTaskService.ts             # 保留
│   ├── periodicTaskService.ts         # 修改: 自动聚合
│   ├── statsService.ts                # 保留
│   └── settingsService.ts             # 保留
├── study/
│   ├── spacedRepetitionBridge.ts      # 新增: 算法桥接
│   ├── studyService.ts                # 保留: FSRS
│   ├── learningPathService.ts         # 修改: 跨图谱支持
│   └── reviewService.ts               # 保留
└── common/
    └── queueService.ts                # 修改: 激活或移除

移除:
├── focusService.ts (旧版)
```

### 前端架构变更

```
src/
├── hooks/
│   ├── scheduler/
│   │   ├── useUnifiedTimer.ts         # 新增: 统一计时器
│   │   ├── useSchedulerOrchestrator.ts # 新增: 调度编排
│   │   ├── useScheduler.ts            # 修改: 使用编排层
│   │   └── useTaskEvents.ts           # 修改: 增强事件处理
│   └── ...
├── services/
│   └── api/
│       └── modules/
│           └── scheduler/
│               ├── orchestrator.ts     # 新增: 前端编排层
│               └── ...                 # 保留现有模块
├── store/
│   └── useFocusStore.ts               # 修改: 整合到统一计时器
├── components/
│   ├── Scheduler/
│   │   └── ...                        # 修改: 使用统一计时器
│   └── common/
│       ├── FocusTimer.tsx              # 修改: 使用 useUnifiedTimer
│       └── MobileFocusTimer.tsx        # 修改: 使用 useUnifiedTimer
└── pages/
    ├── CurrentTask.tsx                 # 修改: 使用统一计时器
    ├── LearningMode.tsx                # 修改: 通过编排层
    └── Scheduler.tsx                   # 修改: 使用编排层
```

### 数据库变更

```sql
-- 调度事件日志表（可选，用于审计和重试）
CREATE TABLE scheduler_event_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  source VARCHAR(100),
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_scheduler_event_log_type ON scheduler_event_log(event_type);
CREATE INDEX idx_scheduler_event_log_status ON scheduler_event_log(status);
CREATE INDEX idx_scheduler_event_log_created ON scheduler_event_log(created_at);

-- 学习循环状态表
CREATE TABLE learning_loops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  knowledge_point_id UUID,
  graph_id UUID,
  current_stage VARCHAR(20) NOT NULL DEFAULT 'learn',
  mastery_level DECIMAL(3,2) DEFAULT 0,
  loop_count INTEGER DEFAULT 0,
  last_stage_change_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  config JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_learning_loops_user ON learning_loops(user_id);
CREATE INDEX idx_learning_loops_kp ON learning_loops(knowledge_point_id);

-- 领域级学习路径扩展
ALTER TABLE learning_paths ADD COLUMN IF NOT EXISTS domain_id UUID;
ALTER TABLE learning_paths ADD COLUMN IF NOT EXISTS path_type VARCHAR(20) DEFAULT 'single_graph';
```
