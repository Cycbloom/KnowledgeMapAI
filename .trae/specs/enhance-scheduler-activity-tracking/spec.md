# 增强调度器：自动任务生成 + 活动追踪 + 日历双模式（修订版）

## Why

当前调度器虽然具备任务队列、智能推荐和学习循环等功能，但缺少三个关键能力：1) 用户开始学习时无法自动生成对应任务；2) 日历只展示任务和执行记录，没有「规划/历史」双模式视图；3) 应用内的用户活动没有被系统化记录和展示。这些缺失导致用户无法直观看到自己的学习轨迹，也无法通过日历高效规划未来和回顾过去。

## What Changes

- 新增 `user_activities` 数据库表，记录用户在应用内的学习活动
- 新增活动追踪服务（后端），统一记录用户活动
- 新增活动追踪 API 路由，提供活动的 CRUD 和查询
- 增强日历页面，新增「规划日历」和「历史日历」双模式切换
- 规划日历：展示未来计划的任务、学习路径节点、复习计划
- 历史日历：展示过去的活动记录、任务执行、专注会话等
- 新增智能任务关联机制：优先使用学习路径任务，其次自动生成独立任务
- 新增前端活动记录钩子，在关键用户操作时自动记录活动
- 新增活动时间线组件，在日历历史模式下展示活动流

## Impact

- Affected specs: 调度器核心功能、日历页面、学习模式页面
- Affected code:
  - `supabase/migrations/` - 修改 user_activities 表（精简活动类型）
  - `api/services/` - 修改 activityService，增强 autoTaskGenerator
  - `api/routes/` - 修改活动 API 路由
  - `src/pages/CalendarPage.tsx` - 重构为双模式日历
  - `src/components/Calendar/` - 新增规划/历史视图组件
  - `src/types/calendar.ts` - 修改活动类型定义
  - `src/services/api/` - 修改活动 API 客户端
  - `src/hooks/` - 修改活动追踪钩子
  - `src/pages/LearningMode.tsx` - 修改活动记录逻辑

## ADDED Requirements

### Requirement: 用户活动追踪（精简版）

系统 SHALL 记录用户在应用内的学习活动，仅包含以下三种核心活动类型：

| 活动类型     | 代码            | 图标      | 颜色   | 说明                                       |
| ------------ | --------------- | --------- | ------ | ------------------------------------------ |
| 专注学习     | `focus_study`   | Brain     | purple | 用户进入专注模式学习，包含阅读资料、计时等 |
| 复习知识点   | `review`        | RotateCcw | green  | 用户完成 SM2 间隔复习                      |
| 学习路径进展 | `path_progress` | Route     | indigo | 用户在学习路径中取得进展                   |

#### Scenario: 用户进入专注模式学习

- **WHEN** 用户在知识点上启动专注模式或进入学习模式阅读资料
- **THEN** 系统自动记录一条 `focus_study` 类型的活动，包含知识点 ID、时长、关联任务等信息

#### Scenario: 用户完成复习

- **WHEN** 用户完成一个知识点的 SM2 复习
- **THEN** 系统自动记录一条 `review` 类型的活动，包含知识点 ID、评分

#### Scenario: 学习路径进展

- **WHEN** 用户完成学习路径中的某个节点
- **THEN** 系统自动记录一条 `path_progress` 类型的活动，包含路径 ID、节点 ID、进度

#### Scenario: 查询用户活动

- **WHEN** 用户请求某个日期范围内的活动列表
- **THEN** 系统返回按时间排序的活动列表，每条活动包含类型、时间、关联资源、持续时间等

### Requirement: 智能任务关联与生成

系统 SHALL 在用户开始学习时智能关联或生成对应的调度任务，遵循以下优先级：

**优先级顺序**：

1. **学习路径任务**：如果知识点属于某个活跃的学习路径，使用路径中对应的子任务
2. **自动生成任务**：如果没有关联的学习路径，自动生成独立的学习任务

#### Scenario: 知识点在学习路径中

- **WHEN** 用户打开某个图谱并进入学习模式
- **AND** 该图谱的知识点属于某个活跃的学习路径
- **THEN** 系统自动关联到学习路径中对应的子任务，显示任务进度和预计时间
- **AND** 用户的学习活动记录到该子任务下

#### Scenario: 知识点不在学习路径中

- **WHEN** 用户打开某个图谱并进入学习模式
- **AND** 该图谱的知识点不属于任何活跃的学习路径
- **THEN** 系统检查是否已存在该知识点的学习任务
- **IF** 存在，则复用已有任务
- **ELSE** 自动创建一个「学习: {知识点标题}」的 scheduled_task，放入 Q1 队列

#### Scenario: 知识点需要复习

- **WHEN** SM2 算法判定某个知识点到达复习时间
- **THEN** 系统自动创建一个「复习: {知识点标题}」的 scheduled_task，放入 Q0 队列（高优先级），设置 scheduled_start 为当天

#### Scenario: 避免重复生成

- **WHEN** 用户再次进入已创建任务的知识点
- **THEN** 系统不重复创建任务，而是复用已有任务

### Requirement: 日历双模式（规划/历史）

日历页面 SHALL 提供「规划日历」和「历史日历」两种模式，用户可自由切换。

#### Scenario: 切换到规划日历

- **WHEN** 用户点击「规划」模式标签
- **THEN** 日历展示未来的计划任务、学习路径节点、复习计划，不展示过去的活动记录

#### Scenario: 切换到历史日历

- **WHEN** 用户点击「历史」模式标签
- **THEN** 日历展示过去的活动记录、任务执行、专注会话，不展示未来的计划任务

#### Scenario: 规划日历月视图

- **WHEN** 用户在规划模式下查看月视图
- **THEN** 每个日期格显示该日计划的任务数量和预计总时长，点击可查看详情

#### Scenario: 历史日历月视图

- **WHEN** 用户在历史模式下查看月视图
- **THEN** 每个日期格显示该日的活动热力图（颜色深浅表示活动量），点击可查看活动时间线

#### Scenario: 历史日历活动时间线

- **WHEN** 用户在历史模式下点击某一天
- **THEN** 展示该天的活动时间线，按时间顺序展示所有活动（专注学习、复习、路径进展），每条活动显示类型图标、标题、时长

## MODIFIED Requirements

### Requirement: 日历页面数据加载

日历页面的数据加载逻辑 SHALL 根据当前模式（规划/历史）加载不同的数据源：

- 规划模式：加载 `scheduled_tasks`（状态为 pending/in_progress）+ `learning_path_nodes`（未完成）+ `knowledge_review_tasks`（待复习）
- 历史模式：加载 `user_activities` + `task_executions` + `focus_sessions`（已完成）

### Requirement: CalendarEvent 类型

CalendarEvent 类型 SHALL 扩展支持活动类型：

- 新增 `mode` 字段：`'plan' | 'history'`
- 新增 `activityType` 字段，用于历史模式下的活动类型标识（仅支持 focus_study、review、path_progress）
- 新增 `activityData` 字段，存储活动的额外数据

## REMOVED Requirements

### Requirement: 细化的活动类型

**Reason**: 活动类型过于细化，用户不关心"创建图谱"、"编辑节点"、"完成任务"等细粒度操作。精简为三种核心活动类型：专注学习、复习、学习路径进展。

**Migration**:

- 删除 `create_graph`、`edit_node`、`complete_task`、`read_material` 活动类型
- 将 `read_material` 合并到 `focus_study` 中
- 更新数据库 CHECK 约束
- 更新前端类型定义和 UI 组件
