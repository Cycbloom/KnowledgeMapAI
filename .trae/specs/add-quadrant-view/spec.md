# 象限视图 Spec

## Why

在专题研究图谱中，六个骨干节点（研究背景、文献综述、研究方法、核心概念、应用领域、未来方向）是图谱的核心结构。当前思维导图视图将骨干节点显示为普通节点，无法直观展示其作为"知识领域分区"的语义。用户需要一个专门的视图，将骨干节点以区域形式展示，使知识结构更加清晰。

## What Changes

- 新增"象限视图"（Quadrant View）作为图谱的新视图模式
- 骨干节点显示为区域而非节点，区域名称显示为区域标题
- 采用极坐标系设计：角度划分区域，距离表示节点重要性
- 区域使用背景色区分，无明确边界线
- 区域内节点自由布局
- 支持区域折叠/展开功能
- 非专题研究图谱支持用户自定义区域分组

## Impact

- Affected specs: `standardize-backbone-nodes`, `enhance-topic-research`
- Affected code:
  - `shared/types/graph.ts` - 新增视图模式类型
  - `src/components/GraphEditor/canvas/` - 新增 QuadrantCanvas 组件
  - `src/components/GraphEditor/toolbar/` - 新增视图切换功能
  - `src/components/GraphEditor/panels/` - 新增区域分组管理面板
  - `api/services/graph/` - 新增区域分组数据存储

## ADDED Requirements

### Requirement: 象限视图模式定义

系统应定义新的视图模式：

#### Scenario: 添加视图模式类型

- **WHEN** 系统初始化时
- **THEN** `GraphViewMode` 类型新增 `quadrant` 值
- **AND** 视图模式选项包括：`mindmap`、`timeline`、`tree`、`planet`、`quadrant`

#### Scenario: 视图切换

- **WHEN** 用户在图谱工具栏点击视图切换按钮
- **THEN** 系统显示所有可用视图模式列表
- **AND** 用户可以选择"象限视图"
- **AND** 系统切换到象限视图渲染模式

### Requirement: 极坐标系布局

系统应采用极坐标系进行节点布局：

#### Scenario: 原点定位

- **WHEN** 象限视图初始化时
- **THEN** 系统在画布中心设置原点
- **AND** 原点位置可由用户拖拽调整

#### Scenario: 角度划分区域

- **WHEN** 专题研究图谱使用象限视图时
- **THEN** 系统根据骨干节点数量自动计算角度范围
- **AND** 每个骨干节点占据相等的角度范围（如6个骨干节点各占60度）
- **AND** 骨干节点按固定顺序排列：
  - 研究背景：0°-60°
  - 文献综述：60°-120°
  - 研究方法：120°-180°
  - 核心概念：180°-240°
  - 应用领域：240°-300°
  - 未来方向：300°-360°

#### Scenario: 距离表示重要性

- **WHEN** 节点在区域内布局时
- **THEN** 节点到原点的距离表示其重要性
- **AND** 重要性计算基于：
  - 节点 level（root > core > sub > normal > leaf）
  - 节点连接度（连接数越多越重要）
  - 来源数量（sources.length 越多越重要）
- **AND** 距离计算公式：`distance = baseRadius + (1 - importanceScore) * maxRadius`

### Requirement: 区域显示样式

系统应以背景色区分区域：

#### Scenario: 区域背景色

- **WHEN** 渲染象限视图时
- **THEN** 每个区域使用对应的骨干节点颜色作为背景色
- **AND** 背景色透明度为 10%-20%
- **AND** 区域之间无明确边界线，通过背景色过渡区分

#### Scenario: 区域标题显示

- **WHEN** 渲染区域时
- **THEN** 区域标题显示在区域中心位置
- **AND** 标题使用骨干节点图标和名称
- **AND** 标题字体大小根据区域大小自适应

#### Scenario: 区域折叠状态

- **WHEN** 用户点击区域标题或折叠按钮
- **THEN** 区域折叠，隐藏区域内所有节点
- **AND** 折叠状态下仅显示区域标题和背景
- **AND** 再次点击可展开区域

### Requirement: 区域内节点布局

系统应在区域内自由布局节点：

#### Scenario: 节点位置计算

- **WHEN** 节点需要在区域内布局时
- **THEN** 系统计算节点所属区域的角度范围
- **AND** 根据节点重要性计算距离
- **AND** 在极坐标范围内随机分布节点位置
- **AND** 避免节点重叠

#### Scenario: 节点渲染

- **WHEN** 渲染区域内的节点时
- **THEN** 节点使用标准节点样式渲染
- **AND** 节点可拖拽调整位置
- **AND** 节点位置更新后保持在所属区域内

#### Scenario: 节点连线

- **WHEN** 渲染节点之间的连线时
- **THEN** 连线使用曲线样式
- **AND** 连线颜色根据关系类型确定
- **AND** 跨区域的连线使用虚线样式

### Requirement: 自定义区域分组

系统应支持非专题研究图谱创建自定义区域：

#### Scenario: 创建区域分组

- **WHEN** 用户选中多个节点并点击"创建分组"按钮
- **THEN** 系统显示分组创建对话框
- **AND** 用户输入分组名称和选择颜色
- **AND** 系统创建区域分组并分配选中节点

