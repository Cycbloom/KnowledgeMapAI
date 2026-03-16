# 领域图谱批量生成功能 Spec

## Why

当前图谱地图页面只能逐个创建图谱，用户如果想要构建一个完整领域的知识图谱体系（如"计算机科学与技术"），需要手动创建多个图谱（如"数据库"、"操作系统"、"计算机网络"等），效率低下。AI 助手中的学习路径功能已有类似能力，但仅限于单个图谱的前置知识创建。需要将此能力扩展到图谱地图层面，支持基于领域主题批量生成多个相关图谱。

## What Changes

- 在图谱地图工具栏添加"领域图谱生成"按钮
- 创建领域图谱生成面板组件，支持输入领域主题
- AI 分析领域主题，生成推荐的知识图谱列表
- 用户可选择要创建的图谱，批量生成并自动建立关系
- 复用现有的 `createPrerequisiteGraphs` API 或创建新的批量生成 API

## Impact

- Affected specs: 图谱地图页面、图谱创建流程
- Affected code:
  - `src/pages/GraphMap.tsx` - 添加领域图谱生成入口
  - `src/components/GraphMap/GraphMapToolbar.tsx` - 添加工具栏按钮
  - 新增 `src/components/GraphMap/DomainGraphGenerator.tsx` - 领域图谱生成面板
  - `api/routes/graphs.ts` - 可能需要添加新的 API 端点
  - `api/services/graph/graphService.ts` - 可能需要添加领域图谱生成服务

## ADDED Requirements

### Requirement: 领域图谱批量生成入口

系统 SHALL 在图谱地图工具栏提供"领域图谱生成"按钮，点击后打开领域图谱生成面板。

#### Scenario: 打开领域图谱生成面板
- **WHEN** 用户在图谱地图页面点击"领域图谱生成"按钮
- **THEN** 系统打开领域图谱生成面板

### Requirement: 领域主题输入与分析

系统 SHALL 支持用户输入领域主题，并通过 AI 分析生成推荐的知识图谱列表。

#### Scenario: 输入领域主题并生成推荐
- **GIVEN** 用户已打开领域图谱生成面板
- **WHEN** 用户输入领域主题（如"计算机科学与技术"）并点击"生成推荐"
- **THEN** 系统 AI 分析该领域，返回相关的知识图谱推荐列表
- **AND** 每个推荐图谱包含标题、描述、建议的关系类型

#### Scenario: AI 生成失败
- **WHEN** AI 分析领域主题失败
- **THEN** 系统显示错误提示，用户可重试

### Requirement: 图谱选择与批量创建

系统 SHALL 允许用户从推荐列表中选择要创建的图谱，并支持批量创建。

#### Scenario: 选择图谱并批量创建
- **GIVEN** AI 已生成推荐图谱列表
- **WHEN** 用户选择多个图谱并点击"批量创建"
- **THEN** 系统批量创建选中的图谱
- **AND** 自动建立图谱之间的关系
- **AND** 显示创建进度和结果

#### Scenario: 创建进度显示
- **WHEN** 系统正在批量创建图谱
- **THEN** 显示当前创建进度（如"正在创建第 3/10 个图谱"）
- **AND** 显示已创建的图谱列表

### Requirement: 图谱关系自动建立

系统 SHALL 在批量创建图谱时，自动分析并建立图谱之间的关系。

#### Scenario: 自动建立图谱关系
- **GIVEN** 用户选择创建多个图谱
- **WHEN** 批量创建完成
- **THEN** 系统根据 AI 分析结果，自动建立图谱之间的前置、扩展或相关关系
- **AND** 在图谱地图上显示新创建的图谱及其关系

### Requirement: 可选的图谱内容自动生成

系统 SHALL 支持用户选择是否为新创建的图谱自动生成知识点内容。

#### Scenario: 启用内容自动生成
- **GIVEN** 用户在批量创建面板中勾选"自动生成图谱内容"
- **WHEN** 批量创建图谱
- **THEN** 系统在创建图谱后，自动调用深度拓展功能生成知识点

### Requirement: 复用现有学习路径向导能力

系统 SHALL 复用学习路径向导中的前置知识图谱创建逻辑，保持功能一致性。

#### Scenario: 复用现有 API
- **WHEN** 执行领域图谱批量创建
- **THEN** 系统复用或扩展现有的 `createPrerequisiteGraphs` API
- **AND** 保持与学习路径向导相同的创建逻辑和用户体验
