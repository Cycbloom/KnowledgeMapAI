# AI 图谱模板生成功能 Spec

## Why

当前知识图谱模板需要用户手动创建节点和边结构，使用门槛高且效率低。用户希望 AI 能够根据主题自动生成多种图谱模板方案，用户只需选择合适的模板，再结合风格设置即可快速生成高质量的知识图谱。

## 需求分析总结

### 核心需求

1. **生成方式**：AI 自动生成多个方案供选择（默认 3 个）
2. **模板内容**：
   - 节点层级结构（root、core、sub、normal、leaf）
   - 节点之间的边关系
   - 每个节点的建议内容描述
   - 布局建议（放射状、树形、网状等）
3. **应用流程**：选择模板 → 选择风格 → AI 生成内容
4. **模板分类**：学习型、项目型、故事型、分析型

### 详细需求

1. **模板数量**：默认生成 3 个方案
2. **节点内容**：包含建议内容描述，AI 生成时参考
3. **模板保存**：支持保存到模板库，方便后续使用
4. **风格影响**：风格只影响内容，不影响结构
5. **模板预览**：简化节点树展示
6. **模板标签**：AI 自动生成标签（如入门友好、结构清晰等）
7. **难度等级**：AI 自动判断（简单、中等、困难）
8. **模板编辑**：支持在 AI 生成的模板基础上修改节点和边

## What Changes

- **新增 AI 模板生成功能**：根据主题自动生成 3 个图谱模板方案
- **模板与风格分离**：模板定义结构，风格决定内容生成方式
- **模板预览功能**：简化节点树展示模板结构
- **模板管理增强**：支持 AI 生成模板的保存、编辑、分类、搜索
- **AI 自动标签和难度**：AI 自动生成标签和判断难度等级

## Impact

- Affected specs: 图谱创建流程、模板管理系统
- Affected code:
  - `api/routes/autoGraph.ts` - 新增模板生成 API
  - `api/services/graph/graphTemplateService.ts` - 模板服务扩展
  - `src/components/AutoGraph/AutoGraphGenerator.tsx` - UI 改造
  - `src/components/Templates/` - 模板管理组件
  - `supabase/migrations/00000000000000_initial_schema.sql` - 数据库扩展

## ADDED Requirements

### Requirement: AI 模板生成

系统 SHALL 提供 AI 模板生成功能，根据用户输入的主题自动生成 3 个图谱模板方案。

#### Scenario: 成功生成模板

- **WHEN** 用户输入主题（如"机器学习基础"）并点击"生成模板"
- **THEN** 系统调用 AI 生成 3 个不同结构的模板方案
- **AND** 每个模板包含节点层级结构、边关系、建议内容、布局建议
- **AND** 每个模板有名称、描述、AI 自动生成的标签、AI 自动判断的难度

#### Scenario: 模板包含完整结构

- **WHEN** AI 生成模板成功
- **THEN** 模板包含以下信息：
  - 根节点定义
  - 核心节点列表（3-7个）
  - 节点层级关系（root、core、sub、normal、leaf）
  - 边关系定义
  - 每个节点的建议内容描述
  - 布局建议（放射状、树形、网状、层级等）
  - AI 自动生成的标签（如入门友好、结构清晰等）
  - AI 自动判断的难度（简单、中等、困难）
  - 模板分类（学习型、项目型、故事型、分析型）

### Requirement: 模板选择与风格配置

系统 SHALL 允许用户选择模板后配置生成风格。

#### Scenario: 选择模板并配置风格

- **WHEN** 用户选择一个模板方案
- **THEN** 系统显示简化节点树预览
- **AND** 系统显示风格选择界面（学术、实用、入门、自定义）
- **AND** 用户可以选择不同的风格
- **AND** 风格只影响内容生成，不影响模板结构

#### Scenario: 应用模板生成图谱

- **WHEN** 用户确认模板和风格设置
- **THEN** 系统基于模板结构，使用选定风格生成图谱内容
- **AND** 生成的节点内容符合所选风格
- **AND** 节点结构遵循模板定义
- **AND** 节点内容参考模板中的建议内容描述

### Requirement: 模板编辑

系统 SHALL 支持用户编辑 AI 生成的模板。

#### Scenario: 编辑模板节点

- **WHEN** 用户查看 AI 生成的模板
- **THEN** 用户可以：
  - 修改节点标题
  - 修改节点建议内容描述
  - 修改节点层级
  - 添加新节点
  - 删除节点
  - 修改边关系

#### Scenario: 保存编辑后的模板

- **WHEN** 用户编辑模板后点击保存
- **THEN** 系统保存编辑后的模板到个人模板库
- **AND** 用户可以设置模板名称、描述、分类

