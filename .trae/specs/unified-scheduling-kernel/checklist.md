# Checklist

## Phase 1: 调度事件总线 + 统一状态机

### 事件类型体系
- [ ] `shared/types/scheduler.ts` 中定义了所有调度事件类型
- [ ] 每个事件类型包含完整的载荷接口定义

### 事件总线
- [ ] `SchedulerEventBus` 实现了 publish/subscribe/unsubscribe 方法
- [ ] 支持同步和异步订阅者
- [ ] 单个订阅者失败不影响其他订阅者和发布者
- [ ] 事件记录到 `scheduler_event_log` 表

### 任务状态机
- [ ] `TaskStateMachine` 定义了合法状态转换图
- [ ] `transition()` 方法验证转换合法性
- [ ] 非法转换返回明确错误信息
- [ ] 每个状态转换自动触发副作用（创建执行记录、发布事件）

### 路由重构
- [ ] 任务路由的 start/pause/resume/complete 通过状态机驱动
- [ ] 路由中无直接数据库状态变更代码
- [ ] 状态机转换后事件总线自动发布事件

### 事件订阅者
- [ ] `EfficiencyService` 订阅 `TaskCompleted` 自动更新效率画像
- [ ] `AchievementService` 订阅 `TaskCompleted` 和 `FocusSessionEnded` 自动检查成就
- [ ] `ProgressSyncService` 订阅 `TaskCompleted` 自动同步知识点掌握度
- [ ] `PathProgressService` 订阅 `TaskCompleted` 自动更新学习路径进度
- [ ] `PeriodicTaskService` 订阅 `TaskCompleted` 和 `FocusSessionEnded` 自动更新周期任务进度
- [ ] `ReviewTaskService` 订阅 `ReviewCompleted` 自动调度下次复习

---

## Phase 2: 定时调度执行器

### CronService
- [ ] `SchedulerCronService` 每分钟扫描 `task_schedules` 表
- [ ] 到期调度自动执行，更新 `last_run_at` 和 `next_run_at`
- [ ] 执行后发布 `ScheduleExecuted` 事件
- [ ] 服务启动和优雅关闭正常

### 迁移
- [ ] `AutoBackupScheduler` 迁移到 `SchedulerCronService`
- [ ] 备份任务作为系统级调度注册

### 周期任务自动聚合
- [ ] `PeriodicTaskService` 可从 `scheduled_tasks` 和 `focus_sessions` 自动聚合 `current_value`
- [ ] CronService 中注册了周期任务进度更新

### 复习提醒
- [ ] 到期复习通过 SSE 发送提醒通知
- [ ] 提醒包含最紧急的复习任务信息

---

## Phase 3: 统一计时器 + 专注模式整合

### useUnifiedTimer
- [ ] `useUnifiedTimer` hook 实现了 start/pause/resume/complete/skipToBreak/switchTask
- [ ] 倒计时归零自动保存专注会话
- [ ] 倒计时归零发布 `FocusSessionEnded` 事件
- [ ] 全局唯一计时，切换任务自动停止上一个
- [ ] 学习时长通过统一管道上报

### CurrentTask 重构
- [ ] `CurrentTask.tsx` 使用 `useUnifiedTimer` 替代自建计时逻辑
- [ ] 环形进度条和声音/通知功能正常

### FocusTimer 重构
- [ ] `FocusTimer.tsx` 使用 `useUnifiedTimer`
- [ ] `MobileFocusTimer.tsx` 使用 `useUnifiedTimer`
- [ ] `useFocusStore` 中无重复计时逻辑

### 专注模式
- [ ] `FocusMode.tsx` 显示当前任务标题和进度
- [ ] 专注完成自动更新任务进度
- [ ] 退出专注模式返回任务上下文

### 旧版清理
- [ ] 旧版 `api/services/focusService.ts` 已删除
- [ ] 所有旧版调用已迁移到新版

### 学习时长同步
- [ ] `LearningMode.tsx` 使用统一时长同步
- [ ] `ActiveTaskPanel.tsx` 使用统一时长同步
- [ ] 学习时长自动同步到关联任务的 `actual_duration`
- [ ] 学习时长自动同步到关联知识点的 `total_study_duration`

