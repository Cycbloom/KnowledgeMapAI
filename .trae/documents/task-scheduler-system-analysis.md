# 任务调度系统架构分析报告

## 一、系统概述

这是一个基于三级反馈队列的任务调度系统，融合了番茄工作法、GTD 理念和 AI 辅助功能，支持多种任务类型和进度管理模式。

---

## 二、数据库架构

### 核心表结构

| 表名 | 功能描述 |
|------|----------|
| `queues` | 可配置的任务队列（支持自定义时间片、优先级） |
| `scheduled_tasks` | 计划任务主表（支持多种任务类型） |
| `task_executions` | 任务执行记录 |
| `task_dependencies` | 任务依赖关系 |
| `task_schedules` | 周期性任务调度配置 |
| `task_progress_plans` | 任务进度计划 |
| `user_time_slots` | 用户可用时间段设置 |
| `task_settings` | 用户任务偏好设置 |
| `task_templates` | 任务模板 |
| `focus_sessions` | 专注会话记录 |
| `user_focus_stats` | 用户专注统计 |
| `achievements` | 成就系统 |

### 表关系图

```
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│     users       │────>│   scheduled_tasks    │<────│     queues      │
└─────────────────┘     └──────────────────────┘     └─────────────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        │                      │                      │
        v                      v                      v
┌───────────────────┐  ┌───────────────────┐  ┌───────────────────┐
│ task_executions   │  │ task_dependencies │  │ task_schedules    │
└───────────────────┘  └───────────────────┘  └───────────────────┘
        │
        v
┌───────────────────┐
│task_progress_plans│
└───────────────────┘
```

---

## 三、API 端点汇总

### 任务管理 (12 个端点)
| 方法 | 端点 | 功能 |
|------|------|------|
| POST | `/scheduler/tasks` | 创建任务 |
| GET | `/scheduler/tasks` | 获取任务列表 |
| GET | `/scheduler/tasks/:id` | 获取单个任务 |
| GET | `/scheduler/tasks/:id/detail` | 获取任务详情 |
| PUT | `/scheduler/tasks/:id` | 更新任务 |
| DELETE | `/scheduler/tasks/:id` | 删除任务 |
| POST | `/scheduler/tasks/:id/start` | 开始任务 |
| POST | `/scheduler/tasks/:id/pause` | 暂停任务 |
| POST | `/scheduler/tasks/:id/complete` | 完成任务 |
| POST | `/scheduler/tasks/:id/demote` | 任务降级 |
| PUT | `/scheduler/tasks/:id/move` | 移动任务 |
| PUT | `/scheduler/tasks/reorder` | 重排序任务 |

### 队列管理 (4 个端点)
| 方法 | 端点 | 功能 |
|------|------|------|
| GET | `/scheduler/queues` | 获取所有队列 |
| POST | `/scheduler/queues` | 创建队列 |
| PUT | `/scheduler/queues/:id` | 更新队列 |
| DELETE | `/scheduler/queues/:id` | 删除队列 |

### 专注会话 (8 个端点)
| 方法 | 端点 | 功能 |
|------|------|------|
| POST | `/scheduler/focus-sessions` | 创建专注会话 |
| PUT | `/scheduler/focus-sessions/:id` | 更新专注会话 |
| GET | `/scheduler/focus-sessions` | 获取专注会话列表 |
| GET | `/scheduler/focus-stats` | 获取专注统计 |
| GET | `/scheduler/focus-stats/daily` | 每日统计 |
| GET | `/scheduler/focus-stats/weekly` | 每周统计 |
| GET | `/scheduler/focus-stats/monthly` | 每月统计 |
| GET | `/scheduler/focus-stats/heatmap` | 年度热力图 |

### 任务依赖 (4 个端点)
| 方法 | 端点 | 功能 |
|------|------|------|
| POST | `/scheduler/tasks/:id/dependencies` | 添加依赖 |
| DELETE | `/scheduler/tasks/:id/dependencies/:dependencyId` | 删除依赖 |
| GET | `/scheduler/tasks/:id/dependencies` | 获取前置依赖 |
| GET | `/scheduler/tasks/:id/dependents` | 获取后置任务 |

