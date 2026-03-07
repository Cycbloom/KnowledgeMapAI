# 任务调度系统增强规格文档

## Why

当前任务调度系统存在以下局限性：
1. **时间片与任务时长混淆**：`estimated_duration` 与时间片概念重叠，无法处理需要多个时间片才能完成的长任务
2. **缺乏任务依赖管理**：任务之间无法建立前置/后置关系，无法实现任务拓扑排序
3. **缺乏周期性任务支持**：无法创建每日/每周等周期性重复任务
4. **缺乏进度摊派机制**：无法将长期任务的进度按天分配（类似财务折旧概念）
5. **任务详情展示不足**：缺乏专门的任务详情UI来展示上下文、依赖关系、进度等信息

## What Changes

### 数据库变更

- **新增字段**：`scheduled_tasks` 表增加任务类型、总时长、进度模式、周期配置等字段
- **新增表**：`task_dependencies` 表用于存储任务依赖关系
- **新增表**：`task_schedules` 表用于存储周期性任务的调度配置
- **新增表**：`task_progress_plans` 表用于存储进度摊派计划
- **新增表**：`user_time_slots` 表用于存储用户可用时间段设置

### API 变更

- 新增任务依赖管理 API（添加/删除/查询依赖）
- 新增周期性任务管理 API
- 新增进度摊派 API（创建计划、更新进度）
- 新增用户时间设置 API
- 扩展现有任务 API 支持新字段

### UI 变更

- 新增任务详情页面/弹窗组件
- 新增任务依赖关系可视化组件
- 新增进度时间线组件
- 新增用户时间设置页面
- 扩展任务创建/编辑表单支持新功能

## Impact

- **Affected specs**: 任务调度核心功能、用户时间管理
- **Affected code**: 
  - `api/routes/scheduler.ts` - 扩展任务路由
  - `api/schemas/index.ts` - 新增验证模式
  - `src/types/index.ts` - 新增类型定义
  - `src/components/Scheduler/` - 新增/修改UI组件
  - `supabase/migrations/` - 数据库变更

---

## ADDED Requirements

### Requirement: 任务类型与时长管理

系统应支持区分任务总时长与时间片的概念，允许创建需要多个时间片才能完成的长任务。

#### Scenario: 创建长任务并自动拆分时间片

- **GIVEN** 用户创建一个预计时长为3小时的任务
- **AND** 用户的时间片设置为25分钟
- **WHEN** 系统保存该任务
- **THEN** 系统自动计算需要约7-8个时间片来完成
- **AND** 任务列表显示该任务的总时长和已用时间片数

#### Scenario: 任务类型分类

- **GIVEN** 用户创建新任务
- **WHEN** 选择任务类型
- **THEN** 系统提供以下类型选项：
  - 一次性任务：完成后结束
  - 长期项目任务：支持进度摊派
  - 周期性任务：按周期重复执行
  - 学习任务：关联知识点

### Requirement: 任务依赖关系管理

系统应支持任务之间的依赖关系，包括严格前置依赖和软性优先依赖两种类型。

#### Scenario: 创建严格前置依赖

- **GIVEN** 存在任务A和任务B
- **WHEN** 用户设置任务B严格依赖任务A
- **THEN** 任务B在任务A完成前无法开始
- **AND** 任务列表中显示依赖关系标识

#### Scenario: 创建软性优先依赖

- **GIVEN** 存在任务A和任务B
- **WHEN** 用户设置任务B软性依赖任务A
- **THEN** 任务A完成后任务B优先级自动提升
- **AND** 用户仍可手动开始任务B

#### Scenario: 依赖关系可视化

- **GIVEN** 存在多个有依赖关系的任务
- **WHEN** 用户查看任务详情页
- **THEN** 系统显示依赖关系图
- **AND** 支持点击跳转到相关任务

#### Scenario: 循环依赖检测

- **GIVEN** 用户尝试创建任务依赖
- **WHEN** 该依赖会导致循环依赖
- **THEN** 系统拒绝创建并提示错误

### Requirement: 周期性任务支持

系统应支持创建周期性重复执行的任务，包括每日、每周、自定义周期和智能周期。

#### Scenario: 创建每日任务

- **GIVEN** 用户创建周期性任务
- **WHEN** 选择"每日任务"类型并设置执行时间
- **THEN** 系统每天自动创建该任务的实例
- **AND** 任务列表显示周期标识

#### Scenario: 创建每周任务

- **GIVEN** 用户创建周期性任务
- **WHEN** 选择"每周任务"类型并指定星期几
- **THEN** 系统在指定日期自动创建任务实例

