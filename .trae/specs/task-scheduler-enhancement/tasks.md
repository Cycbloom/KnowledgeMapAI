# Tasks

## Phase 1: 番茄钟深度联动

- [x] Task 1: 实现专注模式功能
  - [x] SubTask 1.1: 创建 `FocusMode.tsx` 专注模式组件
  - [x] SubTask 1.2: 实现白噪音播放功能（雨声、咖啡厅、森林等）
  - [x] SubTask 1.3: 实现专注模式下的干扰屏蔽提示
  - [x] SubTask 1.4: 添加专注模式进入/退出动画效果

- [x] Task 2: 实现自动休息流转
  - [x] SubTask 2.1: 创建 `BreakTimer.tsx` 休息计时器组件
  - [x] SubTask 2.2: 实现番茄钟完成后的自动休息提示
  - [x] SubTask 2.3: 实现休息结束后的任务继续/切换提示
  - [x] SubTask 2.4: 添加长休息支持（每4个番茄钟后）

- [x] Task 3: 实现连续专注奖励
  - [x] SubTask 3.1: 创建 `FocusStreak.tsx` 连续专注显示组件
  - [x] SubTask 3.2: 实现连续专注时长追踪
  - [x] SubTask 3.3: 添加连续专注的视觉反馈效果
  - [x] SubTask 3.4: 集成成就系统解锁

## Phase 2: 智能任务推荐

- [x] Task 4: 实现智能推荐服务
  - [x] SubTask 4.1: 创建 `taskRecommendationService.ts` 推荐服务
  - [x] SubTask 4.2: 实现基于截止日期的紧急度计算
  - [x] SubTask 4.3: 实现基于历史效率的推荐算法
  - [x] SubTask 4.4: 实现基于时间段的任务类型推荐

- [x] Task 5: 实现AI优先级建议
  - [x] SubTask 5.1: 创建任务优先级分析函数
  - [x] SubTask 5.2: 实现基于任务描述的优先级推断
  - [x] SubTask 5.3: 在任务创建表单中集成优先级建议
  - [x] SubTask 5.4: 添加用户确认/调整优先级的交互

- [x] Task 6: 创建推荐UI组件
  - [x] SubTask 6.1: 创建 `TaskRecommendation.tsx` 推荐卡片组件
  - [x] SubTask 6.2: 创建 `SmartSuggestion.tsx` 智能建议组件
  - [x] SubTask 6.3: 在主页面集成推荐显示

## Phase 3: 任务模板系统

- [x] Task 7: 创建模板数据库表和服务
  - [x] SubTask 7.1: 创建 `task_templates` 数据库迁移
  - [x] SubTask 7.2: 创建 `templateService.ts` 模板服务
  - [x] SubTask 7.3: 实现模板CRUD接口

- [x] Task 8: 实现模板UI组件
  - [x] SubTask 8.1: 创建 `TaskTemplateSelector.tsx` 模板选择组件
  - [x] SubTask 8.2: 创建 `TemplateForm.tsx` 模板创建/编辑表单
  - [x] SubTask 8.3: 创建 `TemplateCategory.tsx` 模板分类组件
  - [x] SubTask 8.4: 预置常用任务模板（学习、工作、生活等）

## Phase 4: 专注统计与成就

- [x] Task 9: 创建专注记录数据库表
  - [x] SubTask 9.1: 创建 `focus_sessions` 数据库迁移
  - [x] SubTask 9.2: 实现专注记录保存服务
  - [x] SubTask 9.3: 实现专注统计查询服务

- [x] Task 10: 实现统计可视化组件
  - [x] SubTask 10.1: 创建 `DailyStats.tsx` 每日统计组件
  - [x] SubTask 10.2: 创建 `WeeklyReport.tsx` 周报组件
  - [x] SubTask 10.3: 创建 `MonthlyReport.tsx` 月报组件
  - [x] SubTask 10.4: 创建 `FocusHeatmap.tsx` 年度热力图组件

