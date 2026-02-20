# 知识点与图谱解耦 Spec

## Why

当前架构中，知识点（nodes）与知识图谱是强绑定的关系（每个 node 必须属于一个 graph_id）。这导致：
1. 同一个知识点无法在多个图谱中复用
2. 在不同图谱中创建相同知识点时，内容需要分别维护
3. 知识点更新时，无法同步到其他使用该知识点的图谱

## What Changes

- 创建独立的 `knowledge_points` 表存储知识点核心内容
- 创建 `graph_nodes` 关联表实现知识点与图谱的多对多关系
- 修改 `edges` 表结构，支持跨图谱的知识点关联
- 更新 `study_cards` 表引用关系
- 新增联立视图功能，支持同时展示多个知识图谱
- **BREAKING**: 数据库架构重大变更，需要数据迁移

## Impact

- Affected specs: 知识点管理、图谱管理、学习卡片系统
- Affected code: 
  - `supabase/migrations/` - 数据库迁移文件
  - `src/types/index.ts` - 类型定义
  - `src/services/api/nodes.ts` - API 服务
  - `src/hooks/useGraphNodeOperations.ts` - 节点操作钩子
  - 所有涉及 nodes 的前端组件

## ADDED Requirements

### Requirement: 独立知识点管理

系统 SHALL 提供独立的知识点实体，支持跨图谱复用。

#### Scenario: 创建独立知识点
- **WHEN** 用户创建一个知识点
- **THEN** 系统创建一个独立的知识点记录，该知识点不属于任何特定图谱
- **AND** 知识点具有唯一标识符、标题、内容、学习材料等属性

#### Scenario: 知识点复用
- **WHEN** 用户在图谱A中添加已存在的知识点到图谱B
- **THEN** 系统在两个图谱中引用同一个知识点实例
- **AND** 知识点内容保持一致

### Requirement: 知识点与图谱多对多关系

系统 SHALL 支持一个知识点属于多个知识图谱。

#### Scenario: 添加知识点到图谱
- **WHEN** 用户将知识点添加到图谱
- **THEN** 系统创建 graph_nodes 关联记录
- **AND** 关联记录包含图谱特定的属性（位置、层级等）

#### Scenario: 从图谱移除知识点
- **WHEN** 用户从图谱A中移除知识点
- **THEN** 系统删除该图谱与知识点的关联
- **AND** 知识点本身不被删除
- **AND** 其他图谱中的该知识点不受影响

### Requirement: 知识点内容同步

系统 SHALL 确保知识点内容更新时同步到所有关联图谱。

#### Scenario: 更新知识点内容
- **WHEN** 用户在图谱A中更新知识点标题或内容
- **THEN** 系统更新知识点核心记录
- **AND** 所有使用该知识点的图谱自动显示更新后的内容

#### Scenario: 更新图谱特定属性
- **WHEN** 用户调整知识点在图谱中的位置或层级
- **THEN** 系统仅更新 graph_nodes 关联记录
- **AND** 不影响知识点核心内容
- **AND** 不影响其他图谱中的布局

### Requirement: 边关系支持

系统 SHALL 支持知识点之间的边关系，边可以跨图谱存在。

#### Scenario: 创建知识点关联
- **WHEN** 用户在图谱中创建两个知识点之间的关联
- **THEN** 系统记录知识点之间的边关系
- **AND** 边关系属于特定图谱上下文

### Requirement: 学习卡片关联

系统 SHALL 保持学习卡片与知识点的正确关联。

#### Scenario: 学习卡片独立性
- **WHEN** 知识点在多个图谱中使用
- **THEN** 学习卡片与知识点关联，而非图谱
- **AND** 用户在任意图谱中复习该知识点时，学习进度保持一致

#### Scenario: 卡组区分
- **WHEN** 用户查看某个知识点的学习卡片
- **THEN** 系统展示该知识点的所有学习卡片
- **AND** 用户可以按图谱来源筛选卡组
- **AND** 卡片可标识其创建来源的图谱

### Requirement: 知识点可见性与归属

系统 SHALL 支持公共知识点和私有知识点两种类型。

