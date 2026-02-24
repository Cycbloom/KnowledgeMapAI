# 边可视化增强 Spec

## Why
当前知识图谱中顶点之间的边样式单调，缺乏视觉区分度。用户无法直观地识别不同类型的关系，也无法自定义边的标签、颜色、线型等属性。需要增强边的可视化能力，提升用户体验和信息传达效率。

## What Changes
- 扩展边的数据结构，支持自定义标签、颜色、线型、箭头等属性
- 实现基于关系类型的视觉样式映射（颜色+线型组合）
- 添加边标签显示功能（可切换显示/隐藏）
- 实现箭头显示功能（按关系类型自动判断）
- 创建关系类型配置管理系统（预设+自定义）
- 实现边编辑右键菜单功能
- **BREAKING**: Edge 接口新增字段，需要数据库迁移

## Impact
- Affected specs: 无
- Affected code:
  - `src/types/index.ts` - Edge 接口扩展
  - `src/components/GraphEditor/MindMapLink.tsx` - 边渲染组件
  - `src/components/GraphEditor/MindMapCanvas.tsx` - 画布组件
  - `src/components/GraphEditor/GraphStyleSettings.tsx` - 样式设置
  - `api/services/edgeService.ts` - 边服务
  - 数据库迁移 - 新增字段

## ADDED Requirements

### Requirement: 边标签功能
系统应提供边标签显示功能，允许用户为每条边添加自定义标签文字。

#### Scenario: 显示关系类型标签
- **WHEN** 用户查看图谱且边标签显示开关打开
- **THEN** 边上显示 relationship_type 作为默认标签

#### Scenario: 自定义标签覆盖
- **WHEN** 用户为边设置了自定义标签
- **THEN** 显示自定义标签而非关系类型

#### Scenario: 切换标签显示
- **WHEN** 用户点击标签显示开关
- **THEN** 所有边的标签显示/隐藏状态切换

### Requirement: 箭头显示功能
系统应根据关系类型自动判断是否显示箭头。

#### Scenario: 有向关系显示箭头
- **WHEN** 边的关系类型为有向类型（depends_on, prerequisite, follows, 指向, 作用, 影响, 因果等）
- **THEN** 边的目标端显示箭头

#### Scenario: 无向关系不显示箭头
- **WHEN** 边的关系类型为无向类型（related, similar_to, 相似, 相反, 同义等）
- **THEN** 边不显示箭头

### Requirement: 关系类型视觉样式
系统应为不同关系类型提供差异化的视觉样式（颜色+线型组合）。

#### Scenario: 预设关系类型样式
- **WHEN** 边使用预设关系类型
- **THEN** 自动应用对应的颜色和线型样式

#### Scenario: 自定义关系类型样式
- **WHEN** 用户创建自定义关系类型
- **THEN** 用户可配置该类型的颜色、线型、箭头属性

### Requirement: 关系类型管理
系统应提供关系类型的配置管理功能。

#### Scenario: 全局关系类型配置
- **WHEN** 用户在全局设置面板管理关系类型
- **THEN** 可以查看、编辑、新增、删除关系类型配置

#### Scenario: 边级别关系配置
- **WHEN** 用户在边编辑弹窗中配置关系
- **THEN** 可以选择关系类型、设置自定义标签

### Requirement: 边编辑交互
系统应提供便捷的边编辑交互方式。

#### Scenario: 右键菜单编辑
- **WHEN** 用户右键点击边
- **THEN** 显示编辑菜单，包含编辑标签、关系类型、删除等选项

#### Scenario: 编辑标签
- **WHEN** 用户选择编辑标签
- **THEN** 弹出输入框允许用户输入自定义标签

## MODIFIED Requirements

### Requirement: Edge 数据结构扩展
原有 Edge 接口需要扩展以支持新功能。

