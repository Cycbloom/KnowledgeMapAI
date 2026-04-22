# 子任务掌握度系统增强规格

## Why

当前的子任务系统与知识点掌握度管理是分离的，用户无法通过子任务的学习进度直观地了解知识点的掌握情况。同时，缺乏基于遗忘曲线的掌握度衰减机制，无法实现真正的"终身学习"目标。需要将子任务状态与知识点掌握度深度整合，建立完整的学习状态机。

## What Changes

- **子任务状态机重构**：将子任务从"类型"改为"状态"，实现学习→复习→练习→测验的状态循环
- **子任务与知识点一对一绑定**：子任务状态完全代表知识点的学习状态
- **掌握度衰减机制**：基于SM-2算法和遗忘曲线，掌握度随时间自动衰减
- **任务列表UI增强**：可展开列表设计，显示子任务状态和知识点掌握度
- **日历子任务展示**：堆叠卡片式展示子任务，支持开关控制

## Impact

- **Affected specs**: 任务调度系统、知识点系统、学习进度系统
- **Affected code**:
  - `shared/types/scheduler.ts` - 子任务类型定义
  - `supabase/migrations/07_scheduler_tasks.sql` - 子任务表结构
  - `src/components/Scheduler/ListView.tsx` - 任务列表UI
  - `src/components/Calendar/*` - 日历组件
  - `api/services/scheduler/sm2Service.ts` - SM-2算法服务

---

## ADDED Requirements

### Requirement: 子任务状态机

系统应提供子任务状态机，管理知识点的学习生命周期。

#### 状态定义

| 状态 | 说明 | 可转换目标 |
|------|------|------------|
| `learning` | 初始学习状态，仅出现一次 | `review`, `practice`, `quiz` |
| `review` | 复习状态，回顾已学内容 | `practice`, `quiz` |
| `practice` | 练习状态，简单题目快速检验 | `review`, `quiz` |
| `quiz` | 测验状态，综合题目全面评估 | `review` |

#### 状态转换规则

1. **学习阶段**：新知识点首次学习，状态为 `learning`
2. **学习完成后**：根据掌握度自动转换到 `review` 或 `practice`
3. **循环阶段**：`review` → `practice` → `quiz` → `review` 循环
4. **转换条件**：
   - 掌握度 < 30%：优先进入 `review`
   - 掌握度 30%-70%：进入 `practice`
   - 掌握度 > 70%：进入 `quiz`

#### Scenario: 新知识点学习流程

- **WHEN** 用户创建学习任务并添加知识点子任务
- **THEN** 子任务初始状态为 `learning`
- **AND** 完成学习后，根据掌握度自动转换到下一状态

#### Scenario: 复习循环流程

- **WHEN** 子任务处于 `quiz` 状态并完成测验
- **THEN** 根据测验结果更新掌握度
- **AND** 状态转换到 `review`，等待下次复习周期

---

### Requirement: 子任务与知识点一对一绑定

系统应确保每个子任务与一个知识点一一对应，子任务状态完全代表知识点学习状态。

#### 数据模型变更

```typescript
interface TaskSubtask {
  id: string;
  task_id: string;
  knowledge_point_id: string;  // 必填，一对一绑定
  title: string;
  status: SubtaskStatus;  // pending | in_progress | completed
  learning_state: LearningState;  // learning | review | practice | quiz
  mastery_level: number;  // 0-100 掌握度
  last_state_change_at: string;  // 上次状态变更时间
  state_history: StateHistory[];  // 状态变更历史
  // ... 其他字段
}

type LearningState = 'learning' | 'review' | 'practice' | 'quiz';
```

#### 同步规则

1. 子任务 `learning_state` 变更时，同步更新 `knowledge_points.mastery_level`
2. 子任务 `mastery_level` 变更时，同步更新知识点掌握度
3. 知识点复习时间到达时，更新关联子任务的状态

#### Scenario: 子任务状态同步到知识点

- **WHEN** 用户完成子任务的学习阶段
- **THEN** 子任务状态变更为 `review`
- **AND** 关联的知识点 `mastery_level` 更新为子任务的掌握度

---

### Requirement: 掌握度衰减机制

系统应基于遗忘曲线实现掌握度随时间自动衰减。

#### 衰减算法

采用 SM-2 算法结合遗忘曲线：

```typescript
function calculateDecay(
  masteryLevel: number,
  lastStudyAt: Date,
  easeFactor: number
): number {
  const daysSinceLastStudy = daysBetween(lastStudyAt, new Date());
  const retentionRate = Math.pow(
    Math.E,
    -daysSinceLastStudy / (easeFactor * 10)
  );
  return Math.max(0, masteryLevel * retentionRate);
}
```

#### 衰减触发

1. **定时任务**：每日凌晨检查所有知识点，计算衰减后的掌握度
2. **实时计算**：用户查看时实时计算当前掌握度
3. **阈值触发**：掌握度低于阈值时标记需要复习

#### Scenario: 掌握度自然衰减