### 进度计划 (4 个端点)
| 方法 | 端点 | 功能 |
|------|------|------|
| POST | `/scheduler/tasks/:id/progress-plan` | 创建进度计划 |
| PUT | `/scheduler/tasks/:id/progress-plan` | 更新进度计划 |
| GET | `/scheduler/tasks/:id/progress-plan` | 获取进度计划 |
| POST | `/scheduler/tasks/:id/progress` | 更新任务进度 |

### 周期调度 (4 个端点)
| 方法 | 端点 | 功能 |
|------|------|------|
| POST | `/scheduler/schedules` | 创建周期调度 |
| PUT | `/scheduler/schedules/:id` | 更新周期调度 |
| DELETE | `/scheduler/schedules/:id` | 删除周期调度 |
| GET | `/scheduler/schedules` | 获取周期调度列表 |

### 时间段设置 (4 个端点)
| 方法 | 端点 | 功能 |
|------|------|------|
| GET | `/scheduler/time-slots` | 获取时间段设置 |
| POST | `/scheduler/time-slots` | 创建时间段 |
| PUT | `/scheduler/time-slots/:id` | 更新时间段 |
| DELETE | `/scheduler/time-slots/:id` | 删除时间段 |

### 任务模板 (8 个端点)
| 方法 | 端点 | 功能 |
|------|------|------|
| GET | `/scheduler/templates` | 获取模板列表 |
| GET | `/scheduler/templates/categories` | 获取模板分类 |
| GET | `/scheduler/templates/:id` | 获取单个模板 |
| POST | `/scheduler/templates` | 创建模板 |
| PUT | `/scheduler/templates/:id` | 更新模板 |
| DELETE | `/scheduler/templates/:id` | 删除模板 |
| POST | `/scheduler/templates/:id/apply` | 应用模板创建任务 |
| POST | `/scheduler/templates/:id/duplicate` | 复制模板 |

### AI 辅助 (5 个端点)
| 方法 | 端点 | 功能 |
|------|------|------|
| POST | `/scheduler/generate-details` | AI 生成任务详情 |
| GET | `/scheduler/recommendations` | 获取任务推荐 |
| GET | `/scheduler/smart-suggestions` | 获取智能建议 |
| POST | `/scheduler/analyze-priority` | 分析任务优先级 |
| GET | `/scheduler/efficiency-data` | 获取效率数据 |

### 成就系统 (3 个端点)
| 方法 | 端点 | 功能 |
|------|------|------|
| GET | `/scheduler/achievements` | 获取所有成就 |
| GET | `/scheduler/achievements/user` | 获取用户成就 |
| POST | `/scheduler/achievements/check` | 检查并解锁成就 |

### 统计分析 (2 个端点)
| 方法 | 端点 | 功能 |
|------|------|------|
| GET | `/scheduler/stats` | 获取统计数据 |
| GET | `/scheduler/heatmap` | 获取热力图数据 |

### 设置 (2 个端点)
| 方法 | 端点 | 功能 |
|------|------|------|
| GET | `/scheduler/settings` | 获取用户设置 |
| PUT | `/scheduler/settings` | 更新用户设置 |

---

## 四、前端组件架构

### 组件目录结构