```typescript
export interface Edge {
  id: string;
  graph_id: string;
  source_knowledge_point_id: string;
  target_knowledge_point_id: string;
  relationship_type?: string;
  weight?: number;
  // 新增字段
  custom_label?: string;        // 自定义标签
  custom_color?: string;        // 自定义颜色（覆盖关系类型默认颜色）
  custom_line_style?: LineStyle; // 自定义线型
  show_arrow?: boolean;         // 是否显示箭头（null表示自动判断）
  deleted_at?: string;
  created_at?: string;
}
```

### Requirement: 关系类型配置数据结构
新增关系类型配置的数据结构。

```typescript
export interface RelationshipTypeConfig {
  id: string;
  name: string;              // 关系类型名称
  display_name: string;      // 显示名称
  category: RelationshipCategory; // 分类
  color: string;             // 颜色
  line_style: LineStyle;     // 线型
  show_arrow: boolean | 'auto'; // 箭头显示
  is_builtin: boolean;       // 是否内置
  user_id?: string;          // 创建用户（自定义类型）
}

export type RelationshipCategory = 
  | 'hierarchical'    // 层级结构
  | 'dependency'      // 依赖约束
  | 'semantic'        // 语义关系
  | 'temporal'        // 时序流程
  | 'interaction'     // 交互行为
  | 'causal'          // 因果推导
  | 'custom';         // 自定义

export type LineStyle = 'solid' | 'dashed' | 'dotted' | 'double';
```

## 预设关系类型配置

| 分类 | 关系类型 | 显示名称 | 颜色 | 线型 | 箭头 |
|-----|---------|---------|------|------|------|
| 层级结构 | contains | 包含 | #3B82F6 | solid | auto |
| 层级结构 | part_of | 属于 | #3B82F6 | solid | auto |
| 层级结构 | parent_child | 父子 | #3B82F6 | solid | auto |
| 依赖约束 | depends_on | 依赖 | #F59E0B | dashed | true |
| 依赖约束 | prerequisite | 前提 | #F59E0B | dashed | true |
| 依赖约束 | constrains | 制约 | #F59E0B | dashed | true |
| 依赖约束 | supports | 支撑 | #F59E0B | dashed | true |
| 依赖约束 | mutex | 互斥 | #EF4444 | dotted | false |
| 依赖约束 | exclusive | 排他 | #EF4444 | dotted | false |
| 语义关系 | related | 相关 | #6B7280 | solid | false |
| 语义关系 | similar_to | 相似 | #8B5CF6 | solid | false |
| 语义关系 | opposite | 相反 | #EC4899 | solid | false |
| 语义关系 | synonym | 同义 | #8B5CF6 | solid | false |
| 语义关系 | equivalent | 等价 | #8B5CF6 | solid | false |
| 语义关系 | generalization | 泛化 | #10B981 | solid | true |
| 语义关系 | specialization | 特化 | #10B981 | solid | true |
| 时序流程 | follows | 后续 | #06B6D4 | dashed | true |
| 时序流程 | parallel | 并行 | #06B6D4 | solid | false |
| 时序流程 | branch | 分支 | #06B6D4 | solid | true |
| 时序流程 | merge | 汇合 | #06B6D4 | solid | true |
| 时序流程 | trigger | 触发 | #06B6D4 | dashed | true |
| 时序流程 | loop | 循环 | #06B6D4 | dashed | true |
| 交互行为 | points_to | 指向 | #F97316 | solid | true |
| 交互行为 | acts_on | 作用 | #F97316 | solid | true |
| 交互行为 | influences | 影响 | #F97316 | dashed | true |
| 交互行为 | feedback | 反馈 | #F97316 | dashed | true |
| 交互行为 | calls | 调用 | #F97316 | solid | true |
| 因果推导 | causes | 因果 | #DC2626 | solid | true |
| 因果推导 | derives | 推导 | #DC2626 | solid | true |
| 因果推导 | proportional | 正比 | #DC2626 | solid | false |
| 因果推导 | inverse | 反比 | #DC2626 | solid | false |

## REMOVED Requirements
无移除的需求。
