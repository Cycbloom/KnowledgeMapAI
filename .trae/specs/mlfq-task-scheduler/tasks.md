# Tasks

## Phase 1: 数据库设计与后端基础

- [x] Task 1: 创建数据库迁移文件
  - [x] SubTask 1.1: 创建 `scheduled_tasks` 表（任务表）
  - [x] SubTask 1.2: 创建 `task_executions` 表（执行历史表）
  - [x] SubTask 1.3: 创建 `task_tags` 表（任务标签表）
  - [x] SubTask 1.4: 创建 `task_settings` 表（用户设置表）
  - [x] SubTask 1.5: 添加必要的索引和约束

- [x] Task 2: 创建后端服务层
  - [x] SubTask 2.1: 创建 `schedulerService.ts` - 任务调度核心服务
  - [x] SubTask 2.2: 实现三层反馈队列调度算法
  - [x] SubTask 2.3: 实现任务CRUD操作
  - [x] SubTask 2.4: 实现任务执行记录功能
  - [x] SubTask 2.5: 实现任务统计查询功能

- [x] Task 3: 创建API路由
  - [x] SubTask 3.1: 创建 `scheduler.ts` 路由文件
  - [x] SubTask 3.2: 实现任务创建/编辑/删除接口
  - [x] SubTask 3.3: 实现任务调度接口（开始/暂停/完成）
  - [x] SubTask 3.4: 实现队列操作接口（排序/移动）
  - [x] SubTask 3.5: 实现统计查询接口
  - [x] SubTask 3.6: 添加请求验证schema

## Phase 2: 前端基础组件

- [x] Task 4: 创建前端API服务
  - [x] SubTask 4.1: 创建 `src/services/api/scheduler.ts` - API客户端
  - [x] SubTask 4.2: 定义TypeScript类型接口
  - [x] SubTask 4.3: 创建React Query hooks

- [x] Task 5: 创建核心UI组件
  - [x] SubTask 5.1: 创建 `TaskCard.tsx` - 任务卡片组件
  - [x] SubTask 5.2: 创建 `QueueColumn.tsx` - 队列列组件
  - [x] SubTask 5.3: 创建 `TaskTimer.tsx` - 番茄钟计时器组件
  - [x] SubTask 5.4: 创建 `TaskForm.tsx` - 任务创建/编辑表单
  - [x] SubTask 5.5: 创建 `TaskDetail.tsx` - 任务详情组件

## Phase 3: 页面开发

- [x] Task 6: 创建任务调度主页面
  - [x] SubTask 6.1: 创建 `src/pages/Scheduler/index.ts` - 导出文件
  - [x] SubTask 6.2: 创建 `SchedulerPage.tsx` - 主页面组件
  - [x] SubTask 6.3: 实现三列队列视图布局
  - [x] SubTask 6.4: 实现拖拽排序功能
  - [x] SubTask 6.5: 实现任务自动调度逻辑

- [x] Task 7: 创建当前任务视图
  - [x] SubTask 7.1: 创建 `CurrentTaskView.tsx` - 当前任务视图
  - [x] SubTask 7.2: 实现番茄钟计时器UI
  - [x] SubTask 7.3: 实现休息提醒UI
  - [x] SubTask 7.4: 实现任务完成确认流程

- [x] Task 8: 创建统计与历史页面
  - [x] SubTask 8.1: 创建 `TaskHistory.tsx` - 执行历史页面
  - [x] SubTask 8.2: 创建 `TaskStats.tsx` - 统计仪表盘
  - [x] SubTask 8.3: 创建 `TaskHeatmap.tsx` - 热力图组件
  - [x] SubTask 8.4: 创建 `EfficiencyChart.tsx` - 效率分析图表

## Phase 4: 科技感UI与动效

- [x] Task 9: 实现科技感UI样式
  - [x] SubTask 9.1: 创建科技感主题CSS变量
  - [x] SubTask 9.2: 实现简约线条设计风格
  - [x] SubTask 9.3: 实现动态流动效果动画
  - [x] SubTask 9.4: 实现数据可视化仪表盘样式

- [x] Task 10: 实现多视图切换
  - [x] SubTask 10.1: 创建 `SchedulerViews.tsx` - 视图切换组件
  - [x] SubTask 10.2: 实现时间轴视图
  - [x] SubTask 10.3: 实现看板视图
  - [x] SubTask 10.4: 实现列表视图

## Phase 5: 提醒与集成功能

- [x] Task 11: 实现提醒功能
  - [x] SubTask 11.1: 实现浏览器通知服务
  - [x] SubTask 11.2: 实现声音提示功能
  - [x] SubTask 11.3: 实现截止日期提醒
  - [x] SubTask 11.4: 实现休息提醒

- [x] Task 12: 系统集成
  - [x] SubTask 12.1: 实现知识图谱关联功能
  - [x] SubTask 12.2: 实现学习卡片关联功能
  - [x] SubTask 12.3: 集成成就系统
  - [x] SubTask 12.4: 添加路由配置

## Phase 6: 测试与优化

- [x] Task 13: 测试与优化
  - [x] SubTask 13.1: 编写后端单元测试
  - [x] SubTask 13.2: 编写前端组件测试
  - [x] SubTask 13.3: 性能优化
  - [x] SubTask 13.4: 用户体验优化

# Task Dependencies
- [Task 2] depends on [Task 1]
- [Task 3] depends on [Task 2]
- [Task 4] depends on [Task 3]
- [Task 5] depends on [Task 4]
- [Task 6] depends on [Task 5]
- [Task 7] depends on [Task 5]
- [Task 8] depends on [Task 4]
- [Task 9] depends on [Task 6]
- [Task 10] depends on [Task 6]
- [Task 11] depends on [Task 7]
- [Task 12] depends on [Task 6, Task 7, Task 8]
- [Task 13] depends on [Task 12]
