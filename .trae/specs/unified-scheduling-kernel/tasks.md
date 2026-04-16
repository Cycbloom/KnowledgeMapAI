# Tasks

## Phase 1: 调度事件总线 + 统一状态机

- [x] Task 1.1: 创建调度事件类型体系
  - [x] SubTask 1.1.1: 在 `shared/types/scheduler.ts` 中定义调度事件类型（TaskStarted, TaskCompleted, TaskPaused, TaskResumed, TaskDemoted, TaskMoved, FocusSessionStarted, FocusSessionEnded, ReviewCompleted, ScheduleExecuted, LearningProgressUpdated）
  - [x] SubTask 1.1.2: 定义事件载荷（payload）接口，每个事件类型包含必要的上下文数据

- [x] Task 1.2: 实现 SchedulerEventBus 服务
  - [x] SubTask 1.2.1: 创建 `api/services/scheduler/core/eventBus.ts`，实现发布/订阅/取消订阅机制
  - [x] SubTask 1.2.2: 实现事件分发逻辑，支持同步和异步订阅者
  - [x] SubTask 1.2.3: 实现订阅者错误隔离，单个订阅者失败不影响其他订阅者
  - [x] SubTask 1.2.4: 实现事件日志记录到 `scheduler_event_log` 表

- [x] Task 1.3: 实现 TaskStateMachine 服务
  - [x] SubTask 1.3.1: 创建 `api/services/scheduler/core/stateMachine.ts`，定义合法状态转换图（pending→in_progress→paused→in_progress→completed）
  - [x] SubTask 1.3.2: 实现 `transition(taskId, fromState, toState)` 方法，验证转换合法性
  - [x] SubTask 1.3.3: 实现每个状态转换的副作用（创建执行记录、发布事件等）
  - [x] SubTask 1.3.4: 实现非法转换的错误处理和返回

- [x] Task 1.4: 重构任务路由使用状态机
  - [x] SubTask 1.4.1: 修改 `api/routes/scheduler/tasks.ts` 的 start/pause/resume/complete 端点，通过状态机驱动
  - [x] SubTask 1.4.2: 移除路由中直接操作数据库的状态变更代码
  - [x] SubTask 1.4.3: 确保状态机转换后事件总线自动发布事件

- [x] Task 1.5: 实现事件订阅者
  - [x] SubTask 1.5.1: `EfficiencyService` 订阅 `TaskCompleted`，自动更新效率画像
  - [x] SubTask 1.5.2: `AchievementService` 订阅 `TaskCompleted` 和 `FocusSessionEnded`，自动检查成就
  - [x] SubTask 1.5.3: `ProgressSyncService` 订阅 `TaskCompleted`，自动同步知识点掌握度
  - [x] SubTask 1.5.4: `PathProgressService` 订阅 `TaskCompleted`，自动更新学习路径进度
  - [x] SubTask 1.5.5: `PeriodicTaskService` 订阅 `TaskCompleted` 和 `FocusSessionEnded`，自动更新周期任务进度
  - [x] SubTask 1.5.6: `ReviewTaskService` 订阅 `ReviewCompleted`，自动调度下次复习

---

## Phase 2: 定时调度执行器

- [x] Task 2.1: 实现 SchedulerCronService
  - [x] SubTask 2.1.1: 创建 `api/services/scheduler/core/cronService.ts`，实现定时扫描逻辑（每分钟扫描 `task_schedules` 表）
  - [x] SubTask 2.1.2: 实现到期调度执行逻辑，更新 `last_run_at` 和 `next_run_at`
  - [x] SubTask 2.1.3: 执行后发布 `ScheduleExecuted` 事件

- [x] Task 2.2: 迁移 AutoBackupScheduler
  - [x] SubTask 2.2.1: 将 `api/jobs/autoBackupScheduler.ts` 从 `setInterval` 迁移到 `SchedulerCronService`
  - [x] SubTask 2.2.2: 注册备份任务为系统级调度

- [x] Task 2.3: 实现周期任务自动聚合
  - [x] SubTask 2.3.1: 修改 `PeriodicTaskService`，添加从 `scheduled_tasks` 和 `focus_sessions` 自动聚合 `current_value` 的方法
  - [x] SubTask 2.3.2: 在 `SchedulerCronService` 中注册周期任务进度更新任务

- [x] Task 2.4: 实现复习提醒
  - [x] SubTask 2.4.1: 在 `SchedulerCronService` 中添加复习到期检查
  - [x] SubTask 2.4.2: 到期复习通过 SSE 发送提醒通知

- [x] Task 2.5: 启动调度执行器
  - [x] SubTask 2.5.1: 在 `api/server.ts` 中启动 `SchedulerCronService`
  - [x] SubTask 2.5.2: 添加优雅关闭逻辑

---

## Phase 3: 统一计时器 + 专注模式整合

