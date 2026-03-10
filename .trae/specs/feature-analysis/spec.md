# 学习路径功能增强需求分析

## Why

学习路径功能之前存在但经过多轮调整后被破坏，需要修复并增强。用户需要一个能够：

- AI 自动生成学习路径
- 与任务调度系统深度整合
- 支持学习计划与目标管理
- 追踪学习进度的完整解决方案

## What Changes

### 修复内容

- 修复现有学习路径功能的基础能力
- 恢复学习路径创建、编辑、删除功能
- 恢复学习进度追踪功能

### 新增功能

- **AI 学习路径生成**：基于图谱结构或学习目标自动生成路径
- **任务调度整合**：节点转任务、自动排程、进度同步
- **学习计划与目标**：设置学习目标、每日计划、时间预估
- **进度可视化**：学习路径进度展示、里程碑追踪

## Impact

- Affected specs: 学习系统、任务调度器
- Affected code:
  - `api/routes/learningPaths.ts`
  - `api/services/learningPathService.ts`
  - `src/pages/LearningMode.tsx`
  - `src/components/LearningPath/`
  - `src/components/Scheduler/`

---

## ADDED Requirements

### Requirement: AI 学习路径生成

系统应提供 AI 自动生成学习路径的能力。

#### Scenario: 基于图谱结构生成路径

- **GIVEN** 用户选择了一个知识图谱
- **WHEN** 用户点击"生成学习路径"
- **THEN** 系统分析图谱节点依赖关系，生成最优学习顺序
- **AND** 每个节点成为学习路径中的一个步骤
- **AND** 根据依赖关系确定学习先后顺序

#### Scenario: 基于学习目标生成路径

- **GIVEN** 用户输入学习目标（如"掌握 React"）
- **WHEN** 用户点击"生成学习路径"
- **THEN** AI 分析目标，生成完整的学习路径
- **AND** 路径包含相关知识点、学习材料、预估时间
- **AND** 用户可以调整生成的内容

### Requirement: 学习路径与任务调度整合

系统应支持学习路径与任务调度器的深度整合。

#### Scenario: 学习节点转换为任务

- **GIVEN** 用户有一条学习路径
- **WHEN** 用户选择某个学习节点并点击"创建任务"
- **THEN** 系统在任务调度器中创建对应任务
- **AND** 任务标题为知识点标题
- **AND** 任务关联到对应的知识点
- **AND** 任务预估时长为学习节点的预估时长

#### Scenario: 学习路径自动排程

- **GIVEN** 用户有一条学习路径
- **WHEN** 用户点击"自动排程"
- **THEN** 系统根据用户可用时间自动安排学习时间
- **AND** 在日历视图中显示学习计划
- **AND** 考虑知识点之间的依赖关系

#### Scenario: 学习进度同步

- **GIVEN** 学习路径节点已转换为任务
- **WHEN** 用户完成任务
- **THEN** 学习路径中对应节点的进度自动更新
- **AND** 学习路径整体进度同步更新

### Requirement: 学习计划与目标管理

系统应支持设置学习目标和制定学习计划。

#### Scenario: 设置学习目标

- **GIVEN** 用户在学习路径页面
- **WHEN** 用户设置学习目标（如"30天掌握 React"）
- **THEN** 系统记录目标信息
- **AND** 根据目标计算每日学习量
- **AND** 显示目标完成进度

#### Scenario: 每日学习计划生成

- **GIVEN** 用户有学习目标和学习路径
- **WHEN** 系统生成每日学习计划
- **THEN** 计划包含当日应学习的知识点
- **AND** 显示预估学习时长
- **AND** 支持手动调整

#### Scenario: 学习时间预估

- **GIVEN** 学习路径包含多个知识点
- **WHEN** 系统计算学习时间
- **THEN** 每个知识点有预估学习时长
- **AND** 整条路径有总预估时长
- **AND** 根据用户实际学习情况动态调整

### Requirement: 学习路径进度追踪

系统应提供学习路径进度的可视化追踪。

#### Scenario: 查看学习路径进度

- **GIVEN** 用户有一条学习路径
- **WHEN** 用户查看路径详情
- **THEN** 显示整体完成百分比
- **AND** 显示每个节点的学习状态（未开始/进行中/已完成）
- **AND** 高亮当前应学习的节点

#### Scenario: 里程碑追踪

- **GIVEN** 学习路径设置了里程碑
- **WHEN** 用户完成里程碑前的所有节点
- **THEN** 系统标记里程碑完成
- **AND** 显示里程碑完成奖励（如经验值）
- **AND** 解锁下一阶段的学习内容

---

## MODIFIED Requirements

### Requirement: 学习路径数据模型

扩展现有学习路径数据模型以支持新功能。

```sql
-- 学习路径表（扩展现有）
ALTER TABLE learning_paths ADD COLUMN IF NOT EXISTS goal TEXT;
ALTER TABLE learning_paths ADD COLUMN IF NOT EXISTS target_date DATE;
ALTER TABLE learning_paths ADD COLUMN IF NOT EXISTS total_estimated_time INTEGER;
ALTER TABLE learning_paths ADD COLUMN IF NOT EXISTS ai_generated BOOLEAN DEFAULT FALSE;
ALTER TABLE learning_paths ADD COLUMN IF NOT EXISTS source_graph_id UUID REFERENCES knowledge_graphs(id);

-- 学习路径节点表（新建）
CREATE TABLE IF NOT EXISTS learning_path_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  path_id UUID NOT NULL REFERENCES learning_paths(id) ON DELETE CASCADE,
  knowledge_point_id UUID REFERENCES knowledge_points(id) ON DELETE SET NULL,
  order_index INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  estimated_time INTEGER DEFAULT 30,
  is_milestone BOOLEAN DEFAULT FALSE,
  prerequisites UUID[] DEFAULT '{}',
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'skipped')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 学习路径进度表（新建）
CREATE TABLE IF NOT EXISTS learning_path_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  path_id UUID NOT NULL REFERENCES learning_paths(id) ON DELETE CASCADE,
  node_id UUID NOT NULL REFERENCES learning_path_nodes(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'pending',
  progress_percentage INTEGER DEFAULT 0,
  time_spent INTEGER DEFAULT 0,
  notes TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, path_id, node_id)
);

-- 学习计划表（新建）
CREATE TABLE IF NOT EXISTS learning_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  path_id UUID NOT NULL REFERENCES learning_paths(id) ON DELETE CASCADE,
  plan_date DATE NOT NULL,
  planned_nodes UUID[] NOT NULL,
  planned_duration INTEGER,
  actual_duration INTEGER,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'partial')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, path_id, plan_date)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_learning_path_nodes_path_id ON learning_path_nodes(path_id);
CREATE INDEX IF NOT EXISTS idx_learning_path_nodes_order ON learning_path_nodes(path_id, order_index);
CREATE INDEX IF NOT EXISTS idx_learning_path_progress_user_path ON learning_path_progress(user_id, path_id);
CREATE INDEX IF NOT EXISTS idx_learning_plans_user_date ON learning_plans(user_id, plan_date);
```

---

## 后续功能（本次不实施）

以下功能已确认需求，详细内容见 [require.md](./require.md)：

### 知识发现与推荐

- 相关知识点推荐（基于向量嵌入）
- 知识盲区检测（可视化显示、报告生成、自动修复建议）
- 跨图谱知识关联（AI推荐+用户确认）

### AI 功能增强

- AI 测验生成（支持所有题型）
- AI 导师系统增强（添加角色、营造讨论氛围）
- 学习分析仪表板增强