### Requirement: 模板保存与管理

系统 SHALL 支持保存 AI 生成的模板供后续使用。

#### Scenario: 保存模板

- **WHEN** 用户对 AI 生成的模板满意
- **THEN** 用户可以将模板保存到个人模板库
- **AND** 可以设置模板名称、描述
- **AND** AI 自动生成的标签和难度等级已保存
- **AND** 模板分类已保存

#### Scenario: 模板分类

- **WHEN** 保存模板时
- **THEN** 系统提供以下分类选项：
  - 学习型（learning）：适用于知识学习
  - 项目型（project）：适用于项目管理
  - 故事型（story）：适用于叙事内容
  - 分析型（analysis）：适用于问题分析

### Requirement: 模板预览

系统 SHALL 提供简化节点树预览功能。

#### Scenario: 预览模板结构

- **WHEN** 用户查看模板详情
- **THEN** 系统以简化节点树方式展示模板结构
- **AND** 显示节点层级关系（缩进表示）
- **AND** 显示边的连接关系
- **AND** 显示每个节点的建议内容描述
- **AND** 显示布局建议、标签、难度等级

## MODIFIED Requirements

### Requirement: 图谱创建流程优化

原有的图谱创建流程 SHALL 支持模板选择。

#### Scenario: 创建图谱时选择模板

- **WHEN** 用户创建新图谱
- **THEN** 用户可以选择：
  - 从空白开始（原有流程）
  - 从现有模板开始（模板库）
  - AI 生成模板（新功能）
- **AND** 选择模板后可以配置风格

### Requirement: AutoGraphGenerator 组件改造

AutoGraphGenerator 组件 SHALL 支持模板生成模式。

#### Scenario: 模板生成模式

- **WHEN** 用户选择"AI 生成模板"模式
- **THEN** 组件显示：
  - 主题输入框
  - 模板生成按钮
  - 生成的模板方案列表
  - 模板选择和风格配置

## Technical Design

### 数据库迁移方案

**重要说明**：本项目使用云端 Supabase 数据库，需要提供迁移 SQL 供用户在 Supabase Dashboard 执行。

#### 步骤 1：在 Supabase Dashboard 执行删除并重建表

在 Supabase Dashboard 的 SQL Editor 中执行以下 SQL：

```sql
-- 删除现有的 templates 表
DROP TABLE IF EXISTS templates CASCADE;

-- 重新创建 templates 表（新结构）
CREATE TABLE templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(20) NOT NULL DEFAULT 'custom' CHECK (category IN ('learning', 'story', 'project', 'analysis', 'custom')),
  is_system BOOLEAN DEFAULT false,
  nodes JSONB NOT NULL DEFAULT '[]',
  edges JSONB DEFAULT '[]',
  layout JSONB,
  generation_config JSONB,
  preview_data JSONB,
  tags TEXT[] DEFAULT '{}',
  difficulty VARCHAR(20) DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
  estimated_nodes INTEGER DEFAULT 10,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 添加注释
COMMENT ON TABLE templates IS 'Graph templates for knowledge graph structure';
COMMENT ON COLUMN templates.generation_config IS 'AI generation config: style, depth, etc.';
COMMENT ON COLUMN templates.preview_data IS 'Preview visualization data';
COMMENT ON COLUMN templates.tags IS 'Template tags for search';
COMMENT ON COLUMN templates.difficulty IS 'Template difficulty: easy, medium, hard';
COMMENT ON COLUMN templates.estimated_nodes IS 'Estimated number of nodes';

-- 创建索引
CREATE INDEX idx_templates_category ON templates(category);
CREATE INDEX idx_templates_is_system ON templates(is_system);
CREATE INDEX idx_templates_user_id ON templates(user_id);
CREATE INDEX idx_templates_tags ON templates USING GIN(tags);

-- 启用 RLS
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;

-- RLS 策略：用户可以查看自己的模板和系统模板
CREATE POLICY "Users can view own and system templates"
  ON templates FOR SELECT
  USING (auth.uid() = user_id OR is_system = true);

-- RLS 策略：用户可以创建自己的模板
CREATE POLICY "Users can create own templates"
  ON templates FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS 策略：用户可以更新自己的模板
CREATE POLICY "Users can update own templates"
  ON templates FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS 策略：用户可以删除自己的模板
CREATE POLICY "Users can delete own templates"
  ON templates FOR DELETE
  USING (auth.uid() = user_id AND is_system = false);

-- 插入系统预设模板
INSERT INTO templates (user_id, name, description, category, is_system, nodes, edges, tags, difficulty, estimated_nodes) VALUES
  (NULL, '概念学习框架', '适用于学习新概念，从定义到应用的完整学习路径', 'learning', true, 
   '[{"id":"node-1","title":"主题","level":"root","description":"核心主题"},{"id":"node-2","title":"定义","level":"core","description":"概念的定义和基本解释"},{"id":"node-3","title":"特点","level":"core","description":"主要特点和属性"},{"id":"node-4","title":"应用","level":"sub","description":"实际应用场景"}]'::jsonb,
   '[{"source":"node-1","target":"node-2"},{"source":"node-1","target":"node-3"},{"source":"node-1","target":"node-4"}]'::jsonb,
   ARRAY['入门友好', '结构清晰'],
   'easy',
   10
  ),
  (NULL, '项目规划模板', '适用于项目管理和任务分解', 'project', true,
   '[{"id":"node-1","title":"项目目标","level":"root"},{"id":"node-2","title":"阶段一","level":"core"},{"id":"node-3","title":"阶段二","level":"core"},{"id":"node-4","title":"阶段三","level":"core"}]'::jsonb,
   '[{"source":"node-1","target":"node-2"},{"source":"node-1","target":"node-3"},{"source":"node-1","target":"node-4"}]'::jsonb,
   ARRAY['项目管理', '任务分解'],
   'medium',
   15
  ),
  (NULL, '知识树模板', '适用于构建知识体系，从基础到进阶', 'learning', true,
   '[{"id":"node-1","title":"知识领域","level":"root"},{"id":"node-2","title":"基础知识","level":"core"},{"id":"node-3","title":"核心概念","level":"core"},{"id":"node-4","title":"进阶内容","level":"sub"}]'::jsonb,
   '[{"source":"node-1","target":"node-2"},{"source":"node-1","target":"node-3"},{"source":"node-2","target":"node-4"},{"source":"node-3","target":"node-4"}]'::jsonb,
   ARRAY['系统学习', '循序渐进'],
   'medium',
   20
  );
```