#### Scenario: 创建自定义周期任务

- **GIVEN** 用户创建周期性任务
- **WHEN** 选择"自定义周期"并设置间隔天数
- **THEN** 系统按指定间隔创建任务实例

#### Scenario: 智能周期任务

- **GIVEN** 用户创建智能周期任务
- **WHEN** 任务完成后
- **THEN** 系统根据完成情况动态调整下次执行时间
- **AND** 显示推荐的下次执行时间

### Requirement: 任务进度摊派

系统应支持将长期任务的进度按天分配，提供多种预设模式和自定义分配。

#### Scenario: 创建平均分配进度计划

- **GIVEN** 用户创建一个10天完成的长期任务
- **WHEN** 选择"平均分配"进度模式
- **THEN** 系统将进度平均分配到10天
- **AND** 每天目标进度为10%

#### Scenario: 创建递减模式进度计划

- **GIVEN** 用户创建一个10天完成的长期任务
- **WHEN** 选择"递减模式"进度模式
- **THEN** 系统按递减曲线分配进度
- **AND** 前期完成更多，后期逐渐减少

#### Scenario: 创建递增模式进度计划

- **GIVEN** 用户创建一个10天完成的长期任务
- **WHEN** 选择"递增模式"进度模式
- **THEN** 系统按递增曲线分配进度
- **AND** 前期完成较少，后期逐渐增加

#### Scenario: 自定义进度分配

- **GIVEN** 用户创建长期任务
- **WHEN** 选择"自定义分配"模式
- **THEN** 用户可为每天设置具体的进度目标
- **AND** 系统验证总进度为100%

#### Scenario: 进度追踪与提醒

- **GIVEN** 任务有进度计划
- **WHEN** 到达某一天的进度检查时间
- **THEN** 系统检查实际进度与计划进度的差异
- **AND** 如有偏差，提醒用户调整

### Requirement: 任务详情页面

系统应提供专门的任务详情页面，展示任务的完整信息。

#### Scenario: 查看任务基本信息

- **GIVEN** 用户点击任务查看详情
- **WHEN** 任务详情页面打开
- **THEN** 显示任务标题、描述、标签、优先级、截止日期等基本信息
- **AND** 显示任务类型、总时长、已用时间等统计信息

#### Scenario: 查看任务依赖关系

- **GIVEN** 任务有依赖关系
- **WHEN** 用户查看任务详情页的依赖关系模块
- **THEN** 显示前置任务和后置任务列表
- **AND** 显示依赖关系可视化图

#### Scenario: 查看任务进度时间线

- **GIVEN** 任务有进度计划
- **WHEN** 用户查看任务详情页的进度模块
- **THEN** 显示进度时间线
- **AND** 标注每日计划和实际进度
- **AND** 显示执行历史记录

#### Scenario: 查看关联资源

- **GIVEN** 任务关联了知识点或其他资源
- **WHEN** 用户查看任务详情页的关联资源模块
- **THEN** 显示关联的知识点卡片
- **AND** 支持点击跳转到知识点详情

### Requirement: 用户时间设置

系统应支持用户设置每日可用时间段，用于任务调度参考。

#### Scenario: 设置可用时间段

- **GIVEN** 用户进入时间设置页面
- **WHEN** 设置每天的可用时间段（如9:00-12:00, 14:00-18:00）
- **THEN** 系统保存用户的时间偏好
- **AND** 任务推荐时考虑可用时间

#### Scenario: 设置不可用日期

- **GIVEN** 用户进入时间设置页面
- **WHEN** 标记某些日期为不可用（如周末、假期）
- **THEN** 系统在这些日期不自动安排任务

#### Scenario: 时间冲突检测

- **GIVEN** 用户有可用时间设置
- **WHEN** 任务截止日期临近但可用时间不足
- **THEN** 系统发出警告提醒

---

## MODIFIED Requirements

### Requirement: 任务创建接口扩展

原有任务创建接口需要支持新增的字段。

#### Scenario: 创建任务时指定类型

- **GIVEN** 用户创建新任务
- **WHEN** 提交任务数据包含 task_type 字段
- **THEN** 系统验证并保存任务类型

#### Scenario: 创建任务时指定总时长

- **GIVEN** 用户创建长期任务
- **WHEN** 提交任务数据包含 total_duration 字段
- **THEN** 系统保存任务总时长
- **AND** 自动计算所需时间片数

#### Scenario: 创建任务时指定进度模式

- **GIVEN** 用户创建长期任务
- **WHEN** 提交任务数据包含 progress_mode 字段
- **THEN** 系统保存进度模式
- **AND** 根据模式生成进度计划

