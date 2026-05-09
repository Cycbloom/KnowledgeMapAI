# 骨干节点大纲视图特殊标识显示 Spec

## Why

当前骨干节点在图谱视图中通过 `BackboneNodeIcon` 组件显示特殊图标，但在 LearningMode 大纲视图中没有显示这些特殊标识。这导致用户在大纲视图中无法快速识别骨干节点，影响用户体验和知识图谱的结构理解。

## What Changes

- **增强 GraphOutline 组件**：在节点标题前显示骨干节点图标
- **导入必要的组件和类型**：引入 `BackboneNodeIcon` 和相关类型定义
- **添加骨干节点属性检查**：从节点的 `properties.backboneModule` 获取骨干模块信息
- **保持视觉一致性**：确保大纲视图中的骨干节点图标与图谱视图中的样式一致

## Impact

- Affected specs: 骨干节点标准化、专题调研增强
- Affected code:
  - `src/components/GraphEditor/panels/GraphOutline.tsx` - 添加骨干节点图标显示
  - 可能影响其他使用 GraphOutline 组件的地方（如 LearningMode）

## ADDED Requirements

### Requirement: 大纲视图显示骨干节点图标

系统应在大纲视图中为骨干节点显示特殊图标：

#### Scenario: 显示骨干节点图标

- **WHEN** 用户在 LearningMode 或图谱编辑器中查看大纲视图
- **THEN** 骨干节点在标题前显示对应的骨干模块图标
- **AND** 图标颜色与骨干模块的颜色一致
- **AND** 悬停图标时显示骨干模块的完整名称
- **AND** 图标大小适中，不影响文本的可读性

#### Scenario: 骨干节点图标映射

- **WHEN** 显示骨干节点图标时
- **THEN** 根据节点的 `properties.backboneModule` 属性显示对应的图标：
  - `research_background` → BookOpen 图标
  - `literature_review` → FileText 图标
  - `research_methods` → Microscope 图标
  - `core_concepts` → Lightbulb 图标
  - `application_domains` → Target 图标
  - `future_directions` → Rocket 图标

#### Scenario: 非骨干节点不显示图标

- **WHEN** 节点没有 `properties.backboneModule` 属性
- **THEN** 不显示骨干节点图标
- **AND** 节点显示保持原有样式

### Requirement: 视觉一致性

系统应确保骨干节点在不同视图中的一致性：

#### Scenario: 图标样式一致

- **WHEN** 骨干节点在大纲视图中显示
- **THEN** 图标样式与图谱视图中的 `BackboneNodeIcon` 组件一致
- **AND** 使用相同的颜色方案
- **AND** 使用相同的图标映射

#### Scenario: 布局适配

- **WHEN** 骨干节点图标显示在大纲视图中
- **THEN** 图标与节点标题之间保持适当的间距
- **AND** 不影响大纲视图的整体布局
- **AND** 在深色模式和浅色模式下都能清晰显示

## Technical Design

### 实现步骤

1. 在 `GraphOutline.tsx` 中导入 `BackboneNodeIcon` 组件
2. 在 `TreeNode` 组件中检查节点的 `properties.backboneModule` 属性
3. 在节点标题前渲染骨干节点图标
4. 确保图标在树形视图和列表视图中都能正确显示

### 代码修改示例

```typescript
import { BackboneNodeIcon } from '../BackboneNodeIcon';
import { BackboneModule } from '@shared/types/graph';

// 在 TreeNode 组件中
const backboneModule = node.properties?.backboneModule as BackboneModule | undefined;

// 在节点标题前添加图标
<span className="truncate flex-1 font-medium flex items-center gap-1.5">
  {backboneModule && (
    <BackboneNodeIcon 
      module={backboneModule} 
      size="small" 
      showTooltip={true} 
    />
  )}
  {node.title || t('graphEditor.outline.unnamedNode')}
</span>
```

### 样式考虑

- 图标大小：使用 `small` 尺寸（14px）
- 间距：图标与标题之间使用 `gap-1.5`（6px）
- 颜色：使用 `BACKBONE_MODULE_COLORS` 中定义的颜色
- 悬停提示：显示骨干模块的完整名称
