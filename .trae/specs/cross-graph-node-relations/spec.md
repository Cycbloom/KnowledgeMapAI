# 跨图谱节点关系可视化 Spec

## Why
当前联立视图只能并排显示两个图谱，但无法展示两个图谱之间节点的关联关系。知识点可以跨图谱复用（同一个 `knowledge_point_id` 可出现在多个图谱中），这种跨图谱的连接关系对于理解知识体系非常有价值，需要可视化展示并支持导出。

## What Changes
- 检测两个图谱中相同的知识点（通过 `knowledge_point_id` 匹配）
- 在联立视图画布上绘制跨图谱节点连接线
- 添加跨图谱关系面板，展示节点对应关系
- 支持导出跨图谱节点关系网络（JSON 格式）

## Impact
- Affected specs: combined-graph-view
- Affected code: 
  - `src/pages/CombinedGraphView.tsx`
  - `src/components/CombinedView/CombinedGraphSidebar.tsx`
  - `src/types/index.ts`

## ADDED Requirements

### Requirement: 跨图谱节点连接检测
系统 SHALL 自动检测两个图谱中相同的知识点，通过 `knowledge_point_id` 进行匹配。

#### Scenario: 检测相同知识点
- **WHEN** 两个图谱中存在相同的 `knowledge_point_id`
- **THEN** 系统识别为跨图谱节点连接

### Requirement: 跨图谱节点连接线可视化
系统 SHALL 在联立视图画布上绘制跨图谱节点之间的连接线。

#### Scenario: 显示连接线
- **WHEN** 存在跨图谱节点连接
- **THEN** 在两个节点之间绘制虚线连接
- **AND** 连接线使用特殊颜色标识（如紫色渐变）
- **AND** 连接线带有动画效果

#### Scenario: 连接线交互
- **WHEN** 用户悬停在连接线上
- **THEN** 显示连接详情（节点名称、所属图谱）

### Requirement: 跨图谱关系面板
系统 SHALL 在侧边栏中展示跨图谱节点对应关系列表。

#### Scenario: 显示对应关系
- **WHEN** 存在跨图谱节点连接
- **THEN** 侧边栏显示"跨图谱连接"标签页
- **AND** 列出所有匹配的节点对
- **AND** 显示匹配类型（相同知识点）

### Requirement: 跨图谱关系导出
系统 SHALL 支持导出跨图谱节点关系网络。

#### Scenario: 导出 JSON
- **WHEN** 用户点击导出按钮
- **THEN** 生成包含以下内容的 JSON 文件：
  - 两个图谱的基本信息
  - 图谱间关系
  - 跨图谱节点连接列表
  - 节点详细信息

## MODIFIED Requirements

### Requirement: 联立视图数据获取
系统 SHALL 同时获取节点的 `knowledge_point_id` 用于跨图谱匹配。

#### Scenario: 获取节点数据
- **WHEN** 加载联立视图
- **THEN** 节点数据包含 `knowledge_point_id` 字段
