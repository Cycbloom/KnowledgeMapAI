# 任务调度器深度整合 Spec

## Why

当前任务调度器与知识图谱、学习路径等模块相对独立，用户需要手动维护任务与知识点的关联，导致：
- 关联维护繁琐，用户体验不流畅
- 学习进度与任务进度分离，难以统一追踪
- 缺乏智能化的任务调度，无法基于学习效率自动优化

通过深度整合，实现「学习-任务-复习」一体化工作流，提升用户学习效率。

## What Changes

### Phase 1: 知识图谱 ↔ 任务双向联动
- **新增** `knowledge_review_tasks` 表，存储基于遗忘曲线的复习任务
- **新增** `learning_progress_sync` 服务，自动同步学习进度到任务进度
- **新增** `task_knowledge_auto_link` 服务，自动关联任务与知识点
- **修改** 任务创建流程，支持从知识点一键生成学习任务
- **修改** 知识点详情页，增加关联任务视图

### Phase 2: 学习路径 ↔ 任务调度融合
- **新增** `path_node_tasks` 表，存储学习路径节点对应的任务
- **新增** `path_progress_sync` 服务，同步路径进度到任务队列
- **修改** 学习路径页面，支持节点一键转任务
- **修改** 任务调度器，支持按学习路径分组显示

### Phase 3: 智能调度增强
- **新增** `user_efficiency_profile` 表，存储用户效率画像
- **新增** `sm2_algorithm` 服务，实现 SM-2 间隔重复算法
- **新增** `smart_scheduler` 服务，基于效率数据和掌握度智能排程
- **修改** 任务推荐系统，增加掌握度驱动优先级

### Phase 4: 统一工作台
- **新增** `UnifiedWorkbench` 页面，上下分区布局
- **新增** 工作台组件：任务看板、知识图谱概览、学习进度面板
- **修改** 导航结构，增加工作台入口

## Impact

- **Affected specs**: 
  - 任务调度器核心功能
  - 知识图谱关联机制
  - 学习路径进度追踪
  - 统计分析模块

- **Affected code**:
  - `api/services/scheduler/` - 新增多个服务
  - `src/pages/Scheduler.tsx` - 增强联动功能
  - `src/pages/LearningMode.tsx` - 增加任务同步
  - `src/pages/LearningPaths.tsx` - 增加节点转任务
  - `shared/types/scheduler.ts` - 扩展类型定义
  - `supabase/migrations/` - 新增数据表

---

## ADDED Requirements

### Requirement: 知识点学习后自动生成复习任务

系统 SHALL 在用户完成知识点学习后，基于 SM-2 算法自动生成复习任务。

#### Scenario: 首次学习知识点后生成复习任务
- **WHEN** 用户首次学习完一个知识点（标记为已掌握或完成学习）
- **THEN** 系统自动创建复习任务，初始间隔为 1 天
- **AND** 任务自动关联到对应知识点
- **AND** 任务类型标记为 `review`

#### Scenario: 复习任务完成后调度下次复习
- **WHEN** 用户完成复习任务并评分（0-5 分）
- **THEN** 系统根据 SM-2 算法计算下次复习间隔
- **AND** 自动创建新的复习任务

#### Scenario: 用户可手动调整复习计划
- **WHEN** 用户修改复习任务的截止时间
- **THEN** 系统更新复习计划，但保留算法推荐值作为参考

---

### Requirement: 学习路径节点自动转换为任务

系统 SHALL 支持将学习路径节点转换为可执行的任务。

#### Scenario: 单个节点转任务
- **WHEN** 用户点击学习路径节点的「转为任务」按钮
- **THEN** 系统创建对应任务，自动填充标题、描述、预估时长
- **AND** 任务关联到学习路径节点
- **AND** 任务自动加入 Q2 队列（默认低优先级）

#### Scenario: 批量节点转任务
- **WHEN** 用户选择多个节点并点击「批量转任务」
- **THEN** 系统按节点顺序创建任务链
- **AND** 自动设置任务依赖关系

