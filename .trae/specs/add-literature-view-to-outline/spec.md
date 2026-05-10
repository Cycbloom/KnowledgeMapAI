# 大纲面板文献视图 Spec

## Why

专题研究图谱中，概念节点来源于不同文献，当前大纲面板只能按骨干模块分组查看节点，无法按文献来源维度浏览。用户需要一种"文献视图"来查看每篇文献贡献了哪些概念，便于追溯知识来源和评估文献覆盖度。

## What Changes

- GraphOutline 组件新增 `literature` 视图模式，按文献来源分组展示节点
- 视图切换栏在专题研究图谱中增加"文献"按钮
- 文献视图按文献标题分组，每组显示文献元信息和关联的概念节点列表
- 无来源信息的节点归入"未分类"组

## Impact

- Affected specs: optimize-learning-mode-topic-research-ui
- Affected code:
  - `src/components/GraphEditor/panels/GraphOutline.tsx` - 新增文献视图

## ADDED Requirements

### Requirement: 文献视图模式

系统 SHALL 在专题研究图谱的大纲面板中提供按文献来源分组展示节点的视图。

#### Scenario: 切换到文献视图
- **WHEN** 用户在专题研究图谱的大纲面板中点击"文献"视图按钮
- **THEN** 大纲面板切换到文献视图，按文献来源分组展示节点

#### Scenario: 文献分组展示
- **WHEN** 文献视图激活
- **THEN** 系统从所有节点的 `properties.sources` 中提取文献信息
- **AND** 按文献标题去重分组，每组包含来自该文献的所有概念节点
- **AND** 每个文献组显示文献标题、作者（如有）、年份（如有）
- **AND** 每个文献组显示关联的概念节点数量
- **AND** 没有任何来源信息的节点归入"未分类"组，放在最后

#### Scenario: 文献组展开/折叠
- **WHEN** 用户点击文献组头部
- **THEN** 该文献组展开/折叠，展开时显示关联的概念节点列表
- **AND** 概念节点渲染复用现有逻辑（显示标题、级别颜色、骨干节点图标等）

#### Scenario: 非专题研究图谱
- **WHEN** 用户在非专题研究类型的图谱中
- **THEN** 不显示文献视图按钮，行为不变