#### Scenario: 知识点可见性
- **WHEN** 用户浏览知识点库
- **THEN** 系统展示所有公共知识点和用户自己的私有知识点
- **AND** 用户无法看到其他用户的私有知识点

#### Scenario: 私有知识点
- **WHEN** 用户创建知识点时选择私有
- **THEN** 该知识点仅对创建者可见
- **AND** 其他用户无法搜索或引用该知识点

#### Scenario: 公共知识点引用
- **WHEN** 用户使用公共知识点
- **THEN** 系统创建引用关系（非复制）
- **AND** 公共知识点更新时，所有引用者自动获得更新
- **AND** 用户无法直接修改公共知识点内容

### Requirement: 公共知识点管理

系统 SHALL 提供公共知识点的审核机制。

#### Scenario: 提交公共知识点建议
- **WHEN** 用户希望将私有知识点转为公共或修改公共知识点
- **THEN** 用户提交知识点建议
- **AND** 系统自动进行初步审核（内容质量、重复检测等）
- **AND** 审核通过后进入待复核队列

#### Scenario: 公共知识点审核流程
- **WHEN** 用户提交的知识点建议通过自动审核
- **THEN** 管理员定期复核待审核的知识点
- **AND** 管理员批准后知识点成为公共知识点
- **AND** 管理员可拒绝并附上原因

#### Scenario: 公共知识点更新
- **WHEN** 公共知识点被更新
- **THEN** 所有引用该知识点的图谱自动获得更新
- **AND** 用户收到知识点更新通知

### Requirement: AI 自动复用知识点

系统 SHALL 在创建知识点时自动识别并复用已存在的知识点。

#### Scenario: 手动创建知识点时自动匹配
- **WHEN** 用户在图谱中创建新知识点
- **THEN** 系统通过语义相似度搜索已有知识点
- **AND** 系统提示用户是否复用相似的知识点
- **AND** 用户可选择复用或创建新知识点

#### Scenario: AI 生成图谱时自动复用
- **WHEN** 用户使用 AI 工具生成图谱内容
- **THEN** 系统自动检测生成内容中与已有知识点的相似性
- **AND** 系统自动复用已存在的知识点（相似度超过阈值）
- **AND** 系统为新生成的知识点创建独立记录

#### Scenario: 知识点复用确认
- **WHEN** AI 检测到可复用的知识点
- **THEN** 系统展示候选知识点列表供用户确认
- **AND** 用户可以修改复用决策
- **AND** 复用的知识点保持内容同步

### Requirement: 知识点删除机制

系统 SHALL 提供软删除和硬删除两种删除方式。

#### Scenario: 软删除知识点（从图谱移除）
- **WHEN** 用户选择从当前图谱移除知识点
- **THEN** 系统删除 graph_nodes 关联记录
- **AND** 系统删除该图谱中与该知识点相关的边
- **AND** 知识点本身保留
- **AND** 其他图谱中的该知识点不受影响
- **AND** 学习卡片保留

#### Scenario: 硬删除知识点（彻底删除）
- **WHEN** 用户选择彻底删除知识点
- **THEN** 系统检查该知识点是否在多个图谱中使用
- **AND** 如果知识点仅在一个图谱中使用，允许硬删除
- **AND** 如果知识点在多个图谱中使用，提示用户确认影响范围
- **AND** 确认后删除知识点核心记录
- **AND** 删除所有图谱中的关联记录（graph_nodes）
- **AND** 删除所有相关的边
- **AND** 删除关联的学习卡片

#### Scenario: 删除确认提示
- **WHEN** 用户尝试删除在多个图谱中使用的知识点
- **THEN** 系统展示该知识点使用的图谱列表
- **AND** 系统提示删除将影响的所有图谱
- **AND** 用户确认后才执行硬删除

### Requirement: 联立视图展示

系统 SHALL 提供联立视图功能，允许用户同时查看多个知识图谱。