#### Scenario: 路径进度同步到任务
- **WHEN** 用户在学习路径中完成节点学习
- **THEN** 对应任务自动标记为完成
- **AND** 更新路径整体进度

---

### Requirement: 学习进度与任务进度双向同步

系统 SHALL 自动同步学习进度与任务进度。

#### Scenario: 学习时长同步到任务
- **WHEN** 用户在学习模式中学习关联知识点
- **THEN** 实际学习时长自动累加到关联任务的实际时长
- **AND** 任务进度百分比自动更新

#### Scenario: 任务完成同步到知识点
- **WHEN** 用户完成任务
- **THEN** 关联知识点的学习状态更新
- **AND** 更新知识点最后学习时间

#### Scenario: 多知识点关联任务
- **WHEN** 任务关联多个知识点
- **THEN** 按关联权重分配学习进度
- **AND** 主知识点获得更高权重

---

### Requirement: SM-2 间隔重复算法实现

系统 SHALL 实现完整的 SM-2 间隔重复算法。

#### Scenario: 计算复习间隔
- **GIVEN** 用户对知识点进行复习评分（0-5）
- **WHEN** 系统计算下次复习时间
- **THEN** 根据以下规则计算间隔：
  - 评分 < 3: 间隔重置为 1 天
  - 评分 >= 3: 间隔 = 上一间隔 × EF（易遗忘因子）
  - 首次复习: 1 天
  - 第二次: 6 天
  - 后续: interval × EF

#### Scenario: 更新易遗忘因子
- **WHEN** 用户完成复习评分
- **THEN** EF' = EF + (0.1 - (5 - q) × (0.08 + (5 - q) × 0.02))
- **AND** EF 最小值为 1.3

#### Scenario: 复习队列优先级
- **WHEN** 存在多个待复习任务
- **THEN** 按紧急程度排序（超期 > 今日 > 未来）
- **AND** 同紧急程度按掌握度排序（低掌握度优先）

---

### Requirement: 基于效率数据的智能调度

系统 SHALL 基于用户历史效率数据智能调度任务。

#### Scenario: 时段效率优化
- **GIVEN** 系统记录了用户各时段的任务完成效率
- **WHEN** 用户查看任务推荐
- **THEN** 高效时段推荐重要/困难任务
- **AND** 低效时段推荐简单/轻松任务

#### Scenario: 掌握度驱动优先级
- **GIVEN** 知识点有关联的掌握度评分
- **WHEN** 生成复习任务
- **THEN** 低掌握度知识点的复习任务获得更高优先级
- **AND** 自动调整到 Q0 或 Q1 队列

#### Scenario: 依赖关系感知排序
- **GIVEN** 任务之间存在依赖关系
- **WHEN** 用户查看任务列表
- **THEN** 被依赖的任务自动排在前面
- **AND** 阻塞的任务显示警告标识

#### Scenario: 任务类型匹配时段
- **GIVEN** 任务有类型标签（学习、工作、复习等）
- **WHEN** 系统推荐任务执行时间
- **THEN** 学习类任务推荐上午时段
- **AND** 复习类任务推荐傍晚时段

---

### Requirement: 统一工作台

系统 SHALL 提供统一工作台，整合任务、知识图谱、学习进度。

#### Scenario: 工作台布局
- **GIVEN** 用户进入统一工作台
- **WHEN** 页面加载完成
- **THEN** 上方显示任务看板（三层队列视图）
- **AND** 下方显示知识图谱概览和学习进度面板
- **AND** 支持快速创建任务和知识点

#### Scenario: 快速关联操作
- **WHEN** 用户在任务卡片上点击「关联知识点」
- **THEN** 显示知识点选择器
- **AND** 支持搜索和快速选择最近学习的知识点

#### Scenario: 跨模块导航
- **WHEN** 用户点击任务关联的知识点
- **THEN** 跳转到知识点详情页或学习模式
- **WHEN** 用户点击知识点关联的任务
- **THEN** 跳转到任务详情页