- **GIVEN** 知识点当前掌握度为 80%，上次学习时间为 7 天前
- **WHEN** 系统执行每日衰减计算
- **THEN** 掌握度根据遗忘曲线衰减（如降至 65%）
- **AND** 关联子任务状态更新

#### Scenario: 复习提醒触发

- **GIVEN** 知识点掌握度衰减至 30% 以下
- **WHEN** 系统检测到阈值触发
- **THEN** 标记知识点为"需要复习"
- **AND** 在任务列表中高亮显示关联子任务

---

### Requirement: 任务列表UI增强

任务列表应支持展开显示子任务，展示子任务状态和知识点掌握度。

#### UI设计

1. **任务卡片**：
   - 显示任务标题、状态、进度
   - 显示子任务完成进度条
   - 显示关联知识点数量和平均掌握度

2. **展开子任务**：
   - 点击任务卡片展开子任务列表
   - 每个子任务显示：
     - 知识点名称
     - 学习状态（learning/review/practice/quiz）
     - 掌握度进度条（0-100%）
     - 状态图标和颜色

3. **状态颜色编码**：
   - `learning`: 蓝色
   - `review`: 绿色
   - `practice`: 橙色
   - `quiz`: 紫色

#### Scenario: 查看任务子任务

- **WHEN** 用户点击任务卡片展开
- **THEN** 显示该任务的所有子任务
- **AND** 每个子任务显示知识点名称、状态、掌握度

#### Scenario: 子任务状态可视化

- **GIVEN** 子任务处于 `practice` 状态，掌握度 60%
- **WHEN** 用户查看子任务
- **THEN** 显示橙色状态标签
- **AND** 显示 60% 的进度条

---

### Requirement: 日历子任务展示

日历视图应支持以堆叠卡片方式展示子任务，并提供显示开关。

#### 展示方式

1. **堆叠卡片**：子任务作为小卡片堆叠在父任务下方
2. **展开查看**：点击可展开查看子任务详情
3. **显示开关**：工具栏提供开关控制是否显示子任务

#### UI设计

```
┌─────────────────────────────┐
│ [开关] 显示子任务            │  ← 工具栏开关
├─────────────────────────────┤
│  2026年4月22日               │
│  ┌───────────────────────┐  │
│  │ 学习图谱任务           │  │  ← 父任务
│  │ 进度: 3/5 完成        │  │
│  ├───────────────────────┤  │
│  │ ├─ [学习] 知识点1 80% │  │  ← 子任务堆叠
│  │ ├─ [复习] 知识点2 65% │  │
│  │ └─ [练习] 知识点3 45% │  │
│  └───────────────────────┘  │
└─────────────────────────────┘
```

#### Scenario: 切换子任务显示

- **WHEN** 用户点击"显示子任务"开关
- **THEN** 日历上的任务卡片展开/收起子任务

#### Scenario: 查看子任务详情

- **WHEN** 用户点击日历上的子任务卡片
- **THEN** 弹出子任务详情面板
- **AND** 显示知识点信息、学习状态、掌握度

---

### Requirement: 与现有Quiz系统集成

子任务的练习和测验状态应与现有Quiz系统深度集成。

#### 集成方式

1. **练习状态**：
   - 关联 `study_cards` 中难度 1-2 的简单卡片
   - 快速检验知识点掌握情况
   - 完成后更新掌握度（权重较低）

2. **测验状态**：
   - 关联 `quiz_sets` 中的测验集合
   - 综合评估知识点掌握情况
   - 完成后更新掌握度（权重较高）

3. **AI生成题目**：
   - 利用现有AI生成题目功能
   - 根据知识点自动生成练习/测验题目

#### Scenario: 进入练习状态

- **WHEN** 子任务状态转换到 `practice`
- **THEN** 系统自动关联该知识点的简单难度学习卡片
- **AND** 用户可以开始练习

#### Scenario: 完成测验更新掌握度

- **WHEN** 用户完成测验状态的子任务
- **THEN** 根据测验得分更新知识点掌握度
- **AND** 状态转换到 `review`

---

## MODIFIED Requirements

### Requirement: 子任务数据模型

原有的子任务类型字段 `task_type` 改为学习状态字段 `learning_state`。

**原定义**：
```typescript
task_type: 'learning' | 'review' | 'practice' | 'explore'
```

**新定义**：
```typescript
learning_state: 'learning' | 'review' | 'practice' | 'quiz'
```

### Requirement: 知识点掌握度计算

原有 `mastery_level` 字段改为由子任务状态驱动。

**原逻辑**：手动设置或简单计算

**新逻辑**：
1. 由关联子任务的学习状态和完成情况计算
2. 基于遗忘曲线自动衰减
3. 通过练习/测验结果动态更新

---

## REMOVED Requirements

### Requirement: 子任务独立类型

**Reason**: 子任务不再有独立的"类型"，而是通过"状态"来表示学习阶段

**Migration**: 将现有 `task_type` 字段值映射到 `learning_state`：
- `learning` → `learning`
- `review` → `review`
- `practice` → `practice`
- `explore` → `review` (探索归入复习)
