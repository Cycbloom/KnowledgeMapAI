# 图谱扩展属性与总览展示 Spec

## Why

在闯关学习模式中，当用户未从左侧大纲选择任何知识点时，当前页面仅显示"开始您的学习之旅"的空白占位内容，缺乏有价值的信息。用户希望在此处展示图谱的总览信息，包括图谱描述、参考书籍、外部链接和学习指南，帮助用户了解当前学习领域的整体情况。

## What Changes

- **数据库扩展**：在 `knowledge_graphs` 表中添加三个新字段
  - `reference_books` (JSONB)：存储参考书籍列表
  - `external_links` (JSONB)：存储外部链接列表
  - `learning_guide` (TEXT)：存储学习指南/建议

- **类型定义更新**：更新 `Graph` 类型接口，添加新字段类型

- **API 扩展**：扩展图谱服务，支持新字段的读写

- **新增组件**：创建 `GraphOverviewPanel` 组件，展示图谱总览信息

- **页面优化**：修改 `LearningMode.tsx`，在未选择知识点时展示图谱总览

## Impact

- **Affected specs**: 
  - 图谱数据模型
  - 闯关学习模式页面

- **Affected code**:
  - `supabase/migrations/00000000000000_initial_schema.sql` - 数据库 schema
  - `shared/types/graph.ts` - 类型定义
  - `api/services/graph/graphService.ts` - 图谱服务
  - `src/pages/LearningMode.tsx` - 学习模式页面
  - `src/components/Learning/` - 新增图谱总览组件

## ADDED Requirements

### Requirement: 图谱扩展属性数据模型

系统 SHALL 在 `knowledge_graphs` 表中支持以下新字段：

- `reference_books` (JSONB)：存储参考书籍列表，结构为：
  ```json
  [
    {
      "title": "书籍标题",
      "author": "作者",
      "isbn": "ISBN号（可选）",
      "description": "简介（可选）",
      "url": "购买/阅读链接（可选）"
    }
  ]
  ```

- `external_links` (JSONB)：存储外部链接列表，结构为：
  ```json
  [
    {
      "title": "链接标题",
      "url": "链接地址",
      "type": "article|video|course|tool|other",
      "description": "简介（可选）"
    }
  ]
  ```

- `learning_guide` (TEXT)：存储学习指南/建议，支持 Markdown 格式

#### Scenario: 创建图谱时设置扩展属性

- **WHEN** 用户创建新图谱
- **THEN** 系统应允许用户填写参考书籍、外部链接和学习指南
- **AND** 这些字段应为可选，默认为空

#### Scenario: 更新图谱扩展属性

- **WHEN** 用户编辑图谱信息
- **THEN** 系统应允许用户修改参考书籍、外部链接和学习指南
- **AND** 修改应实时保存

### Requirement: 图谱总览展示组件

系统 SHALL 在闯关学习模式的占位页面展示图谱总览信息

#### Scenario: 未选择知识点时展示总览

- **WHEN** 用户进入闯关学习模式但未选择任何知识点
- **THEN** 系统应展示图谱总览面板，包含：
  - 图谱标题和描述
  - 参考书籍列表（如有）
  - 外部链接列表（如有）
  - 学习指南（如有）
  - 快速开始学习的提示

#### Scenario: 空状态处理

- **WHEN** 图谱没有设置任何扩展信息
- **THEN** 系统应显示引导用户添加信息的提示
- **OR** 显示默认的学习引导内容

### Requirement: 图谱扩展属性编辑功能

系统 SHALL 支持用户编辑图谱的扩展属性

#### Scenario: 从总览页面编辑

- **WHEN** 用户点击图谱总览面板中的"编辑"按钮
- **THEN** 系统应打开编辑模态框
- **AND** 允许用户添加/修改/删除参考书籍和外部链接
- **AND** 允许用户编辑学习指南

#### Scenario: 添加参考书籍

- **WHEN** 用户在编辑模态框中添加新的参考书籍
- **THEN** 系统应验证必填字段（标题、作者）
- **AND** 保存到数据库后刷新显示

#### Scenario: 添加外部链接

- **WHEN** 用户在编辑模态框中添加新的外部链接
- **THEN** 系统应验证必填字段（标题、URL、类型）
- **AND** 保存到数据库后刷新显示

## MODIFIED Requirements

### Requirement: Graph 类型定义更新

现有的 `Graph` 接口 SHALL 添加以下新字段：

```typescript
export interface ReferenceBook {
  title: string;
  author: string;
  isbn?: string;
  description?: string;
  url?: string;
}

export interface ExternalLink {
  title: string;
  url: string;
  type: 'article' | 'video' | 'course' | 'tool' | 'other';
  description?: string;
}

export interface Graph {
  // ... 现有字段
  reference_books?: ReferenceBook[];
  external_links?: ExternalLink[];
  learning_guide?: string;
}
```

## REMOVED Requirements

无移除的需求。