---

## MODIFIED Requirements

### Requirement: 任务创建流程增强

原有任务创建功能 SHALL 增加知识点关联选项。

#### Scenario: 从知识点创建任务
- **WHEN** 用户在知识点详情页点击「创建学习任务」
- **THEN** 打开任务创建表单，自动填充知识点信息
- **AND** 自动关联当前知识点

#### Scenario: 任务表单增加知识点选择
- **WHEN** 用户创建或编辑任务
- **THEN** 表单显示知识点选择器
- **AND** 支持搜索和选择多个知识点
- **AND** 可设置主知识点

---

### Requirement: 知识点详情页增强

原有知识点详情页 SHALL 增加关联任务视图。

#### Scenario: 显示关联任务
- **WHEN** 用户查看知识点详情
- **THEN** 显示所有关联的任务列表
- **AND** 显示任务状态和进度
- **AND** 支持快速创建新任务

---

## Technical Design

### 数据库设计

```sql
-- 复习任务表
CREATE TABLE knowledge_review_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  knowledge_point_id UUID NOT NULL,
  task_id UUID NOT NULL REFERENCES scheduled_tasks(id),
  interval_days INTEGER NOT NULL DEFAULT 1,
  ease_factor DECIMAL(3,2) NOT NULL DEFAULT 2.5,
  repetitions INTEGER NOT NULL DEFAULT 0,
  next_review_date TIMESTAMP WITH TIME ZONE NOT NULL,
  last_review_date TIMESTAMP WITH TIME ZONE,
  last_quality_score INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 学习路径节点任务关联表
CREATE TABLE path_node_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  path_id UUID NOT NULL REFERENCES learning_paths(id),
  node_id UUID NOT NULL REFERENCES learning_path_nodes(id),
  task_id UUID NOT NULL REFERENCES scheduled_tasks(id),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(node_id, task_id)
);

-- 用户效率画像表
CREATE TABLE user_efficiency_profile (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) UNIQUE,
  hourly_efficiency JSONB DEFAULT '{}',
  tag_efficiency JSONB DEFAULT '{}',
  queue_efficiency JSONB DEFAULT '{}',
  peak_hours INTEGER[] DEFAULT '{}',
  low_hours INTEGER[] DEFAULT '{}',
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 知识点掌握度表（扩展现有）
ALTER TABLE knowledge_points ADD COLUMN IF NOT EXISTS mastery_level DECIMAL(3,2) DEFAULT 0;
ALTER TABLE knowledge_points ADD COLUMN IF NOT EXISTS last_study_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE knowledge_points ADD COLUMN IF NOT EXISTS total_study_duration INTEGER DEFAULT 0;
```

### 服务架构

```
api/services/
├── scheduler/
│   ├── taskService.ts           # 现有
│   ├── sm2Service.ts            # 新增: SM-2 算法
│   ├── reviewTaskService.ts     # 新增: 复习任务管理
│   ├── efficiencyService.ts     # 新增: 效率分析
│   ├── smartSchedulerService.ts # 新增: 智能调度
│   └── progressSyncService.ts   # 新增: 进度同步
├── knowledge/
│   └── knowledgeTaskLinkService.ts  # 新增: 知识点-任务关联
└── learningPath/
    └── pathTaskService.ts       # 新增: 路径-任务转换
```

### 前端组件

```
src/components/
├── UnifiedWorkbench/            # 新增: 统一工作台
│   ├── index.tsx
│   ├── TaskKanban.tsx
│   ├── KnowledgeOverview.tsx
│   └── LearningProgressPanel.tsx
├── Scheduler/
│   ├── TaskKnowledgeLink.tsx    # 新增: 任务知识点关联组件
│   └── ReviewTaskCard.tsx       # 新增: 复习任务卡片
└── Knowledge/
    └── RelatedTasks.tsx         # 新增: 关联任务视图
```