- [x] Task 3.1: 创建 useUnifiedTimer hook
  - [x] SubTask 3.1.1: 创建 `src/hooks/scheduler/useUnifiedTimer.ts`，整合 `useFocusStore` 计时逻辑
  - [x] SubTask 3.1.2: 实现 `start(taskId, duration, queueLevel)` 方法
  - [x] SubTask 3.1.3: 实现 `pause/resume/complete/skipToBreak/switchTask` 方法
  - [x] SubTask 3.1.4: 倒计时归零时自动保存专注会话并发布 `FocusSessionEnded` 事件
  - [x] SubTask 3.1.5: 确保全局唯一计时（切换任务时自动停止上一个）

- [x] Task 3.2: 重构 CurrentTask 页面
  - [x] SubTask 3.2.1: 移除 `CurrentTask.tsx` 中的自建 `setInterval` 计时逻辑
  - [x] SubTask 3.2.2: 使用 `useUnifiedTimer` hook 替代
  - [x] SubTask 3.2.3: 保留环形进度条和声音/通知功能

- [x] Task 3.3: 重构 FocusTimer 和 MobileFocusTimer
  - [x] SubTask 3.3.1: 修改 `FocusTimer.tsx` 使用 `useUnifiedTimer`
  - [x] SubTask 3.3.2: 修改 `MobileFocusTimer.tsx` 使用 `useUnifiedTimer`
  - [x] SubTask 3.3.3: 移除 `useFocusStore` 中的重复计时逻辑，保留状态共享

- [x] Task 3.4: 专注模式感知任务上下文
  - [x] SubTask 3.4.1: 修改 `FocusMode.tsx`，接收并显示当前任务标题和进度
  - [x] SubTask 3.4.2: 专注完成自动更新任务进度
  - [x] SubTask 3.4.3: 退出专注模式返回任务上下文

- [x] Task 3.5: 移除旧版 FocusService
  - [x] SubTask 3.5.1: 检查 `api/services/focusService.ts`（旧版）的所有引用
  - [x] SubTask 3.5.2: 迁移旧版调用到 `api/services/scheduler/focusService.ts`（新版）
  - [x] SubTask 3.5.3: 删除旧版 `api/services/focusService.ts`

- [x] Task 3.6: 统一学习时长同步
  - [x] SubTask 3.6.1: 在 `useUnifiedTimer` 中实现学习时长统一上报管道
  - [x] SubTask 3.6.2: 修改 `LearningMode.tsx` 使用统一时长同步
  - [x] SubTask 3.6.3: 修改 `ActiveTaskPanel.tsx` 使用统一时长同步

---

## Phase 4: 间隔重复算法桥接

- [x] Task 4.1: 实现 SpacedRepetitionBridge
  - [x] SubTask 4.1.1: 创建 `api/services/study/spacedRepetitionBridge.ts`
  - [x] SubTask 4.1.2: 实现统一复习调度入口，根据知识点类型选择算法
  - [x] SubTask 4.1.3: 实现复习完成统一处理，发布 `ReviewCompleted` 事件
  - [x] SubTask 4.1.4: 实现合并复习队列查询（SM-2 + FSRS），按紧急程度统一排序

- [x] Task 4.2: 复习任务调度事件驱动化
  - [x] SubTask 4.2.1: 修改 `ReviewTaskService`，复习完成通过事件总线触发下次调度
  - [x] SubTask 4.2.2: 修改 `StudyService`，学习卡片复习完成发布 `ReviewCompleted` 事件

- [x] Task 4.3: 前端复习队列统一视图
  - [x] SubTask 4.3.1: 创建统一复习队列 API 端点
  - [x] SubTask 4.3.2: 修改前端复习相关组件使用统一队列

---

## Phase 5: 敏捷学习循环 + 调度编排

- [x] Task 5.1: 实现 LearningLoopOrchestrator
  - [x] SubTask 5.1.1: 创建 `api/services/scheduler/core/learningLoopOrchestrator.ts`
  - [x] SubTask 5.1.2: 实现「学习→测试→复习→迭代」循环状态管理
  - [x] SubTask 5.1.3: 实现循环推进逻辑：学习完成自动推荐测试，测试完成调度复习，复习完成推荐下一目标
  - [x] SubTask 5.1.4: 实现循环中任务调度策略（高效时段学习、学习后1-2小时测试、SM-2/FSRS驱动复习）
  - [x] SubTask 5.1.5: 创建 `learning_loops` 数据库表

- [x] Task 5.2: 番茄钟与学习循环联动
  - [x] SubTask 5.2.1: `LearningLoopOrchestrator` 订阅 `FocusSessionEnded` 事件
  - [x] SubTask 5.2.2: 番茄钟完成后评估学习循环进度，推荐休息或继续
  - [x] SubTask 5.2.3: 达到学习目标时建议切换到测试环节