---

## REMOVED Requirements

无移除的需求。所有现有功能保持兼容。

---

## 数据库设计

### scheduled_tasks 表扩展字段

```sql
ALTER TABLE scheduled_tasks ADD COLUMN task_type TEXT DEFAULT 'one_time' 
  CHECK (task_type IN ('one_time', 'long_term', 'periodic', 'learning'));
ALTER TABLE scheduled_tasks ADD COLUMN total_duration INTEGER;
ALTER TABLE scheduled_tasks ADD COLUMN progress_mode TEXT 
  CHECK (progress_mode IN ('average', 'decreasing', 'increasing', 'custom'));
ALTER TABLE scheduled_tasks ADD COLUMN progress_percentage INTEGER DEFAULT 0;
ALTER TABLE scheduled_tasks ADD COLUMN parent_task_id UUID REFERENCES scheduled_tasks(id);
ALTER TABLE scheduled_tasks ADD COLUMN context TEXT;
```

### task_dependencies 新表

```sql
CREATE TABLE task_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES scheduled_tasks(id) ON DELETE CASCADE,
  depends_on_task_id UUID NOT NULL REFERENCES scheduled_tasks(id) ON DELETE CASCADE,
  dependency_type TEXT NOT NULL DEFAULT 'strict' CHECK (dependency_type IN ('strict', 'soft')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(task_id, depends_on_task_id)
);
```

### task_schedules 新表（周期性任务配置）

```sql
CREATE TABLE task_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_template_id UUID NOT NULL REFERENCES scheduled_tasks(id) ON DELETE CASCADE,
  schedule_type TEXT NOT NULL CHECK (schedule_type IN ('daily', 'weekly', 'custom', 'smart')),
  schedule_config JSONB DEFAULT '{}',
  next_run_at TIMESTAMPTZ,
  last_run_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### task_progress_plans 新表

```sql
CREATE TABLE task_progress_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES scheduled_tasks(id) ON DELETE CASCADE,
  plan_date DATE NOT NULL,
  planned_percentage INTEGER NOT NULL,
  actual_percentage INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'skipped')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(task_id, plan_date)
);
```

### user_time_slots 新表

```sql
CREATE TABLE user_time_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day_of_week INTEGER CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_available BOOLEAN DEFAULT TRUE,
  label TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, day_of_week, start_time)
);
```

---

## API 设计

### 任务依赖 API

- `POST /api/scheduler/tasks/:id/dependencies` - 添加依赖
- `DELETE /api/scheduler/tasks/:id/dependencies/:dependencyId` - 删除依赖
- `GET /api/scheduler/tasks/:id/dependencies` - 获取任务依赖列表
- `GET /api/scheduler/tasks/:id/dependents` - 获取依赖此任务的任务列表

### 周期性任务 API

- `POST /api/scheduler/schedules` - 创建周期性任务配置
- `PUT /api/scheduler/schedules/:id` - 更新周期配置
- `DELETE /api/scheduler/schedules/:id` - 删除周期配置
- `GET /api/scheduler/schedules` - 获取用户的周期性任务列表

### 进度管理 API

- `POST /api/scheduler/tasks/:id/progress-plan` - 创建进度计划
- `PUT /api/scheduler/tasks/:id/progress-plan` - 更新进度计划
- `GET /api/scheduler/tasks/:id/progress-plan` - 获取进度计划
- `POST /api/scheduler/tasks/:id/progress` - 更新当日进度

### 时间设置 API

- `GET /api/scheduler/time-slots` - 获取用户时间设置
- `POST /api/scheduler/time-slots` - 添加可用时间段
- `PUT /api/scheduler/time-slots/:id` - 更新时间段
- `DELETE /api/scheduler/time-slots/:id` - 删除时间段

---

## UI 组件设计

### TaskDetailPanel 组件

任务详情面板，包含以下子模块：
- BasicInfoSection - 基本信息展示
- DependencyGraph - 依赖关系可视化
- ProgressTimeline - 进度时间线
- RelatedResources - 关联资源

### TaskDependencyGraph 组件

使用图形化方式展示任务依赖关系：
- 节点表示任务
- 边表示依赖关系（实线=严格，虚线=软性）
- 支持点击跳转

### ProgressTimeline 组件

展示任务进度时间线：
- 横轴为日期
- 显示计划进度和实际进度
- 支持标记里程碑

### TimeSlotSettings 组件

用户时间设置界面：
- 周视图展示可用时间
- 支持拖拽设置时间段
- 支持标记不可用日期
