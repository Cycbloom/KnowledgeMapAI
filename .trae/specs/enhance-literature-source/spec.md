# 文献来源识别增强 Spec

## Why

当前文献提取面板只提供内容输入（文本/文件/URL），缺少文献来源信息的录入和自动识别功能。用户需要：
1. 手动输入或自动识别文献的元数据（标题、作者、年份、期刊/会议、DOI 等）
2. 将文献信息自动关联到知识图谱的参考资料栏目
3. 使用大模型从文献内容中自动提取元数据

## What Changes

- **新增文献元数据输入区域**：独立的来源信息表单
- **新增 AI 自动识别元数据功能**：从文献内容中提取标题、作者、年份等
- **新增文献类型识别**：自动判断文献类型（论文、书籍、文章、报告等）
- **增强 LiteratureExtractPanel 组件**：添加来源信息输入和显示
- **增强后端 API**：支持元数据提取和存储
- **增强图谱参考资料**：自动将文献添加到 reference_books

## Impact

- Affected specs: 文献概念提取、图谱参考资料
- Affected code:
  - `src/components/LiteratureExtract/LiteratureExtractPanel.tsx` - 增强来源输入
  - `api/services/ai/literatureMetadataService.ts` - 新增元数据提取服务
  - `api/routes/literature.ts` - 增强 API 接口
  - `shared/types/graph.ts` - 扩展 LiteratureInfo 类型

## ADDED Requirements

### Requirement: 文献元数据输入

系统应提供文献来源信息的输入界面：

#### Scenario: 手动输入元数据

- **WHEN** 用户展开"来源信息"区域
- **THEN** 系统显示以下输入字段：
  - 文献标题（必填）
  - 作者（多个，逗号分隔）
  - 发表年份
  - 文献类型（论文/书籍/文章/报告/网页）
  - 期刊/会议名称
  - DOI 或 URL
  - 备注
- **AND** 所有字段支持可选填写

#### Scenario: 从文件名自动推断

- **WHEN** 用户上传文件
- **THEN** 系统尝试从文件名推断文献标题
- **AND** 自动填充到标题字段

#### Scenario: 来源信息折叠显示

- **WHEN** 用户未展开来源区域
- **THEN** 显示简要来源状态（如"未填写来源"或"来源：XXX论文"）
- **AND** 可点击展开详细表单

### Requirement: AI 自动识别元数据

系统应使用大模型从文献内容中自动提取元数据：

#### Scenario: 从文本内容提取元数据

- **WHEN** 用户输入文本内容并点击"识别来源"
- **THEN** 系统使用 AI 分析文本
- **AND** 自动提取以下信息：
  - 文献标题
  - 作者列表
  - 发表年份
  - 期刊/会议名称
  - DOI（如有）
  - 关键词
  - 摘要（可选）
- **AND** 自动填充到来源表单
- **AND** 用户可编辑修改

#### Scenario: 从 URL 页面提取元数据

- **WHEN** 用户输入 URL 并点击"识别来源"
- **THEN** 系统抓取网页内容
- **AND** 尝试识别 Open Graph、Schema.org 等元数据
- **AND** 使用 AI 补充缺失信息
- **AND** 自动填充来源表单

#### Scenario: 从 PDF 文件提取元数据

- **WHEN** 用户上传 PDF 文件
- **THEN** 系统解析 PDF 元数据（标题、作者等）
- **AND** 提取首页内容进行 AI 分析
- **AND** 自动填充来源表单

#### Scenario: 文献类型自动识别

- **WHEN** AI 分析文献内容
- **THEN** 系统自动判断文献类型：
  - 学术论文（paper）：包含摘要、参考文献
  - 书籍章节（book）：包含章节结构
  - 技术文章（article）：博客、教程等
  - 技术报告（report）：技术文档
  - 网页内容（webpage）：新闻、资讯等

### Requirement: 来源信息存储与关联

系统应将文献来源信息与知识图谱关联：

#### Scenario: 保存到图谱参考资料

- **WHEN** 用户确认提取结果
- **THEN** 系统将文献信息添加到图谱的 `reference_books` 字段
- **AND** 包含完整的元数据信息
- **AND** 记录处理时间

#### Scenario: 节点来源追溯

- **WHEN** 概念被添加到图谱
- **THEN** 节点的 `properties.sources` 包含文献来源信息
- **AND** 支持多个来源的累积

#### Scenario: 参考资料列表显示

