# Tasks

## Phase 1: 数据模型与类型定义

- [x] Task 1: 更新子任务类型定义
  - [x] SubTask 1.1: 在 `shared/types/scheduler.ts` 中添加 `LearningState` 类型
  - [x] SubTask 1.2: 修改 `TaskSubtask` 接口，添加 `learning_state`、`mastery_level`、`last_state_change_at`、`state_history` 字段
  - [x] SubTask 1.3: 添加状态转换类型定义 `StateTransition`

- [x] Task 2: 更新数据库Schema
  - [x] SubTask 2.1: 修改 `task_subtasks` 表，将 `task_type` 改为 `learning_state`
  - [x] SubTask 2.2: 添加 `mastery_level` 字段（DECIMAL(5,2)）
  - [x] SubTask 2.3: 添加 `last_state_change_at` 字段（TIMESTAMPTZ）
  - [x] SubTask 2.4: 添加 `state_history` 字段（JSONB）
  - [x] SubTask 2.5: 确保 `knowledge_point_id` 为必填字段

## Phase 2: 状态机服务实现

- [x] Task 3: 实现子任务状态机服务
  - [x] SubTask 3.1: 创建 `api/services/scheduler/subtaskStateMachine.ts`
  - [x] SubTask 3.2: 实现状态转换规则 `getNextState(currentState, masteryLevel)`
  - [x] SubTask 3.3: 实现状态转换验证 `canTransition(from, to)`
  - [x] SubTask 3.4: 实现状态历史记录

- [x] Task 4: 实现掌握度衰减服务
  - [x] SubTask 4.1: 创建 `api/services/scheduler/masteryDecayService.ts`
  - [x] SubTask 4.2: 实现遗忘曲线衰减算法 `calculateDecay()`
  - [x] SubTask 4.3: 实现批量衰减计算 `batchDecayCalculation()`
  - [x] SubTask 4.4: 创建定时任务触发衰减计算

- [x] Task 5: 实现子任务与知识点同步服务
  - [x] SubTask 5.1: 创建 `api/services/scheduler/subtaskKnowledgeSync.ts`
  - [x] SubTask 5.2: 实现子任务状态变更时同步知识点掌握度
  - [x] SubTask 5.3: 实现知识点掌握度变更时同步子任务
  - [x] SubTask 5.4: 实现复习提醒触发逻辑

## Phase 3: API层更新

- [x] Task 6: 更新子任务API
  - [x] SubTask 6.1: 更新 `api/routes/scheduler/subtasks.ts` 支持新字段
  - [x] SubTask 6.2: 添加状态转换API `POST /subtasks/:id/transition`
  - [x] SubTask 6.3: 添加掌握度更新API `PATCH /subtasks/:id/mastery`
  - [x] SubTask 6.4: 更新前端API服务 `src/services/api/modules/scheduler/subtasks.ts`

## Phase 4: UI实现 - 任务列表

- [x] Task 7: 增强任务列表组件
  - [x] SubTask 7.1: 修改 `src/components/Scheduler/ListView.tsx` 支持展开/收起
  - [x] SubTask 7.2: 创建子任务展开视图组件 `SubtaskExpandedView.tsx`
  - [x] SubTask 7.3: 实现子任务状态颜色编码
  - [x] SubTask 7.4: 实现掌握度进度条显示
  - [x] SubTask 7.5: 添加子任务类型统计显示（学习x/复习x/练习x/测验x）

- [x] Task 8: 创建子任务状态组件
  - [x] SubTask 8.1: 创建 `LearningStateBadge.tsx` 状态徽章组件
  - [x] SubTask 8.2: 创建 `MasteryProgressBar.tsx` 掌握度进度条组件
  - [x] SubTask 8.3: 创建 `SubtaskStateIcon.tsx` 状态图标组件

## Phase 5: UI实现 - 日历视图

- [x] Task 9: 实现日历子任务展示
  - [x] SubTask 9.1: 创建 `CalendarSubtaskStack.tsx` 堆叠卡片组件
  - [x] SubTask 9.2: 修改 `CalendarMonthView.tsx` 支持子任务展示
  - [x] SubTask 9.3: 修改 `CalendarWeekView.tsx` 支持子任务展示
  - [x] SubTask 9.4: 修改 `CalendarDayView.tsx` 支持子任务展示
  - [x] SubTask 9.5: 添加工具栏显示开关组件

- [x] Task 10: 实现子任务详情弹窗
  - [x] SubTask 10.1: 创建 `SubtaskDetailModal.tsx` 详情弹窗
  - [x] SubTask 10.2: 显示知识点信息、学习状态、掌握度
  - [x] SubTask 10.3: 支持状态转换操作

## Phase 6: Quiz系统集成

- [x] Task 11: 集成练习和测验功能
  - [x] SubTask 11.1: 实现练习状态关联简单难度学习卡片
  - [x] SubTask 11.2: 实现测验状态关联测验集合
  - [x] SubTask 11.3: 实现练习/测验完成后更新掌握度
  - [x] SubTask 11.4: 实现AI自动生成练习/测验题目

## Phase 7: 测试与验证

- [x] Task 12: 编写单元测试
  - [x] SubTask 12.1: 状态机服务单元测试
  - [x] SubTask 12.2: 掌握度衰减服务单元测试
  - [x] SubTask 12.3: 同步服务单元测试

- [x] Task 13: 编写E2E测试
  - [x] SubTask 13.1: 子任务状态转换流程测试
  - [x] SubTask 13.2: 掌握度衰减和复习触发测试
  - [x] SubTask 13.3: 日历子任务展示测试

---

# Task Dependencies

- Task 2 依赖 Task 1（类型定义先行）
- Task 3, 4, 5 可并行执行
- Task 6 依赖 Task 1, 2, 3, 4, 5
- Task 7, 8 可并行执行，依赖 Task 6
- Task 9, 10 可并行执行，依赖 Task 6
- Task 11 依赖 Task 3, 6
- Task 12, 13 依赖所有前置任务完成