```
src/components/Scheduler/
├── 核心组件
│   ├── TaskCard.tsx              # 任务卡片
│   ├── DraggableTaskCard.tsx     # 可拖拽任务卡片
│   ├── TaskForm.tsx              # 任务创建/编辑表单
│   ├── TaskDetail.tsx            # 任务详情
│   ├── TaskDetailPanel.tsx       # 任务详情面板
│   └── TaskTimer.tsx             # 任务计时器
│
├── 视图组件
│   ├── SchedulerViews.tsx        # 调度器视图切换
│   ├── KanbanView.tsx            # 看板视图
│   ├── ListView.tsx              # 列表视图
│   └── TimelineView.tsx          # 时间线视图
│
├── 队列组件
│   ├── QueueColumn.tsx           # 队列列
│   ├── QueueSettings.tsx         # 队列设置
│   ├── HorizontalQueue.tsx       # 水平队列
│   └── HorizontalQueueView.tsx   # 水平队列视图
│
├── 专注模式
│   ├── FocusMode.tsx             # 专注模式
│   ├── FocusStreak.tsx           # 专注连续天数
│   ├── FocusHeatmap.tsx          # 专注热力图
│   ├── BreakTimer.tsx            # 休息计时器
│   └── MiniTimer.tsx             # 迷你计时器
│
├── 进度与依赖
│   ├── ProgressTimeline.tsx      # 进度时间线
│   ├── ProgressSection.tsx       # 进度区块
│   ├── DependencySection.tsx     # 依赖区块
│   ├── DependencyGraph.tsx       # 依赖图
│   └── TaskDependencyGraph.tsx   # 任务依赖图
│
├── 模板系统
│   ├── TaskTemplateSelector.tsx  # 任务模板选择器
│   ├── TemplateForm.tsx          # 模板表单
│   └── TemplateCategory.tsx      # 模板分类
│
├── 统计报告
│   ├── DailyStats.tsx            # 每日统计
│   ├── DailyReview.tsx           # 每日回顾
│   ├── WeeklyReport.tsx          # 周报
│   ├── WeeklyReflection.tsx      # 周反思
│   ├── MonthlyReport.tsx         # 月报
│   ├── TimeAnalysis.tsx          # 时间分析
│   └── EfficiencyTrend.tsx       # 效率趋势
│
├── 成就系统
│   ├── AchievementGallery.tsx    # 成就画廊
│   ├── AchievementBadge.tsx      # 成就徽章
│   └── AchievementNotification.tsx # 成就通知
│
├── AI 辅助
│   ├── TaskRecommendation.tsx    # 任务推荐
│   └── SmartSuggestion.tsx       # 智能建议
│
├── 其他
│   ├── TaskRetrospect.tsx        # 任务回顾
│   ├── TaskDistribution.tsx      # 任务分布统计
│   ├── PomodoroSettings.tsx      # 番茄钟设置
│   ├── TimeSlotSettings.tsx      # 时间段设置
│   ├── HotkeyHelp.tsx            # 快捷键帮助
│   └── ActiveTaskPanel.tsx       # 活动任务面板
```

---

## 五、已实现的核心功能

### 1. 三级反馈队列系统 ✅
- **Q0 (专注队列)**: 高优先级任务，默认 25 分钟时间片
- **Q1 (标准队列)**: 常规任务，默认 50 分钟时间片
- **Q2 (后台队列)**: 低优先级任务，默认 100 分钟时间片
- 支持任务在队列间移动和降级
- 支持自定义队列配置

### 2. 任务类型支持 ✅
- **一次性任务**: 单次完成
- **长期项目**: 多天完成，支持进度分配
- **周期性任务**: 按日/周/自定义周期重复
- **学习任务**: 关联知识点

### 3. 进度管理 ✅
- 平均分配、递减、递增、自定义四种进度模式
- 每日进度计划和跟踪
- 进度百分比计算

### 4. 任务依赖 ✅
- 严格依赖: 必须完成后才能开始
- 软依赖: 建议但不强制
- 循环依赖检测

### 5. 专注模式 ✅
- 全屏沉浸式界面
- 白噪音背景（雨声、咖啡厅、森林、海浪、篝火）
- 番茄钟计时
- 休息提醒

### 6. 统计分析 ✅
- 日/周/月统计
- 热力图展示
- 效率趋势分析
- 任务分布统计

### 7. 成就系统 ✅
- 多种成就类型（专注、任务、连续天数、特殊）
- 自动解锁检测
- XP 奖励

### 8. AI 辅助 ✅
- 自动生成任务描述和标签
- 优先级智能建议
- 任务推荐

### 9. 任务模板 ✅
- 系统预设模板
- 用户自定义模板
- 占位符支持
- 分类管理

