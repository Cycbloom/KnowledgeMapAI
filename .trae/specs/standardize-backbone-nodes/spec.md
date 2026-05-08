# 专题研究骨干节点标准化 Spec

## Why

在专题研究图谱中，六个骨干节点（研究背景、文献综述、研究方法、核心概念、应用领域、未来方向）是图谱的核心结构。目前存在以下问题：

1. AI 生成的骨干节点标题可能存在微小差异，导致结构不统一
2. 骨干节点缺乏特殊标识，难以与普通概念节点区分
3. 用户可能误修改骨干节点标题，破坏图谱结构一致性

需要一个标准化机制来确保骨干节点的一致性和可识别性。

## What Changes

- 新增骨干节点枚举类型 `BackboneModule`，包含六个固定值
- 扩展节点属性，添加 `backboneModule` 字段标识骨干节点类型
- 增强 AI 生成 prompt，强制使用标准化标题
- 新增后端验证机制，确保骨干节点标题符合标准
- 新增前端专属图标显示，区分骨干节点与普通节点
- 禁止用户修改骨干节点标题
- 更新现有专题研究图谱初始化逻辑，应用标准化机制

## Impact

- Affected specs: `enhance-topic-research`
- Affected code:
  - `shared/types/graph.ts` - 新增 BackboneModule 枚举类型
  - `api/services/ai/backboneNetworkService.ts` - 增强 prompt 和验证逻辑
  - `api/services/ai/templateGeneratorService.ts` - 更新模板生成逻辑
  - `src/components/GraphEditor/NodeRenderer.tsx` - 添加骨干节点图标渲染
  - `src/components/GraphEditor/NodeEditPanel.tsx` - 禁止编辑骨干节点标题
  - `supabase/migrations/` - 更新节点属性验证约束

## ADDED Requirements

### Requirement: 骨干节点类型定义

系统应定义标准的骨干节点类型：

#### Scenario: 定义枚举类型

- **WHEN** 系统初始化时
- **THEN** 定义 `BackboneModule` 枚举类型，包含以下值：
  - `research_background` - 研究背景
  - `literature_review` - 文献综述
  - `research_methods` - 研究方法
  - `core_concepts` - 核心概念
  - `application_domains` - 应用领域
  - `future_directions` - 未来方向

#### Scenario: 标准标题映射

- **WHEN** 需要显示或验证骨干节点标题时
- **THEN** 系统使用以下标准标题映射：
  ```typescript
  const BACKBONE_MODULE_TITLES: Record<BackboneModule, string> = {
    research_background: '研究背景',
    literature_review: '文献综述',
    research_methods: '研究方法',
    core_concepts: '核心概念',
    application_domains: '应用领域',
    future_directions: '未来方向',
  };
  ```

### Requirement: 节点属性扩展

系统应扩展节点属性以支持骨干节点标识：

#### Scenario: 添加 backboneModule 属性

- **WHEN** 创建骨干节点时
- **THEN** 节点的 `properties` 字段包含 `backboneModule` 属性
- **AND** 属性值为 `BackboneModule` 枚举类型之一
- **AND** 属性值与节点标题对应

#### Scenario: 属性验证

- **WHEN** 保存节点数据时
- **THEN** 系统验证 `backboneModule` 属性值是否为有效枚举值
- **AND** 如果值无效，拒绝保存并返回错误

### Requirement: AI 生成标题标准化

系统应确保 AI 生成的骨干节点标题完全标准化：

#### Scenario: Prompt 明确要求

- **WHEN** AI 生成专题研究图谱骨干网络时
- **THEN** prompt 中明确要求使用以下固定标题：
  - "研究背景"（不是"背景介绍"、"研究背景与发展"等变体）
  - "文献综述"（不是"文献回顾"、"文献综述与现状"等变体）
  - "研究方法"（不是"方法论"、"研究方法与途径"等变体）
  - "核心概念"（不是"核心概念与定义"、"关键概念"等变体）
  - "应用领域"（不是"应用场景"、"实际应用"等变体）
  - "未来方向"（不是"未来展望"、"发展趋势"等变体）

#### Scenario: 后端验证机制

- **WHEN** AI 返回生成的骨干节点数据时
- **THEN** 系统验证每个骨干节点的标题是否符合标准
- **AND** 如果标题不符合标准，自动替换为标准标题
- **AND** 记录替换日志用于监控 AI 生成质量

#### Scenario: 验证失败处理

- **WHEN** 骨干节点标题验证失败且无法自动修正时
- **THEN** 系统拒绝创建该节点
- **AND** 返回错误信息："骨干节点标题不符合标准格式"
- **AND** 建议用户重新生成

### Requirement: 骨干节点视觉标识

系统应为骨干节点提供专属视觉标识：

#### Scenario: 专属图标显示

- **WHEN** 渲染骨干节点时
- **THEN** 系统根据 `backboneModule` 属性显示对应的专属图标：
  - `research_background` - 📚 书本图标
  - `literature_review` - 📄 文档图标
  - `research_methods` - 🔬 显微镜图标
  - `core_concepts` - 💡 灯泡图标
  - `application_domains` - 🎯 靶心图标
  - `future_directions` - 🚀 火箭图标

#### Scenario: 图标位置

