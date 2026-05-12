# 优化骨干模块数据模型 Spec

## Why

当前设计存在问题：

1. 骨干节点（如"研究背景"）和普通知识点混在同一个 `knowledge_points` 表中
2. 骨干节点本质上是图谱的结构信息，而不是知识点
3. 子节点通过 `properties.backboneModule` 引用骨干节点，但骨干节点本身也在知识点表中，设计混乱

**更好的设计**：骨干模块是图谱级别的属性，不是节点。

## What Changes

- **BREAKING**: 骨干模块从节点概念改为图谱属性
- 新增 `graph_backbone_modules` 表存储图谱的骨干模块配置
- 知识点的 `properties.backboneModule` 表示它属于哪个区域
- 移除骨干节点作为知识点的概念
- 象限视图直接使用图谱的骨干模块配置渲染区域

## Impact

- Affected specs: `standardize-backbone-nodes`, `add-quadrant-view`
- Affected code:
  - `supabase/migrations/` - 新增 `graph_backbone_modules` 表
  - `api/services/ai/backboneNetworkService.ts` - 修改骨干网络生成逻辑
  - `src/pages/GraphEditor.tsx` - 修改 regions 计算逻辑
  - `shared/types/graph.ts` - 新增类型定义

## ADDED Requirements

### Requirement: 骨干模块作为图谱属性

骨干模块应该是图谱的结构属性，而不是节点：

#### Scenario: 骨干模块数据结构

- **WHEN** 创建专题研究图谱时
- **THEN** 图谱自动创建6个骨干模块配置
- **AND** 每个骨干模块有：名称、图标、颜色、描述
- **AND** 骨干模块不是知识点节点

#### Scenario: 知识点区域归属

- **WHEN** 创建知识点时
- **THEN** 知识点可以通过 `properties.backboneModule` 指定所属区域
- **AND** 该属性是可选的，表示知识点属于哪个骨干模块区域

### Requirement: 骨干模块数据表

新增 `graph_backbone_modules` 表：

```sql
CREATE TABLE graph_backbone_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  graph_id UUID NOT NULL REFERENCES graphs(id) ON DELETE CASCADE,
  module_type VARCHAR(50) NOT NULL, -- research_background, literature_review, etc.
  title VARCHAR(255) NOT NULL,
  icon VARCHAR(10),
  color VARCHAR(20),
  description TEXT,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(graph_id, module_type)
);
```

### Requirement: 象限视图区域渲染

象限视图直接使用图谱的骨干模块配置：

#### Scenario: 获取骨干模块配置

- **WHEN** 渲染象限视图时
- **THEN** 从 `graph_backbone_modules` 表获取图谱的骨干模块配置
- **AND** 每个模块渲染为一个区域

#### Scenario: 分配节点到区域

- **WHEN** 分配节点到区域时
- **THEN** 根据节点的 `properties.backboneModule` 属性分配
- **AND** 没有 `backboneModule` 属性的节点显示在默认区域

## MODIFIED Requirements

### Requirement: 专题研究图谱初始化

修改专题研究图谱初始化流程：

#### Scenario: 创建骨干模块配置

- **WHEN** 创建专题研究图谱时
- **THEN** 自动创建6个骨干模块配置记录
- **AND** 不再创建骨干节点作为知识点

#### Scenario: 生成知识点

- **WHEN** AI 生成知识点时
- **THEN** 知识点根据内容自动分配 `backboneModule` 属性
- **AND** 知识点不再有"骨干节点"的概念

## Technical Design

### 数据模型对比

**之前的设计**：

```
knowledge_points
├── 骨干节点（研究背景）- level: core, properties.backboneModule: research_background
├── 骨干节点（文献综述）- level: core, properties.backboneModule: literature_review
├── 子节点A - properties.backboneModule: research_background
└── 子节点B - properties.backboneModule: literature_review
```

**新的设计**：

```
graphs
└── graph_backbone_modules
    ├── 研究背景 - module_type: research_background
    ├── 文献综述 - module_type: literature_review
    └── ...

knowledge_points
├── 子节点A - properties.backboneModule: research_background
└── 子节点B - properties.backboneModule: literature_review
```

### 类型定义

```typescript
// 骨干模块类型
export interface GraphBackboneModule {
  id: string;
  graph_id: string;
  module_type: BackboneModule;
  title: string;
  icon?: string;
  color?: string;
  description?: string;
  display_order: number;
  created_at: string;
  updated_at: string;
}

// 图谱类型扩展
export interface Graph {
  // ... 现有属性
  backbone_modules?: GraphBackboneModule[];
}
```

### 迁移策略

1. 创建 `graph_backbone_modules` 表
2. 从现有专题研究图谱中提取骨干节点信息
3. 为每个图谱创建骨干模块配置记录
4. 删除骨干节点作为知识点的记录
5. 更新前端代码使用新的数据结构

### 优点

1. **概念清晰**：骨干模块是图谱结构，不是知识点
2. **数据分离**：结构信息和内容信息分开存储
3. **易于扩展**：可以支持不同类型的图谱结构
4. **查询简单**：不需要复杂的节点类型判断

