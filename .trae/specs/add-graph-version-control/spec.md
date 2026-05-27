# 知识图谱版本控制 Spec

## Why

知识图谱当前没有版本管理机制——所有图谱结构变更（节点增删、边增删、图谱属性修改）都是直接覆盖更新，无法回溯历史、无法对比差异、无法安全回滚。用户在执行 AI 扩展、批量操作等"大动作"时缺乏安全感，也无法进行探索性编辑（试完不满意无法撤回）。引入类 Git 的版本控制机制，基于 Event Sourcing 记录变更历史，让图谱拥有"时光机"能力。

## What Changes

- 新增 `graph_events` 数据库表，基于 Event Sourcing 记录图谱所有结构变更事件
- 新增 `graph_snapshots` 数据库表，存储图谱版本快照（节点/边的完整状态）
- 新增 `graphVersionService` 服务，实现自动快照、Diff 对比、版本回滚
- 修改 `graphNodeService` 和 `edgeService`，在变更操作中发布并持久化领域事件
- 新增图谱版本控制 API 端点（版本历史、Diff、回滚、分支、合并）
- 新增前端版本历史面板和 Diff 可视化组件

## Impact

- Affected specs: 图谱服务、节点服务、边服务、缓存服务、事件总线
- Affected code:
  - `supabase/migrations/` — 新增 `graph_events`、`graph_snapshots` 表
  - `api/services/graph/graphVersionService.ts` — 新增版本控制服务
  - `api/services/graph/graphNodeService.ts` — 增加事件持久化
  - `api/services/graph/edgeService.ts` — 增加事件持久化
  - `api/services/graph/graphService.ts` — 增加快照触发
  - `api/routes/graphs/` — 新增版本控制路由
  - `shared/types/` — 新增版本控制相关类型
  - `src/` — 新增前端版本历史面板和 Diff 可视化组件

## ADDED Requirements

### Requirement: 图谱变更事件记录（Event Sourcing）

系统 SHALL 记录知识图谱的所有结构变更事件，包括节点创建/更新/删除、边创建/更新/删除、图谱属性变更。

#### Scenario: 节点创建事件记录
- **WHEN** 用户在图谱中创建新节点
- **THEN** 系统在 `graph_events` 表中记录一条 `node_created` 事件，包含 graph_id、操作类型、变更数据（节点 ID、标题、位置等）、操作者 ID 和时间戳

#### Scenario: 边删除事件记录
- **WHEN** 用户删除图谱中的一条边
- **THEN** 系统在 `graph_events` 表中记录一条 `edge_deleted` 事件，包含 graph_id、操作类型、变更数据（边 ID、源/目标节点 ID 等）、操作者 ID 和时间戳

#### Scenario: 批量操作事件记录
- **WHEN** 用户执行批量操作（如批量删除节点）
- **THEN** 系统为每个受影响的实体记录独立事件，同时关联同一个 `batch_id`，便于追踪批量操作的完整影响范围

---

### Requirement: 自动版本快照

系统 SHALL 在图谱发生重大变更时自动创建版本快照，记录图谱在某一时刻的完整状态。

#### Scenario: AI 扩展前自动快照
- **WHEN** 用户触发 AI 扩展图谱操作
- **THEN** 系统在执行扩展前自动创建一个快照，快照包含当前图谱所有未删除节点和边的完整数据，快照描述为"AI 扩展前自动快照"

#### Scenario: 批量删除前自动快照
- **WHEN** 用户执行批量删除节点操作（≥3 个节点）
- **THEN** 系统在执行删除前自动创建快照，快照描述为"批量删除前自动快照"

#### Scenario: 手动创建快照
- **WHEN** 用户手动请求创建快照
- **THEN** 系统创建快照并允许用户输入快照描述（如"重构前的版本"）

#### Scenario: 快照数据内容
- **WHEN** 系统创建快照
- **THEN** 快照包含图谱的所有未删除节点（ID、知识点 ID、位置、层级）和所有未删除边（ID、源/目标知识点 ID、关系类型、自定义样式），以 JSONB 格式存储

---

### Requirement: 图谱 Diff 对比

系统 SHALL 支持对比两个版本之间的差异，可视化展示节点/边的增删改。

#### Scenario: 两版本 Diff
- **WHEN** 用户选择两个快照进行对比
- **THEN** 系统返回差异结果，包含：新增的节点列表、删除的节点列表、修改的节点列表（含变更字段）、新增的边列表、删除的边列表、修改的边列表（含变更字段）