#### Scenario: 打开联立视图
- **WHEN** 用户在图谱地图或图谱列表页选择多个知识图谱并请求联立视图
- **THEN** 系统在单一视图中展示所有选中的图谱
- **AND** 每个图谱使用不同的颜色或标识进行区分
- **AND** 共享的知识点在视觉上显示为连接点

#### Scenario: 联立视图中的知识点展示
- **WHEN** 同一知识点在多个图谱中出现
- **THEN** 系统将该知识点显示为单一节点
- **AND** 节点视觉上标识其所属的图谱（多色边框或徽章）
- **AND** 用户可以点击查看该知识点在各个图谱中的位置

#### Scenario: 联立视图中的边展示
- **WHEN** 展示多个图谱的联立视图
- **THEN** 不同图谱的边使用不同颜色区分
- **AND** 跨图谱的知识点关联（如果存在）用特殊样式显示

#### Scenario: 联立视图交互
- **WHEN** 用户在联立视图中操作
- **THEN** 用户可以单独高亮某个图谱
- **AND** 用户可以筛选显示/隐藏特定图谱
- **AND** 用户可以点击知识点查看详情或编辑

#### Scenario: 联立视图布局
- **WHEN** 系统渲染联立视图
- **THEN** 系统采用智能布局算法，使不同图谱在视觉上分组
- **AND** 共享知识点作为连接锚点
- **AND** 用户可以切换不同的布局模式（分组、融合、网络）

#### Scenario: 联立视图编辑
- **WHEN** 用户在联立视图中编辑知识点
- **THEN** 系统检测该知识点是否在多个图谱中使用
- **AND** 如果知识点在多个图谱中使用，系统提示影响范围
- **AND** 用户确认后执行编辑操作
- **AND** 编辑结果同步到所有关联图谱

### Requirement: 联立视图数据查询

系统 SHALL 提供高效的联立视图数据查询能力。

#### Scenario: 批量获取多图谱数据
- **WHEN** 用户请求联立视图
- **THEN** 系统一次性查询所有选中图谱的数据
- **AND** 系统识别并合并共享的知识点
- **AND** 返回的数据包含图谱归属信息

## MODIFIED Requirements

### Requirement: 节点数据模型

原有的 Node 模型拆分为两个实体：

**knowledge_points 表**（知识点核心）：
- id: UUID
- title: VARCHAR(255)
- content: TEXT
- learning_material: TEXT
- properties: JSONB
- embedding: vector(1024)
- visibility: VARCHAR(20) DEFAULT 'private' CHECK (visibility IN ('private', 'public', 'pending'))
- owner_id: UUID (FK -> users)
- created_at: TIMESTAMPTZ
- updated_at: TIMESTAMPTZ

**graph_nodes 表**（图谱-知识点关联）：
- id: UUID
- graph_id: UUID (FK -> knowledge_graphs)
- knowledge_point_id: UUID (FK -> knowledge_points)
- x_position: FLOAT
- y_position: FLOAT
- level: VARCHAR(20)
- is_accepted: BOOLEAN
- deleted_at: TIMESTAMPTZ
- created_at: TIMESTAMPTZ
- updated_at: TIMESTAMPTZ

### Requirement: 边数据模型

**edges 表**修改：
- id: UUID
- graph_id: UUID (FK -> knowledge_graphs)
- source_graph_node_id: UUID (FK -> graph_nodes)
- target_graph_node_id: UUID (FK -> graph_nodes)
- relationship_type: VARCHAR(50)
- weight: INTEGER
- deleted_at: TIMESTAMPTZ
- created_at: TIMESTAMPTZ

### Requirement: 学习卡片数据模型

**study_cards 表**修改：
- node_id 改为 knowledge_point_id
- 保留 graph_id 用于区分学习上下文

## REMOVED Requirements

### Requirement: 旧 nodes 表

**Reason**: nodes 表被拆分为 knowledge_points 和 graph_nodes 两个表
**Migration**: 将现有 nodes 数据迁移到新表结构
- nodes 的 title, content, learning_material, properties, embedding 迁移到 knowledge_points
- nodes 的 graph_id, x_position, y_position, level, is_accepted 迁移到 graph_nodes
- 为每个现有 node 创建唯一的 knowledge_point
