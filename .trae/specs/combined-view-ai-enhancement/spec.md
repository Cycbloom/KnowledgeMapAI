# 联立视图 AI 功能增强 Spec

## Why
当前联立视图的侧边栏功能过于简单，缺少与单个图谱编辑器相同的 AI 功能（如扩展图谱、生成卡片、生成内容等），也无法通过 AI 创建跨图谱节点之间的连接关系。用户希望在联立视图中也能使用完整的 AI 工具来操作图谱。

## What Changes
- 增强联立视图侧边栏，使其具备与单个图谱编辑器相似的 AI 功能
- 添加 AI 创建跨图谱节点连接的功能
- 支持节点编辑、学习模式、水平测试等功能

## Impact
- Affected specs: combined-graph-view, cross-graph-node-relations
- Affected code:
  - `src/pages/CombinedGraphView.tsx`
  - `src/components/CombinedView/CombinedGraphSidebar.tsx`
  - `src/hooks/useGraphAIOperations.ts`
  - `src/services/api/nodes.ts`

## ADDED Requirements

### Requirement: 联立视图 AI 节点操作
系统 SHALL 在联立视图中提供与单个图谱编辑器相同的 AI 节点操作功能。

#### Scenario: AI 扩展节点
- **WHEN** 用户选中一个节点并点击"扩展节点"
- **THEN** 系统使用 AI 生成该节点的子节点
- **AND** 新节点添加到对应图谱中

#### Scenario: AI 生成节点内容
- **WHEN** 用户选中一个节点并点击"生成内容"
- **THEN** 系统使用 AI 为该节点生成详细内容

#### Scenario: AI 生成学习卡片
- **WHEN** 用户选中一个节点并点击"生成卡片"
- **THEN** 系统使用 AI 为该节点生成学习卡片

### Requirement: AI 创建跨图谱节点连接
系统 SHALL 支持通过 AI 分析并创建两个图谱之间节点的连接关系。

#### Scenario: AI 分析跨图谱连接
- **WHEN** 用户点击"AI 分析连接"
- **THEN** 系统分析两个图谱的节点内容
- **AND** 识别语义相似的节点对
- **AND** 在连接面板中显示建议的连接

#### Scenario: 确认连接建议
- **WHEN** 用户确认一个连接建议
- **THEN** 系统创建跨图谱节点连接
- **AND** 在画布上显示连接线

### Requirement: 联立视图节点编辑
系统 SHALL 在联立视图中支持节点编辑功能。

#### Scenario: 编辑节点
- **WHEN** 用户选中一个节点并点击"编辑"
- **THEN** 侧边栏切换到编辑模式
- **AND** 用户可以修改节点标题、内容、标签等

#### Scenario: 保存编辑
- **WHEN** 用户完成编辑并点击保存
- **THEN** 系统更新节点数据
- **AND** 侧边栏返回详情模式

### Requirement: 联立视图学习功能
系统 SHALL 在联立视图中支持学习模式相关功能。

#### Scenario: 开始水平测试
- **WHEN** 用户点击"水平测试"
- **THEN** 系统基于选中节点生成测试题目

#### Scenario: 开始学习模式
- **WHEN** 用户点击"学习模式"
- **THEN** 系统进入该节点的学习流程

## MODIFIED Requirements

### Requirement: 联立视图侧边栏结构
系统 SHALL 使用与单个图谱编辑器相似的侧边栏结构。

#### Scenario: 侧边栏模式
- **WHEN** 用户使用联立视图
- **THEN** 侧边栏支持以下模式：
  - `outline` - 大纲视图
  - `detail` - 节点详情
  - `edit` - 节点编辑
  - `connections` - 跨图谱连接
