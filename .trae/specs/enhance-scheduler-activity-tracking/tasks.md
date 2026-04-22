# Tasks

- [x] Task 1: 精简活动类型定义
  - [x] SubTask 1.1: 修改 `supabase/migrations/11_focus_and_notifications.sql` 中的 user_activities 表 CHECK 约束，只保留 `focus_study`、`review`、`path_progress` 三种类型
  - [x] SubTask 1.2: 修改 `src/types/calendar.ts` 中的 ActivityEventType 和 ACTIVITY_TYPE_CONFIG，删除多余的活动类型
  - [x] SubTask 1.3: 修改 `api/services/scheduler/activityService.ts` 中的 ActivityType 类型定义

- [x] Task 2: 更新后端活动服务和路由
  - [x] SubTask 2.1: 修改 `api/routes/scheduler/activities.ts` 中的 Zod schema，只允许三种活动类型
  - [x] SubTask 2.2: 修改 `api/services/scheduler/activityService.ts` 中的类型定义

- [x] Task 3: 更新前端活动 API 和钩子
  - [x] SubTask 3.1: 修改 `src/services/api/modules/scheduler/activities.ts` 中的类型定义
  - [x] SubTask 3.2: 修改 `src/hooks/useActivityTracker.ts` 中的活动类型

- [x] Task 4: 实现智能任务关联服务
  - [x] SubTask 4.1: 创建 `api/services/scheduler/smartTaskLinker.ts`，实现 `findPathTaskForKnowledgePoint` 方法（查找知识点是否属于活跃学习路径）
  - [x] SubTask 4.2: 实现 `getOrCreateTaskForKnowledgePoint` 方法，优先返回学习路径任务，其次自动生成独立任务
  - [x] SubTask 4.3: 在 `api/routes/scheduler/activities.ts` 中添加 `/link-task` 端点，返回关联的任务信息

- [x] Task 5: 集成智能任务关联到学习模式
  - [x] SubTask 5.1: 修改 `src/pages/LearningMode.tsx`，在进入学习模式时调用 `/link-task` 端点获取关联任务
  - [x] SubTask 5.2: 显示关联的任务信息（任务标题、进度、预计时间）
  - [x] SubTask 5.3: 将学习活动记录到关联任务下

- [x] Task 6: 更新活动追踪集成
  - [x] SubTask 6.1: 修改 `src/pages/LearningMode.tsx`，将 `read_material` 改为 `focus_study`
  - [x] SubTask 6.2: 修改 `src/components/Learning/LearningFocusPanel.tsx`，确保专注会话记录为 `focus_study`
  - [x] SubTask 6.3: 修改 `src/components/Learning/LearningPathPanel.tsx`，确保路径进展记录为 `path_progress`

- [x] Task 7: 更新日历组件
  - [x] SubTask 7.1: 修改 `src/components/Calendar/ActivityTimeline.tsx`，只显示三种活动类型的图标和颜色

- [x] Task 8: 验证和测试
  - [x] SubTask 8.1: 运行 `npm run lint` 和 `npm run check` 确保代码质量
  - [x] SubTask 8.2: 验证活动类型精简后的端到端流程
  - [x] SubTask 8.3: 验证智能任务关联功能

# Task Dependencies

- [Task 2] depends on [Task 1]
- [Task 3] depends on [Task 1]
- [Task 4] has no dependencies (can parallel with Task 1-3)
- [Task 5] depends on [Task 3, Task 4]
- [Task 6] depends on [Task 3]
- [Task 7] depends on [Task 1]
- [Task 8] depends on [Task 5, Task 6, Task 7]
