# 节点标题截断显示 Spec

## Why
当前思维导图/知识图谱中，节点标题如果过长会直接溢出显示，影响视觉美观和用户体验。需要对过长标题进行截断处理，并提供悬停查看完整标题的功能。

## What Changes
- 在思维导图视图、树形视图、时间轴视图中，对超过10个字符的节点标题进行截断显示
- 在3D星球视图中，对超过10个字符的节点标题进行截断显示
- 添加悬停时显示完整标题的 Tooltip 功能
- 创建统一的标题截断工具函数

## Impact
- Affected specs: 节点显示、用户交互
- Affected code:
  - `src/components/GraphEditor/MindMapNode.tsx` - 主要的节点渲染组件
  - `src/three/PlanetView.tsx` - 3D星球视图
  - 新增 `src/utils/textUtils.ts` - 文本处理工具函数

## ADDED Requirements

### Requirement: 标题截断显示
The system SHALL truncate node titles that exceed 10 characters in all graph views, displaying an ellipsis (...) at the end.

#### Scenario: 标题超过10个字符
- **WHEN** a node title exceeds 10 characters
- **THEN** the system displays the first 10 characters followed by "..." (e.g., "这是一个很长的标题..." for "这是一个很长的标题内容")

#### Scenario: 标题不超过10个字符
- **WHEN** a node title is 10 characters or less
- **THEN** the system displays the full title without modification

### Requirement: 悬停显示完整标题
The system SHALL display the full title in a tooltip when the user hovers over a truncated node title.

#### Scenario: 悬停截断标题
- **WHEN** user hovers over a node with a truncated title
- **THEN** the system displays a tooltip showing the complete title

#### Scenario: 悬停非截断标题
- **WHEN** user hovers over a node with a non-truncated title (≤10 characters)
- **THEN** no tooltip is displayed (or optional: still show tooltip for consistency)

### Requirement: 统一截断配置
The system SHALL provide a centralized configuration for title truncation settings.

#### Scenario: 配置参数
- **GIVEN** the truncation settings
- **WHEN** developer needs to adjust truncation behavior
- **THEN** the following parameters are configurable:
  - `MAX_TITLE_LENGTH`: Maximum characters before truncation (default: 10)
  - `ELLIPSIS`: String to append when truncated (default: "...")

## Implementation Notes

### 文本截断工具函数
```typescript
// src/utils/textUtils.ts
export const truncateText = (text: string, maxLength: number = 10, ellipsis: string = '...'): {
  truncated: string;
  isTruncated: boolean;
  original: string;
}
```

### 涉及的组件修改

1. **MindMapNode.tsx** (思维导图/树形/时间轴视图)
   - 引入 `truncateText` 函数
   - 修改标题渲染逻辑
   - 添加 Tooltip 组件显示完整标题

2. **PlanetView.tsx** (3D星球视图)
   - 在 `PlanetNode` 组件中引入截断逻辑
   - 使用 Three.js 的方式实现悬停提示