---

## Phase 4: 间隔重复算法桥接

### SpacedRepetitionBridge
- [ ] 统一复习调度入口根据知识点类型自动选择算法
- [ ] 复习完成统一处理，发布 `ReviewCompleted` 事件
- [ ] 合并复习队列查询（SM-2 + FSRS），按紧急程度统一排序

### 事件驱动化
- [ ] `ReviewTaskService` 复习完成通过事件总线触发下次调度
- [ ] `StudyService` 学习卡片复习完成发布 `ReviewCompleted` 事件

### 前端统一视图
- [ ] 统一复习队列 API 端点正常工作
- [ ] 前端复习组件使用统一队列

---

## Phase 5: 敏捷学习循环 + 调度编排

### LearningLoopOrchestrator
- [ ] 「学习→测试→复习→迭代」循环状态管理正常
- [ ] 学习完成自动推荐测试
- [ ] 测试完成自动调度复习
- [ ] 复习完成自动推荐下一目标
- [ ] 循环中任务调度策略正确（高效时段学习、学习后测试、算法驱动复习）
- [ ] `learning_loops` 数据库表创建成功

### 番茄钟联动
- [ ] 番茄钟完成后评估学习循环进度
- [ ] 推荐休息或继续下一步
- [ ] 达到学习目标时建议切换到测试环节

### 自定义任务融入
- [ ] 编排器根据优先级和时段智能穿插自定义任务
- [ ] 高优先级自定义任务可中断学习循环
- [ ] 学习循环任务在高效时段优先调度

### 跨图谱学习路径
- [ ] `learning_paths` 表扩展了 `domain_id` 和 `path_type` 字段
- [ ] 学习路径可包含多个知识图谱的节点
- [ ] 每个图谱进度独立追踪
- [ ] 整体路径进度为各图谱进度的加权平均
- [ ] 前置图谱未完成时阻塞后续图谱任务

### 前端编排层
- [ ] `orchestrator.ts` 封装了跨模块业务流程
- [ ] `useSchedulerOrchestrator.ts` hook 正常工作
- [ ] `LearningMode.tsx` 通过编排层处理学习流程
- [ ] `Scheduler.tsx` 使用编排层
- [ ] `UnifiedWorkbench.tsx` 与 `Scheduler.tsx` 无重复逻辑

---

## Phase 6: 调度决策引擎统一

### 决策引擎
- [ ] `SchedulerDecisionEngine` 合并了 `SmartSchedulerService` 和 `TaskRecommendationService` 的核心逻辑
- [ ] 综合评分算法考虑：时段效率 + 掌握度 + 依赖关系 + 任务类型 + 用户可用时段
- [ ] 每个推荐附带决策理由

### 时间感知调度
- [ ] 决策引擎读取用户可用时段配置
- [ ] 只在可用时段内推荐任务
- [ ] 高效时段推荐重要/困难任务，低效时段推荐简单/轻松任务

### 前端集成
- [ ] `SmartSuggestion.tsx` 使用统一决策引擎 API
- [ ] 显示推荐理由和关键决策因素
- [ ] 用户可查看推荐详情并手动调整

---

## 集成测试

- [ ] 完整流程：任务完成 → 事件总线分发 → 效率更新 + 成就检查 + 进度同步 + 路径更新
- [ ] 完整流程：专注会话结束 → 保存会话 → 事件触发 → 调度决策 → 推荐下一步
- [ ] 完整流程：学习知识点 → 自动推荐测试 → 完成测试 → 调度复习 → 复习完成 → 推荐下一目标
- [ ] 完整流程：番茄钟完成 → 评估学习循环 → 推荐休息/继续
- [ ] 完整流程：跨图谱路径 → 完成图谱A → 解锁图谱B任务
- [ ] 完整流程：定时调度 → 到期执行 → 事件发布 → 级联更新
- [ ] 错误隔离：单个订阅者失败不影响其他订阅者和发布者
