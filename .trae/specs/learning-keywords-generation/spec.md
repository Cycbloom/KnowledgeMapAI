# 学习资料关键词自动生成 Spec

## Why
当前专注模式的关键词识别依赖本地正则匹配，不够智能且每次阅读都需要重新分析。在生成学习资料时同时生成关键词并存储到数据库，可以提供更精准、更高效的关键词识别体验。

## What Changes
- 在 `knowledge_points` 表中新增 `keywords` 字段存储关键词
- 修改 AI 学习资料生成逻辑，同时提取关键词
- 修改专注模式阅读器，优先使用预生成的关键词
- 添加关键词管理 API 端点

## Impact
- Affected specs: learning-focus-mode
- Affected code:
  - `supabase/migrations/00000000000000_initial_schema.sql` - 新增 keywords 字段
  - `api/services/ai/aiService.ts` - 修改 generateLearningMaterial 方法
  - `api/routes/ai/content.ts` - 修改学习资料生成 API
  - `src/components/Learning/HighlightedReader.tsx` - 使用预生成关键词
  - `src/services/api/nodes.ts` - 新增关键词相关 API
  - `src/types/index.ts` - 更新类型定义

## ADDED Requirements

### Requirement: 关键词数据库存储
系统 SHALL 在知识点表中存储关键词数据。

#### Scenario: 数据库字段
- **GIVEN** 知识点数据模型
- **WHEN** 查看知识点结构
- **THEN** 存在 `keywords` 字段（JSONB 类型）
- **AND** 字段存储关键词数组，每个关键词包含：
  - `term`: 关键词文本
  - `importance`: 重要程度 (1-5)
  - `category`: 分类（如"定义"、"概念"、"方法"等）
  - `explanation`: 简短解释

### Requirement: AI 生成关键词
系统 SHALL 在生成学习资料时同时提取关键词。

#### Scenario: 生成学习资料时提取关键词
- **GIVEN** 用户请求生成学习资料
- **WHEN** AI 生成学习内容
- **THEN** 系统同时提取 5-15 个关键词
- **AND** 关键词包含重要程度、分类和简短解释
- **AND** 关键词与学习资料一起保存到数据库

#### Scenario: 关键词提取质量
- **GIVEN** AI 提取关键词
- **WHEN** 分析学习资料内容
- **THEN** 关键词应包含：
  - 核心概念和定义
  - 重要术语和专业词汇
  - 关键方法和流程
  - 重要结论和要点

### Requirement: 专注模式使用预生成关键词
系统 SHALL 在专注模式中优先使用预生成的关键词。

#### Scenario: 使用预生成关键词高亮
- **GIVEN** 知识点已有关键词数据
- **WHEN** 用户在专注模式中阅读学习资料
- **THEN** 系统使用预生成的关键词进行高亮
- **AND** 高亮显示关键词的重要程度
- **AND** 鼠标悬停显示关键词解释

#### Scenario: 无关键词时回退到本地分析
- **GIVEN** 知识点没有预生成的关键词
- **WHEN** 用户在专注模式中阅读
- **THEN** 系统回退到本地正则匹配分析
- **AND** 显示提示建议重新生成学习资料

### Requirement: 关键词管理
系统 SHALL 提供关键词管理功能。

#### Scenario: 重新生成关键词
- **GIVEN** 用户对当前关键词不满意
- **WHEN** 用户点击"重新提取关键词"
- **THEN** 系统调用 AI 重新分析学习资料
- **AND** 更新数据库中的关键词

#### Scenario: 手动编辑关键词
- **GIVEN** 用户想要修改关键词
- **WHEN** 用户编辑关键词列表
- **THEN** 系统保存用户修改的关键词
- **AND** 用户修改的关键词标记为"手动编辑"

## MODIFIED Requirements

### Requirement: 学习资料生成 API 增强
现有的学习资料生成 API SHALL 返回关键词数据。

- 响应中新增 `keywords` 字段
- 关键词与学习资料一起保存到 `knowledge_points` 表

### Requirement: HighlightedReader 组件增强
现有的高亮阅读器 SHALL 支持使用预生成关键词。

- 新增 `keywords` prop 接收预生成关键词
- 优先使用预生成关键词进行高亮
- 无关键词时回退到本地分析

## REMOVED Requirements
无移除的需求。
