# 学习路径图谱增强功能 Spec

## Why
当前学习路径功能与思维导图的集成不够紧密，用户无法直观地在图谱上看到学习路径的展示和顺序，导致学习体验不够流畅。需要增强学习路径在图谱上的可视化展示，提升用户的学习体验。

## What Changes
- 在思维导图上展示学习路径的节点顺序标注
- 实现点击学习路径节点时的高亮效果
- 修复学习路径列表在图谱侧边栏的展示问题

## Impact
- Affected specs: 学习路径功能、图谱编辑器
- Affected code: 
  - `src/components/GraphEditor/MindMapNode.tsx` - 添加学习顺序标注
  - `src/components/GraphEditor/MindMapCanvas.tsx` - 添加学习路径高亮逻辑
  - `src/components/LearningPath/LearningPathPanel.tsx` - 修复展示问题
  - `src/components/LearningPath/LearningPathOutline.tsx` - 增强交互
  - `src/pages/GraphEditor.tsx` - 集成学习路径状态

## ADDED Requirements

### Requirement: 学习路径节点顺序标注
系统应当在思维导图节点上显示学习顺序编号，帮助用户清晰了解学习顺序。

#### Scenario: 显示学习顺序标注
- **WHEN** 用户选择了一个学习路径
- **THEN** 属于该学习路径的节点应当显示对应的顺序编号（如 1、2、3...）
- **AND** 编号应当清晰可见，不遮挡节点内容
- **AND** 编号样式应当与节点状态（待学习/学习中/已完成）有视觉区分

#### Scenario: 未选择学习路径时
- **WHEN** 用户未选择任何学习路径
- **THEN** 节点不显示学习顺序编号
- **AND** 节点保持原有的展示样式

### Requirement: 学习路径节点高亮功能
系统应当支持在点击学习路径节点时高亮显示路径上的所有节点。

#### Scenario: 点击学习路径节点高亮
- **WHEN** 用户点击学习路径侧边栏中的某个节点
- **THEN** 思维导图上对应的节点应当高亮显示
- **AND** 该学习路径上的所有节点应当以连接线或特殊样式突出显示
- **AND** 非路径上的节点应当降低透明度（类似聚焦模式）

#### Scenario: 取消高亮
- **WHEN** 用户点击图谱空白区域或取消选择学习路径
- **THEN** 所有节点恢复正常显示
- **AND** 学习顺序标注保持显示（如果仍选择了学习路径）

### Requirement: 学习路径列表完整展示
系统应当确保学习路径列表在侧边栏中完整展示所有内容。

#### Scenario: 学习路径列表展示
- **WHEN** 用户打开学习路径面板
- **THEN** 应当显示该图谱关联的所有学习路径
- **AND** 每个学习路径应当显示标题、进度、状态等关键信息
- **AND** 列表应当支持滚动查看所有路径

#### Scenario: 学习路径节点列表展示
- **WHEN** 用户展开某个学习路径
- **THEN** 应当显示该路径下的所有学习节点
- **AND** 每个节点应当显示标题、预计时间、学习状态
- **AND** 节点列表应当支持点击跳转到图谱对应位置

## MODIFIED Requirements

### Requirement: MindMapNode 组件增强
原有的 MindMapNode 组件需要支持显示学习路径相关的视觉元素。

#### 新增属性
- `learningOrder?: number` - 学习顺序编号
- `isInLearningPath?: boolean` - 是否在学习路径中
- `learningPathHighlighted?: boolean` - 是否被学习路径高亮

### Requirement: MindMapCanvas 组件增强
原有的 MindMapCanvas 组件需要支持学习路径的高亮状态管理。

#### 新增属性
- `learningPathNodeIds?: Set<string>` - 学习路径包含的节点 ID 集合
- `learningPathOrderMap?: Map<string, number>` - 节点 ID 到学习顺序的映射
- `highlightedPathNodeId?: string | null` - 当前高亮的路径节点

## REMOVED Requirements
无移除的需求。