- **WHEN** 用户查看图谱详情
- **THEN** 显示"参考资料"列表
- **AND** 按添加时间排序
- **AND** 显示文献类型图标
- **AND** 支持点击跳转（如有 URL/DOI）

### Requirement: 来源信息预览

系统应在提取结果预览中显示来源信息：

#### Scenario: 概念来源标注

- **WHEN** 显示提取的概念列表
- **THEN** 每个概念显示来源文献标题
- **AND** 悬停显示完整来源信息

#### Scenario: 来源信息卡片

- **WHEN** 提取完成
- **THEN** 显示来源信息卡片：
  - 文献标题
  - 作者
  - 年份
  - 类型标签
  - 来源链接（如有）

## MODIFIED Requirements

### Requirement: LiteratureInfo 类型扩展

现有 LiteratureInfo 类型需要扩展：

```typescript
export interface LiteratureInfo {
  title: string;
  authors?: string[];
  year?: number;
  url?: string;
  fileName?: string;
  type: "paper" | "book" | "article" | "report" | "webpage" | "document";
  processedAt: string;
  // 新增字段
  journal?: string;           // 期刊/会议名称
  doi?: string;               // DOI
  keywords?: string[];        // 关键词
  abstract?: string;          // 摘要
  volume?: string;            // 卷号
  issue?: string;             // 期号
  pages?: string;             // 页码
  publisher?: string;         // 出版社
  notes?: string;             // 备注
}
```

### Requirement: ReferenceBook 类型扩展

现有 ReferenceBook 类型需要扩展以支持更多元数据：

```typescript
export interface ReferenceBook {
  title: string;
  author: string;
  isbn?: string;
  description?: string;
  url?: string;
  type: "paper" | "book" | "article" | "report" | "webpage" | "document";
  // 新增字段
  year?: number;
  journal?: string;
  doi?: string;
  processedAt?: string;       // 处理时间
  conceptCount?: number;      // 提取的概念数量
}
```

## Technical Design

### API 设计

#### POST /api/literature/metadata

请求：

```typescript
{
  content?: string;           // 文本内容
  url?: string;               // URL
  file?: File;                // 上传的文件
}
```

响应：

```typescript
{
  metadata: {
    title?: string;
    authors?: string[];
    year?: number;
    type: LiteratureType;
    journal?: string;
    doi?: string;
    keywords?: string[];
    abstract?: string;
  };
  confidence: number;         // 识别置信度
}
```

#### POST /api/literature/extract（增强）

请求增加来源信息：

```typescript
{
  content?: string;
  file?: File;
  url?: string;
  graph_id: string;
  // 新增：来源信息
  literature?: {
    title: string;
    authors?: string[];
    year?: number;
    type: LiteratureType;
    journal?: string;
    doi?: string;
    notes?: string;
  };
  options?: {
    extractTypes?: ConceptType[];
    maxConcepts?: number;
    similarityThreshold?: number;
    autoDetectMetadata?: boolean;  // 是否自动识别元数据
  };
}
```

### 组件设计

#### LiteratureMetadataForm（新组件）

来源信息表单组件：

- 可折叠的来源信息区域
- 各字段的输入控件
- "自动识别"按钮
- 识别结果预览和编辑

#### LiteratureMetadataCard（新组件）

来源信息卡片组件：

- 显示已识别的元数据
- 文献类型图标
- 编辑/删除操作

### 数据流

```
用户输入内容 → 选择是否自动识别 → AI 提取元数据 → 用户确认/编辑 → 提交提取请求 → 概念提取 + 来源关联 → 保存到图谱
```

## UI 设计要点

### 来源信息区域布局

```
┌─────────────────────────────────────────────────────┐
│ 📄 来源信息（可选）                          [展开 ▼] │
├─────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────┐ │
│ │ 标题: [________________________] [自动识别 ✨]  │ │
│ │ 作者: [________________________]                │ │
│ │ 年份: [____] 类型: [论文 ▼]                     │ │
│ │ 期刊: [________________________]                │ │
│ │ DOI:  [________________________]                │ │
│ │ 备注: [________________________]                │ │
│ └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

### 提取结果中的来源显示

```
┌─────────────────────────────────────────────────────┐
│ 📚 来源: 知识图谱构建方法综述                        │
│    张三, 李四 | 2024 | 计算机学报                   │
│    [论文] [DOI: 10.xxx/xxx]                         │
└─────────────────────────────────────────────────────┘
```