- [x] Task 5.3: 自定义任务融入学习循环
  - [x] SubTask 5.3.1: 编排器根据优先级和时段智能穿插自定义任务
  - [x] SubTask 5.3.2: 高优先级自定义任务可中断学习循环
  - [x] SubTask 5.3.3: 学习循环任务在高效时段优先调度

- [x] Task 5.4: 跨图谱学习路径调度
  - [x] SubTask 5.4.1: 扩展 `learning_paths` 表，添加 `domain_id` 和 `path_type` 字段
  - [x] SubTask 5.4.2: 修改 `LearningPathService` 支持跨图谱路径
  - [x] SubTask 5.4.3: 实现跨图谱进度追踪（独立追踪 + 加权平均）
  - [x] SubTask 5.4.4: 实现图谱间依赖关系和任务阻塞逻辑

- [x] Task 5.5: 前端调度编排层
  - [x] SubTask 5.5.1: 创建 `src/services/api/modules/scheduler/orchestrator.ts`，封装跨模块业务流程
  - [x] SubTask 5.5.2: 创建 `src/hooks/scheduler/useSchedulerOrchestrator.ts` hook
  - [x] SubTask 5.5.3: 修改 `LearningMode.tsx` 通过编排层处理学习流程
  - [x] SubTask 5.5.4: 修改 `Scheduler.tsx` 使用编排层
  - [x] SubTask 5.5.5: 消除 `UnifiedWorkbench.tsx` 与 `Scheduler.tsx` 的重复逻辑

---

## Phase 6: 调度决策引擎统一

- [x] Task 6.1: 合并推荐服务
  - [x] SubTask 6.1.1: 创建 `api/services/scheduler/core/decisionEngine.ts`，合并 `SmartSchedulerService` 和 `TaskRecommendationService` 的核心逻辑
  - [x] SubTask 6.1.2: 实现综合评分算法：时段效率 + 掌握度 + 依赖关系 + 任务类型 + 用户可用时段
  - [x] SubTask 6.1.3: 实现推荐理由生成，透明化决策因素

- [x] Task 6.2: 时间感知调度
  - [x] SubTask 6.2.1: 决策引擎读取用户可用时段配置
  - [x] SubTask 6.2.2: 只在可用时段内推荐任务
  - [x] SubTask 6.2.3: 高效时段推荐重要/困难任务，低效时段推荐简单/轻松任务

- [x] Task 6.3: 前端决策引擎集成
  - [x] SubTask 6.3.1: 修改 `SmartSuggestion.tsx` 使用统一决策引擎 API
  - [x] SubTask 6.3.2: 显示推荐理由和关键决策因素
  - [x] SubTask 6.3.3: 支持用户查看推荐详情并手动调整

---

## Task Dependencies

- Task 1.2 依赖 Task 1.1（需要事件类型定义）
- Task 1.3 依赖 Task 1.2（状态机需要事件总线）
- Task 1.4 依赖 Task 1.3（路由重构需要状态机）
- Task 1.5 依赖 Task 1.4（订阅者需要事件总线运行）
- Task 2.1 依赖 Task 1.2（定时执行器需要事件总线）
- Task 2.2, 2.3, 2.4 依赖 Task 2.1（需要 CronService）
- Task 3.1 依赖 Task 1.2（统一计时器需要事件总线）
- Task 3.2, 3.3, 3.4, 3.5, 3.6 依赖 Task 3.1（需要 useUnifiedTimer）
- Task 4.1 依赖 Task 1.2（算法桥接需要事件总线）
- Task 4.2 依赖 Task 4.1（复习事件驱动需要桥接层）
- Task 5.1 依赖 Task 1.2, Task 1.3（学习循环需要事件总线和状态机）
- Task 5.2 依赖 Task 3.1, Task 5.1（番茄钟联动需要统一计时器和学习循环）
- Task 5.3 依赖 Task 5.1（自定义任务融入需要学习循环）
- Task 5.4 依赖 Task 1.5（跨图谱需要进度同步事件）
- Task 5.5 依赖 Task 5.1, Task 3.1（前端编排需要后端学习循环和统一计时器）
- Task 6.1 依赖 Task 1.5（决策引擎需要效率数据事件订阅）
- Task 6.2 依赖 Task 6.1（时间感知需要决策引擎）
- Task 6.3 依赖 Task 6.1（前端集成需要决策引擎 API）

---

## 可并行执行的任务

以下任务可以并行开发：
- Task 1.1 和 Task 2.1（事件类型定义和 CronService 框架）
- Task 3.1 和 Task 4.1（统一计时器和算法桥接，互不依赖）
- Task 5.4 和 Task 6.1（跨图谱路径和决策引擎，互不依赖）
- Task 3.2, 3.3, 3.4, 3.5, 3.6（前端计时器重构，可并行）