#### 步骤 2：更新本地迁移文件

需要同步更新以下文件，以便本地开发和版本控制：

**文件 1：`supabase/migrations/00000000000000_initial_schema.sql`**

找到 `CREATE TABLE IF NOT EXISTS templates` 部分，替换为新的表结构（同上）。

**文件 2：`supabase/migrations/00000000000001_initial_seed.sql`**

找到 `INSERT INTO templates` 部分，替换为新的种子数据（同上）。

### 数据库字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| generation_config | JSONB | AI 生成配置，包含风格、深度等参数 |
| preview_data | JSONB | 预览可视化数据，用于前端快速渲染 |
| tags | TEXT[] | 模板标签，用于搜索和分类 |
| difficulty | VARCHAR(20) | 难度等级：easy, medium, hard |
| estimated_nodes | INTEGER | 预计节点数量 |

### API 设计

#### POST /auto-graph/generate-templates

请求：
```typescript
{
  topic: string;
  category?: 'learning' | 'project' | 'story' | 'analysis';
}
```

响应：
```typescript
{
  templates: Array<{
    id: string; // 临时 ID
    name: string;
    description: string;
    category: 'learning' | 'project' | 'story' | 'analysis';
    tags: string[]; // AI 自动生成的标签
    difficulty: 'easy' | 'medium' | 'hard'; // AI 自动判断的难度
    estimated_nodes: number;
    nodes: Array<{
      id: string;
      title: string;
      level: 'root' | 'core' | 'sub' | 'normal' | 'leaf';
      description?: string; // 建议内容描述
    }>;
    edges: Array<{
      source: string;
      target: string;
      relationship_type?: string;
    }>;
    layout_suggestion: 'radial' | 'tree' | 'network' | 'hierarchical';
  }>;
}
```

#### POST /auto-graph/apply-template

请求：
```typescript
{
  template_id?: string; // 已保存的模板 ID
  template_data?: object; // 或直接传入模板数据（包含编辑后的内容）
  style: 'academic' | 'practical' | 'beginner' | 'custom';
  custom_prompt?: string;
  graph_id?: string; // 可选，添加到现有图谱
}
```

响应：
```typescript
{
  graph_id: string;
  nodes: Array<GraphNode>;
  edges: Array<Edge>;
}
```

#### PUT /templates/:id

请求：
```typescript
{
  name?: string;
  description?: string;
  category?: 'learning' | 'project' | 'story' | 'analysis';
  nodes?: Array<{
    id: string;
    title: string;
    level: 'root' | 'core' | 'sub' | 'normal' | 'leaf';
    description?: string;
  }>;
  edges?: Array<{
    source: string;
    target: string;
    relationship_type?: string;
  }>;
  layout_suggestion?: 'radial' | 'tree' | 'network' | 'hierarchical';
}
```