### 10. 时间段管理 ✅
- 按星期设置可用时间
- 全局时间段
- 标签和状态管理

---

## 六、整体架构设计

```
┌─────────────────────────────────────────────────────────────────┐
│                         前端 (React + TypeScript)               │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │  Scheduler  │  │   Hooks     │  │   Utils     │              │
│  │ Components  │  │(useScheduler)│  │(Notifications)│            │
│  └──────┬──────┘  └──────┬──────┘  └─────────────┘              │
│         │                │                                       │
│         └────────┬───────┘                                       │
│                  │                                               │
│         ┌────────▼────────┐                                      │
│         │  API Services   │                                      │
│         │ (schedulerApi)  │                                      │
│         └────────┬────────┘                                      │
└──────────────────┼──────────────────────────────────────────────┘
                   │ HTTP/REST
┌──────────────────▼──────────────────────────────────────────────┐
│                         后端 (Hono + Node.js)                    │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                   API Routes (scheduler.ts)              │    │
│  └────────────────────────────┬────────────────────────────┘    │
│                               │                                  │
│  ┌────────────────────────────▼────────────────────────────┐    │
│  │              Service Layer (schedulerService.ts)         │    │
│  └────────────────────────────┬────────────────────────────┘    │
│                               │                                  │
│  ┌────────────────────────────▼────────────────────────────┐    │
│  │                    AI Service                            │    │
│  └────────────────────────────┬────────────────────────────┘    │
└───────────────────────────────┼─────────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────────┐
│                      数据库 (Supabase/PostgreSQL)                │
└─────────────────────────────────────────────────────────────────┘
```

---

## 七、设计特点

1. **三层架构**: 前端组件 → API 路由 → 服务层 → 数据库
2. **类型安全**: 完整的 TypeScript 类型定义
3. **实时更新**: React Query 缓存和自动刷新
4. **软删除**: 任务删除采用软删除，支持恢复
5. **RLS 安全**: 行级安全策略确保数据隔离
6. **AI 增强**: 集成 AI 辅助任务创建和分析

---

## 八、潜在扩展方向

基于当前架构，以下是一些可能的功能扩展方向：

### 1. 协作功能
- 任务共享与协作
- 团队队列
- 任务委派

### 2. 日历集成
- 与外部日历同步（Google Calendar、Outlook）
- 日历视图
- 会议时间预留

### 3. 智能调度
- 基于历史数据的智能时间估算
- 自动任务安排
- 工作负载平衡

### 4. 移动端支持
- PWA 支持
- 移动端适配
- 离线模式

### 5. 数据分析增强
- 更详细的时间分析
- 效率报告导出
- 自定义报表

### 6. 提醒与通知
- 浏览器推送通知
- 邮件提醒
- 自定义提醒规则

---

## 九、文件位置索引

### 数据库
- Schema: [supabase/migrations/00000000000000_initial_schema.sql](file:///d:/KnowledgeMap/supabase/migrations/00000000000000_initial_schema.sql)
- Seed: [supabase/migrations/00000000000001_initial_seed.sql](file:///d:/KnowledgeMap/supabase/migrations/00000000000001_initial_seed.sql)

### 后端
- API 路由: [api/routes/scheduler.ts](file:///d:/KnowledgeMap/api/routes/scheduler.ts)
- 服务层: [api/services/schedulerService.ts](file:///d:/KnowledgeMap/api/services/schedulerService.ts)
- 任务推荐: [api/services/taskRecommendationService.ts](file:///d:/KnowledgeMap/api/services/taskRecommendationService.ts)

### 前端
- 组件: [src/components/Scheduler/](file:///d:/KnowledgeMap/src/components/Scheduler/)
- 类型定义: [src/types/index.ts](file:///d:/KnowledgeMap/src/types/index.ts)
- API 服务: [src/services/api/scheduler.ts](file:///d:/KnowledgeMap/src/services/api/scheduler.ts)
- Hooks: [src/hooks/useScheduler.ts](file:///d:/KnowledgeMap/src/hooks/useScheduler.ts)