#### Scenario: 管理区域分组

- **WHEN** 用户打开区域管理面板
- **THEN** 系统显示所有区域分组列表
- **AND** 用户可以编辑分组名称和颜色
- **AND** 用户可以删除分组（节点保留但移出分组）
- **AND** 用户可以添加/移除分组内的节点

#### Scenario: 区域分组数据存储

- **WHEN** 用户创建或修改区域分组时
- **THEN** 系统将分组信息存储到图谱设置中
- **AND** 分组数据结构：
  ```typescript
  {
    id: string;
    name: string;
    color: string;
    nodeIds: string[];
    createdAt: string;
    updatedAt: string;
  }
  ```

### Requirement: 视图状态持久化

系统应持久化象限视图的状态：

#### Scenario: 保存视图设置

- **WHEN** 用户切换到象限视图或修改视图设置时
- **THEN** 系统将视图模式保存到图谱设置中
- **AND** 保存折叠状态、区域位置等状态

#### Scenario: 恢复视图状态

- **WHEN** 用户打开图谱时
- **THEN** 系统读取保存的视图模式
- **AND** 如果视图模式为象限视图，则恢复象限视图
- **AND** 恢复之前的折叠状态和区域位置

## MODIFIED Requirements

### Requirement: 图谱视图模式类型扩展

现有 `GraphViewMode` 类型需要扩展：

#### Scenario: 添加 quadrant 类型

- **WHEN** 定义图谱视图模式类型时
- **THEN** `GraphViewMode` 类型包含 `quadrant` 值：
  ```typescript
  export type GraphViewMode = "mindmap" | "timeline" | "tree" | "planet" | "quadrant";
  ```

### Requirement: 图谱设置扩展

现有图谱设置需要扩展以支持区域分组：

#### Scenario: 扩展 settings 字段

- **WHEN** 保存图谱设置时
- **THEN** `settings` 字段支持存储：
  ```typescript
  {
    viewMode?: GraphViewMode;
    quadrantView?: {
      originPosition?: { x: number; y: number };
      collapsedRegions?: string[];
      customRegions?: CustomRegion[];
    };
  }
  ```

## Technical Design

### 数据结构

```typescript
export interface CustomRegion {
  id: string;
  name: string;
  color: string;
  nodeIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface QuadrantViewState {
  originPosition: { x: number; y: number };
  collapsedRegions: Set<string>;
  customRegions: CustomRegion[];
}

export interface RegionInfo {
  id: string;
  name: string;
  color: string;
  icon?: string;
  angleStart: number;
  angleEnd: number;
  nodes: Node[];
  isCollapsed: boolean;
}
```

### 布局算法

```
1. 确定原点位置
2. 计算区域数量和角度范围
3. 为每个区域分配角度范围
4. 计算每个节点的重要性分数
5. 根据重要性计算节点到原点的距离
6. 在极坐标范围内随机分布节点位置
7. 应用力导向算法避免节点重叠
```

### 组件设计

#### QuadrantCanvas

象限视图主画布组件：

```typescript
interface QuadrantCanvasProps {
  nodes: Node[];
  edges: Edge[];
  regions: RegionInfo[];
  originPosition: { x: number; y: number };
  collapsedRegions: Set<string>;
  onOriginMove: (position: { x: number; y: number }) => void;
  onRegionToggle: (regionId: string) => void;
  onNodeClick: (node: Node) => void;
}
```

#### RegionHeader

区域标题组件：

```typescript
interface RegionHeaderProps {
  region: RegionInfo;
  isCollapsed: boolean;
  onToggle: () => void;
}
```

#### RegionBackground

区域背景组件：

```typescript
interface RegionBackgroundProps {
  region: RegionInfo;
  opacity: number;
}
```

### API 设计

#### PUT /api/graphs/{graphId}/settings

更新图谱设置（包括象限视图状态）：

```typescript
{
  viewMode: "quadrant";
  quadrantView: {
    originPosition: { x: 0, y: 0 };
    collapsedRegions: ["region-1"];
    customRegions: [
      {
        id: "custom-1",
        name: "自定义区域",
        color: "#3B82F6",
        nodeIds: ["node-1", "node-2"],
      }
    ];
  };
}
```

#### POST /api/graphs/{graphId}/regions

创建自定义区域：

```typescript
{
  name: string;
  color: string;
  nodeIds: string[];
}
```

#### PATCH /api/graphs/{graphId}/regions/{regionId}

更新区域：

```typescript
{
  name?: string;
  color?: string;
  nodeIds?: string[];
}
```

#### DELETE /api/graphs/{graphId}/regions/{regionId}

删除区域。

## UI/UX 设计

### 视图切换

在图谱工具栏添加视图切换下拉菜单，包含所有视图模式选项。

### 区域交互

- 点击区域标题：折叠/展开区域
- 拖拽原点：调整原点位置
- 拖拽节点：调整节点位置（保持在区域内）

### 区域管理面板

在右侧面板添加"区域管理"标签页，显示所有区域列表，支持：
- 编辑区域名称和颜色
- 添加/移除节点
- 删除自定义区域