响应：
```typescript
{
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  difficulty: string;
  nodes: Array<any>;
  edges: Array<any>;
  layout_suggestion: string;
  updated_at: string;
}
```

### 前端组件设计

#### TemplateGenerator 组件

```typescript
interface TemplateGeneratorProps {
  onTemplateSelect: (template: GeneratedTemplate, style: StyleOption) => void;
  onClose?: () => void;
}

// 流程：
// 1. 输入主题
// 2. 生成模板方案
// 3. 选择模板
// 4. 选择风格
// 5. 确认生成
```

#### TemplatePreview 组件

```typescript
interface TemplatePreviewProps {
  template: GeneratedTemplate;
  showActions?: boolean;
  onSelect?: () => void;
  onSave?: () => void;
}

// 显示：
// - 模板名称和描述
// - 节点结构预览（简化视图）
// - 标签和难度
// - 操作按钮
```

## UI/UX 设计

### 模板生成流程

```
┌─────────────────────────────────────────┐
│  AI 图谱模板生成器                        │
├─────────────────────────────────────────┤
│  主题: [机器学习基础____________]         │
│  分类: [学习型 ▼]                        │
│  [✨ 生成模板方案]                        │
├─────────────────────────────────────────┤
│  生成的模板方案 (3)                       │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐    │
│  │ 概念框架 │ │ 学习路径 │ │ 知识树  │    │
│  │ #入门友好│ │ #系统学习│ │ #结构清晰│   │
│  │ 难度:简单│ │ 难度:中等│ │ 难度:中等│   │
│  │ [预览]  │ │ [预览]  │ │ [预览]  │    │
│  │ [选择]  │ │ [选择]  │ │ [选择]  │    │
│  └─────────┘ └─────────┘ └─────────┘    │
└─────────────────────────────────────────┘
```

### 模板预览界面（简化节点树）

```
┌─────────────────────────────────────────┐
│  模板预览: 概念框架                       │
├─────────────────────────────────────────┤
│  描述: 从核心概念出发，逐层展开相关知识点   │
│  标签: #入门友好 #结构清晰                │
│  难度: 简单 | 预计节点: 10-15             │
│  布局建议: 放射状                         │
├─────────────────────────────────────────┤
│  结构预览（简化节点树）:                  │
│                                         │
│  ● 机器学习基础 [root]                   │
│    ├─ ● 定义 [core]                     │
│    │    └─ 什么是机器学习，基本概念...    │
│    ├─ ● 特点 [core]                     │
│    │    └─ 主要特点和属性...             │
│    ├─ ● 类型 [core]                     │
│    │    └─ 监督学习、无监督学习...        │
│    └─ ● 应用 [sub]                      │
│         └─ 实际应用场景...                │
├─────────────────────────────────────────┤
│  [编辑模板] [选择此模板] [保存到模板库]    │
└─────────────────────────────────────────┘
```

### 模板编辑界面

```
┌─────────────────────────────────────────┐
│  编辑模板: 概念框架                       │
├─────────────────────────────────────────┤
│  模板名称: [概念框架__________]           │
│  描述: [从核心概念出发...______]          │
│  分类: [学习型 ▼]                        │
├─────────────────────────────────────────┤
│  节点列表:                               │
│  ┌───────────────────────────────────┐  │
│  │ ● 机器学习基础 [root] [删除]       │  │
│  │   标题: [机器学习基础____]         │  │
│  │   建议内容: [什么是机器学习...__]  │  │
│  ├───────────────────────────────────┤  │
│  │ ● 定义 [core] [删除]               │  │
│  │   标题: [定义______________]       │  │
│  │   建议内容: [概念的定义和...____]  │  │
│  └───────────────────────────────────┘  │
│  [+ 添加节点]                            │
├─────────────────────────────────────────┤
│  边关系:                                 │
│  机器学习基础 → 定义                      │
│  机器学习基础 → 特点                      │
│  [+ 添加边]                              │
├─────────────────────────────────────────┤
│  [取消] [保存修改]                        │
└─────────────────────────────────────────┘
```

### 风格选择界面

```
┌─────────────────────────────────────────┐
│  选择生成风格                             │
├─────────────────────────────────────────┤
│  已选模板: 概念框架                       │
│  风格只影响内容，不影响结构               │
├─────────────────────────────────────────┤
│  选择风格:                               │
│  ○ 学术风格 - 专业术语，理论框架          │
│  ● 实用风格 - 通俗易懂，实际应用          │
│  ○ 入门风格 - 简单易懂，循序渐进          │
│  ○ 自定义风格 - 自己编写生成规则          │
├─────────────────────────────────────────┤
│  [返回] [生成图谱]                        │
└─────────────────────────────────────────┘
```
