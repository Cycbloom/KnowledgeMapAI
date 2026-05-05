# 专题调研增强 - 文献概念提取 Spec

## Why

用户在进行学术研究时，需要阅读大量文献并提取其中的核心概念、方法和机制。目前的手动整理方式效率低下，难以发现不同文献之间的共性和关联。需要一个智能化的工具来帮助用户从文献中自动提取概念并构建知识图谱。

## 工作流程概述

本功能采用**两阶段工作流**：

### 第一阶段：骨干网络生成（初始化）

根据研究主题生成领域框架，包含文献综述、研究背景、研究方法等大模块，**不生成过于详细的节点**，为后续文献阅读提供骨架。

### 第二阶段：文献概念提取（逐步完善）

用户阅读文献时，从文献中提取具体概念、方法、机制等，填充到骨干网络的相应位置，智能聚合相似概念。

## What Changes

- **增强初始化功能**：生成骨干网络而非详细节点
- 新增文献内容输入组件，支持多种输入方式（文本粘贴、文档上传、URL抓取）
- 新增概念提取服务，自动识别并分类文献中的概念（方法、机制、操作等）
- 新增智能聚合机制，相似概念自动聚合并提升节点等级
- 新增来源追溯功能，记录每个概念的来源文献
- 新增提取结果预览界面，支持用户确认后添加
- 增强图谱节点属性，支持存储来源文献列表
- 增强图谱参考资料显示，将文献作为图谱层级的参考资料

## Impact

- Affected specs: 知识图谱构建、自动图谱生成
- Affected code:
  - `src/components/GraphEditor/` - 新增文献输入组件
  - `api/services/ai/` - 新增概念提取服务
  - `api/services/graph/` - 增强节点聚合逻辑
  - `shared/types/graph.ts` - 扩展节点属性类型

## ADDED Requirements

### Requirement: 骨干网络生成（第一阶段）

系统应在初始化时生成领域骨干网络：

#### Scenario: 生成领域框架

- **WHEN** 用户创建专题调研图谱并输入研究主题
- **THEN** 系统生成骨干网络，包含以下大模块：
  - 研究背景 (Research Background)
  - 文献综述 (Literature Review)
  - 研究方法 (Research Methods)
  - 核心概念 (Core Concepts)
  - 应用领域 (Application Domains)
  - 未来方向 (Future Directions)
- **AND** 每个模块只生成简要描述，不深入细节
- **AND** 模块之间建立基本关系连线

#### Scenario: 控制节点粒度

- **WHEN** 生成骨干网络时
- **THEN** 系统只生成 root 和 core 级别的节点
- **AND** 不生成 sub、normal、leaf 级别的详细节点
- **AND** 为后续文献阅读预留扩展空间

#### Scenario: 骨干网络可视化

- **WHEN** 骨干网络生成完成
- **THEN** 用户可以看到清晰的研究领域框架
- **AND** 每个模块显示"待完善"状态
- **AND** 用户可以开始添加文献内容

### Requirement: 文献内容输入（第二阶段）

系统应提供多种文献内容输入方式：

#### Scenario: 直接粘贴文本

- **WHEN** 用户选择粘贴文本方式
- **THEN** 系统提供文本输入框，支持粘贴大段文本内容
- **AND** 文本长度限制为 10000 字符

#### Scenario: 上传文档文件

- **WHEN** 用户选择上传文档方式
- **THEN** 系统支持上传 PDF、Word(.docx)、Markdown(.md) 文件
- **AND** 文件大小限制为 10MB
- **AND** 系统自动解析文档内容

#### Scenario: 输入网页 URL

- **WHEN** 用户输入网页 URL
- **THEN** 系统自动抓取网页内容
- **AND** 提取网页正文内容

### Requirement: 概念自动提取（第二阶段）

系统应自动从文献内容中提取概念并填充到骨干网络：

#### Scenario: 提取核心概念

- **WHEN** 用户提交文献内容进行处理
- **THEN** 系统使用 AI 分析文本
- **AND** 自动识别并提取以下类型的概念：
  - 方法 (Method)
  - 机制 (Mechanism)
  - 操作 (Operation)
  - 概念 (Concept)
  - 技术 (Technology)
  - 工具 (Tool)
- **AND** 为每个概念生成简要描述

#### Scenario: 自动分类标注

- **WHEN** 概念被提取后
- **THEN** 系统自动判断概念类型并标注
- **AND** 使用不同颜色或图标区分不同类型

#### Scenario: 智能定位到骨干模块

- **WHEN** 概念提取完成
- **THEN** 系统自动判断概念属于骨干网络的哪个模块
- **AND** 将概念作为子节点添加到对应的骨干模块下
- **AND** 例如：
  - 方法类概念 → 添加到"研究方法"模块下
  - 核心概念类 → 添加到"核心概念"模块下
  - 应用案例 → 添加到"应用领域"模块下

### Requirement: 智能聚合机制

系统应智能处理相似概念：

#### Scenario: 完全相同概念去重

- **WHEN** 提取的概念与图谱中已有节点完全相同（标题一致）
- **THEN** 系统不创建新节点
- **AND** 将新来源文献添加到已有节点的来源列表