- **WHEN** 显示骨干节点图标时
- **THEN** 图标显示在节点标题左侧
- **AND** 图标大小与节点大小成比例
- **AND** 图标颜色与节点主题色一致

### Requirement: 标题修改限制

系统应禁止用户修改骨干节点标题：

#### Scenario: 编辑面板限制

- **WHEN** 用户打开骨干节点的编辑面板时
- **THEN** 标题输入框显示为只读状态
- **AND** 显示提示信息："骨干节点标题不可修改"
- **AND** 其他属性（描述、标签等）仍可编辑

#### Scenario: API 层验证

- **WHEN** 用户通过 API 尝试修改骨干节点标题时
- **THEN** 系统检测到节点包含 `backboneModule` 属性
- **AND** 拒绝标题修改请求
- **AND** 返回错误："骨干节点标题不可修改"

#### Scenario: 批量操作保护

- **WHEN** 用户执行批量节点更新操作时
- **THEN** 系统过滤掉包含 `backboneModule` 属性的节点的标题修改
- **AND** 只更新其他允许修改的字段
- **AND** 返回提示："已跳过 X 个骨干节点的标题修改"

### Requirement: 初始化流程更新

系统应更新专题研究图谱初始化流程：

#### Scenario: 应用标准化机制

- **WHEN** 用户创建专题研究图谱时
- **THEN** 系统调用骨干网络生成服务
- **AND** 生成的骨干节点包含 `backboneModule` 属性
- **AND** 骨干节点标题完全符合标准
- **AND** 骨干节点显示专属图标

#### Scenario: 兼容现有图谱

- **WHEN** 用户打开已存在的专题研究图谱时
- **THEN** 系统检测骨干节点是否包含 `backboneModule` 属性
- **AND** 如果缺少属性，自动补充并设置正确的值
- **AND** 如果标题不符合标准，提示用户是否标准化
- **AND** 用户确认后更新标题和属性

## MODIFIED Requirements

### Requirement: 节点类型定义扩展

现有节点类型定义需要扩展以支持骨干节点：

#### Scenario: 扩展 NodeProperties 接口

- **WHEN** 定义节点属性类型时
- **THEN** `NodeProperties` 接口包含可选的 `backboneModule` 字段：
  ```typescript
  interface NodeProperties {
    // ... 现有属性
    backboneModule?: BackboneModule;
  }
  ```

### Requirement: 模板类型信息更新

现有模板类型信息需要更新：

#### Scenario: 更新 topic_research 模板配置

- **WHEN** 定义模板类型信息时
- **THEN** `topic_research` 模板的 `backboneModules` 字段使用 `BackboneModule` 枚举类型
- **AND** 确保类型安全

## Technical Design

### 数据结构

```typescript
// 枚举定义
export enum BackboneModule {
  RESEARCH_BACKGROUND = 'research_background',
  LITERATURE_REVIEW = 'literature_review',
  RESEARCH_METHODS = 'research_methods',
  CORE_CONCEPTS = 'core_concepts',
  APPLICATION_DOMAINS = 'application_domains',
  FUTURE_DIRECTIONS = 'future_directions',
}

// 标题映射
export const BACKBONE_MODULE_TITLES: Record<BackboneModule, string> = {
  [BackboneModule.RESEARCH_BACKGROUND]: '研究背景',
  [BackboneModule.LITERATURE_REVIEW]: '文献综述',
  [BackboneModule.RESEARCH_METHODS]: '研究方法',
  [BackboneModule.CORE_CONCEPTS]: '核心概念',
  [BackboneModule.APPLICATION_DOMAINS]: '应用领域',
  [BackboneModule.FUTURE_DIRECTIONS]: '未来方向',
};

// 图标映射
export const BACKBONE_MODULE_ICONS: Record<BackboneModule, string> = {
  [BackboneModule.RESEARCH_BACKGROUND]: '📚',
  [BackboneModule.LITERATURE_REVIEW]: '📄',
  [BackboneModule.RESEARCH_METHODS]: '🔬',
  [BackboneModule.CORE_CONCEPTS]: '💡',
  [BackboneModule.APPLICATION_DOMAINS]: '🎯',
  [BackboneModule.FUTURE_DIRECTIONS]: '🚀',
};
```

### 验证流程

```
AI 生成节点数据 → 提取骨干节点 → 验证标题 → 自动修正 → 设置 backboneModule 属性 → 保存
```

### API 设计

#### POST /api/graphs/{graphId}/nodes/validate-backbone

请求：
```typescript
{
  nodes: Array<{
    id: string;
    title: string;
    properties?: {
      backboneModule?: string;
    };
  }>;
}
```

响应：
```typescript
{
  valid: boolean;
  corrections: Array<{
    nodeId: string;
    originalTitle: string;
    correctedTitle: string;
    backboneModule: BackboneModule;
  }>;
  errors: Array<{
    nodeId: string;
    error: string;
  }>;
}
```

### 组件设计

#### BackboneNodeIcon

骨干节点图标组件：

```typescript
interface BackboneNodeIconProps {
  module: BackboneModule;
  size?: 'small' | 'medium' | 'large';
  className?: string;
}
```

#### NodeTitleEditor

节点标题编辑器组件（增强）：

```typescript
interface NodeTitleEditorProps {
  nodeId: string;
  title: string;
  isBackbone: boolean;
  onTitleChange: (title: string) => void;
}
```