- [x] Task 11: 实现成就徽章系统
  - [x] SubTask 11.1: 定义成就规则和徽章设计
  - [x] SubTask 11.2: 创建 `AchievementBadge.tsx` 徽章组件
  - [x] SubTask 11.3: 创建 `AchievementGallery.tsx` 成就展示页
  - [x] SubTask 11.4: 实现成就解锁通知

## Phase 5: 任务回顾与反思

- [x] Task 12: 创建回顾数据库表和服务
  - [x] SubTask 12.1: 创建 `task_reviews` 数据库迁移
  - [x] SubTask 12.2: 创建 `reviewService.ts` 回顾服务
  - [x] SubTask 12.3: 实现回顾CRUD接口

- [x] Task 13: 实现回顾UI组件
  - [x] SubTask 13.1: 创建 `DailyReview.tsx` 每日回顾组件
  - [x] SubTask 13.2: 创建 `TaskRetrospect.tsx` 任务复盘组件
  - [x] SubTask 13.3: 创建 `WeeklyReflection.tsx` 周反思组件
  - [x] SubTask 13.4: 添加回顾提醒功能

## Phase 6: UI交互优化

- [x] Task 14: 实现快捷键支持
  - [x] SubTask 14.1: 创建 `useSchedulerHotkeys.ts` 快捷键Hook
  - [x] SubTask 14.2: 定义快捷键映射（N新建、Space开始/暂停、C完成等）
  - [x] SubTask 14.3: 创建快捷键帮助提示组件
  - [x] SubTask 14.4: 在主页面集成快捷键

- [x] Task 15: 实现迷你模式
  - [x] SubTask 15.1: 创建 `MiniTimer.tsx` 迷你计时器组件
  - [x] SubTask 15.2: 实现迷你模式切换功能
  - [x] SubTask 15.3: 实现窗口置顶功能（Electron API）
  - [x] SubTask 15.4: 添加迷你模式的拖拽定位

- [x] Task 16: 实现进度可视化
  - [x] SubTask 16.1: 创建任务栏进度指示器
  - [x] SubTask 16.2: 实现桌面小组件（可选）

## Phase 7: 数据可视化增强

- [x] Task 17: 增强统计图表
  - [x] SubTask 17.1: 创建 `EfficiencyTrend.tsx` 效率趋势图组件
  - [x] SubTask 17.2: 创建 `TaskDistribution.tsx` 任务分布图组件
  - [x] SubTask 17.3: 创建 `TimeAnalysis.tsx` 时间段分析组件
  - [x] SubTask 17.4: 优化现有热力图显示效果

## Phase 8: 任务依赖关系

- [x] Task 18: 实现任务依赖功能
  - [x] SubTask 18.1: 添加 `depends_on` 字段到任务表
  - [x] SubTask 18.2: 实现依赖关系检查服务
  - [x] SubTask 18.3: 创建 `DependencyGraph.tsx` 依赖关系图组件
  - [x] SubTask 18.4: 实现任务阻塞状态显示

## Phase 9: 番茄钟自定义

- [x] Task 19: 增强番茄钟设置
  - [x] SubTask 19.1: 创建 `PomodoroSettings.tsx` 番茄钟设置组件
  - [x] SubTask 19.2: 实现自定义专注/休息时长
  - [x] SubTask 19.3: 实现长休息间隔设置
  - [x] SubTask 19.4: 实现自适应时间片功能（可选）

# Task Dependencies
- [Task 2] depends on [Task 1]
- [Task 3] depends on [Task 1, Task 2]
- [Task 5] depends on [Task 4]
- [Task 6] depends on [Task 4, Task 5]
- [Task 8] depends on [Task 7]
- [Task 10] depends on [Task 9]
- [Task 11] depends on [Task 9, Task 3]
- [Task 13] depends on [Task 12]
- [Task 15] depends on [Task 14]
- [Task 17] depends on [Task 9]
- [Task 18] depends on [Task 7]
- [Task 19] depends on [Task 1, Task 2]