#### Scenario: 当前状态与历史版本 Diff
- **WHEN** 用户选择一个历史快照与当前图谱状态对比
- **THEN** 系统实时计算当前图谱状态与快照的差异，返回结果格式同上

#### Scenario: Diff 结果按变更类型筛选
- **WHEN** 用户查看 Diff 结果
- **THEN** 系统支持按变更类型筛选（仅看新增/仅看删除/仅看修改）和按实体类型筛选（仅看节点/仅看边）

---

### Requirement: 版本回滚

系统 SHALL 支持将图谱回滚到指定版本快照的状态。

#### Scenario: 回滚到历史版本
- **WHEN** 用户选择一个历史快照并执行回滚
- **THEN** 系统在回滚前先创建当前状态的快照（描述为"回滚前自动快照"），然后将图谱的节点和边恢复到目标快照的状态，回滚操作本身作为新事件记录

#### Scenario: 回滚不删除历史
- **WHEN** 用户执行回滚操作
- **THEN** 系统不删除任何历史事件或快照，回滚操作产生的新版本完整保留

---

### Requirement: 图谱分支

系统 SHALL 支持从当前图谱创建分支进行探索性编辑，分支独立于主线。

#### Scenario: 创建分支
- **WHEN** 用户从当前图谱创建分支
- **THEN** 系统创建一个新图谱（分支），复制当前图谱的所有节点和边，新图谱的 `parent_graph_id` 指向原图谱，`branch_name` 记录分支名称，`branch_source_snapshot_id` 记录分支来源快照

#### Scenario: 分支独立编辑
- **WHEN** 用户在分支上编辑节点或边
- **THEN** 分支的变更不影响主线图谱，两个图谱完全独立

---

### Requirement: 分支合并

系统 SHALL 支持将分支的变更合并回主线图谱。

#### Scenario: 合并分支到主线
- **WHEN** 用户选择将分支合并回主线
- **THEN** 系统计算分支与主线的 Diff，展示差异列表，用户可选择要合并的变更项，系统将选中的变更应用到主线

#### Scenario: 合并冲突提示
- **WHEN** 分支和主线修改了同一个节点
- **THEN** 系统标记该节点为冲突状态，展示双方的修改内容，用户选择保留哪一方

---

### Requirement: 版本历史面板（前端）

系统 SHALL 提供图谱版本历史面板，展示版本时间线并支持操作。

#### Scenario: 查看版本历史
- **WHEN** 用户打开版本历史面板
- **THEN** 系统展示图谱的版本时间线，包含每个快照的时间、描述、操作者，以及自动快照和手动快照的区分标识

#### Scenario: 从历史面板触发操作
- **WHEN** 用户在版本历史面板中选择一个快照
- **THEN** 用户可执行"查看 Diff"、"回滚到此版本"、"创建分支"操作

---

### Requirement: Diff 可视化组件（前端）

系统 SHALL 提供图谱 Diff 可视化组件，以图形化方式展示版本差异。

#### Scenario: Diff 可视化展示
- **WHEN** 用户查看两个版本的 Diff
- **THEN** 系统在图谱画布上用颜色标识差异：绿色=新增、红色=删除、黄色=修改，未变更的节点/边以半透明方式显示

#### Scenario: Diff 详情面板
- **WHEN** 用户点击 Diff 中的某个变更节点或边
- **THEN** 系统展示该实体的详细变更信息（修改前后的字段值对比）

## MODIFIED Requirements

### Requirement: 图谱节点服务（现有）

`graphNodeService` 的 `addToGraph`、`removeFromGraph`、`updatePosition`、`updateLevel`、`batchDelete` 方法在执行数据变更后，SHALL 额外调用 `graphVersionService.recordEvent()` 记录变更事件。

### Requirement: 边服务（现有）

`edgeService` 的 `create`、`delete`、`update` 方法在执行数据变更后，SHALL 额外调用 `graphVersionService.recordEvent()` 记录变更事件。

### Requirement: 图谱服务（现有）

`graphService` 的 `updateGraph` 方法在执行数据变更后，SHALL 额外调用 `graphVersionService.recordEvent()` 记录变更事件；AI 扩展和批量删除等重大变更前，SHALL 调用 `graphVersionService.createSnapshot()` 创建自动快照。

## REMOVED Requirements

无移除的需求。