#### Scenario: 相似概念聚合

- **WHEN** 提取的概念与图谱中已有节点相似（语义相近）
- **THEN** 系统提示用户是否聚合
- **AND** 聚合后提升节点等级：
  - 多个来源 → level 升级为 "core"
  - 大量来源 → level 升级为 "root"
- **AND** 节点视觉权重随来源数量增加

#### Scenario: 来源数量展示

- **WHEN** 节点有多个来源文献
- **THEN** 节点上显示来源数量徽章
- **AND** 节点大小/颜色随来源数量变化

### Requirement: 关系自动推断

系统应自动推断概念之间的关系：

#### Scenario: 推断概念关系

- **WHEN** 概念提取完成后
- **THEN** 系统 AI 分析概念之间的语义关系
- **AND** 自动创建关系连线
- **AND** 标注关系类型（如 "使用"、"包含"、"依赖" 等）

### Requirement: 来源文献追溯

系统应记录概念的来源文献：

#### Scenario: 记录节点来源

- **WHEN** 概念被添加到图谱
- **THEN** 系统在节点 properties 中记录来源文献信息：
  - 文献标题
  - 作者
  - 年份
  - URL 或文件名
- **AND** 支持点击跳转到原始文献

#### Scenario: 图谱参考资料

- **WHEN** 处理完一篇文献
- **THEN** 系统将文献信息添加到图谱的 reference_books 字段
- **AND** 在图谱详情页显示参考文献列表

### Requirement: 提取结果预览

系统应提供提取结果预览功能：

#### Scenario: 显示预览列表

- **WHEN** 概念提取完成
- **THEN** 系统显示预览界面，列出所有提取的概念
- **AND** 显示每个概念的类型、描述、来源
- **AND** 标注与已有节点的相似度

#### Scenario: 用户确认添加

- **WHEN** 用户查看预览结果
- **THEN** 用户可以选择：
  - 全部添加
  - 选择性添加
  - 编辑后添加
  - 取消操作

### Requirement: 功能入口

系统应在图谱编辑器内提供功能入口：

#### Scenario: 打开文献输入面板

- **WHEN** 用户在图谱编辑器中点击"文献提取"按钮
- **THEN** 系统显示文献输入面板
- **AND** 面板支持选择输入方式
- **AND** 面板显示处理进度

## MODIFIED Requirements

### Requirement: 节点属性扩展

现有节点属性结构需要扩展以支持来源文献：

#### Scenario: 扩展 properties 字段

- **WHEN** 节点创建或更新时
- **THEN** properties 字段支持存储：
  ```typescript
  {
    sources: Array<{
      title: string;
      authors?: string[];
      year?: number;
      url?: string;
      fileName?: string;
      addedAt: string;
    }>;
    conceptType?: 'method' | 'mechanism' | 'operation' | 'concept' | 'technology' | 'tool';
    sourceCount?: number;
  }
  ```

### Requirement: 图谱参考资料扩展

现有图谱 reference_books 字段需要扩展：

#### Scenario: 自动添加文献引用

- **WHEN** 处理完文献后
- **THEN** 自动将文献信息添加到图谱的 reference_books：
  ```typescript
  {
    title: string;
    author: string;
    isbn?: string;
    description?: string;
    url?: string;
    type: 'paper' | 'book' | 'article' | 'document';
    processedAt: string;
  }
  ```

## Technical Design

### 数据流

```
用户输入 → 内容解析 → AI概念提取 → 相似度检测 → 聚合处理 → 关系推断 → 预览确认 → 保存到图谱
```

### API 设计

#### POST /api/literature/extract

请求：

```typescript
{
  content?: string;           // 直接文本内容
  file?: File;               // 上传的文件
  url?: string;              // 网页 URL
  graph_id: string;          // 目标图谱 ID
  options?: {
    extractTypes?: string[]; // 要提取的概念类型
    maxConcepts?: number;    // 最大概念数量
    similarityThreshold?: number; // 相似度阈值
  };
}
```

响应：

```typescript
{
  concepts: Array<{
    title: string;
    description: string;
    type: ConceptType;
    source: SourceInfo;
    similarTo?: string; // 相似节点 ID
    similarity?: number; // 相似度
  }>;
  relations: Array<{
    source: string;
    target: string;
    type: string;
    confidence: number;
  }>;
  literature: LiteratureInfo;
}
```

#### POST /api/literature/apply

请求：

```typescript
{
  graph_id: string;
  concepts: Concept[];       // 用户确认的概念列表
  relations: Relation[];     // 关系列表
  literature: LiteratureInfo;
}
```

### 组件设计

#### LiteratureExtractPanel

主面板组件，包含：

- 输入方式选择器
- 文本输入框
- 文件上传器
- URL 输入框
- 处理按钮
- 进度指示器

#### ConceptPreviewList

预览列表组件，包含：

- 概念卡片列表
- 相似度提示
- 类型标签
- 来源信息
- 选择/编辑操作

#### ConceptTypeBadge

概念类型徽章组件，显示不同类型的概念标识。
