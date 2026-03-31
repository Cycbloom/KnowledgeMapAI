# 模块化分析提示词调整功能规范

## Why

当前模块化分析面板缺少提示词调整功能，用户无法自定义AI分析所使用的提示词模板。其他功能面板（如学习设置、图谱编辑器）已支持提示词调整，为保持用户体验一致性，需要在模块化分析面板中集成相同的功能。

## What Changes

- 在 `promptScenarios.tsx` 中添加4个分析模块的提示词场景定义
- 在 `ModularAnalysisPanel` 中添加提示词调整入口按钮
- 集成现有的 `PromptEditor` 组件实现提示词编辑
- 实现提示词的实时保存和重置功能
- 保持与现有 `PromptConfigPanel` 一致的UI风格

## Impact

- **Affected specs**: 模块化分析功能
- **Affected code**:
  - `src/components/PromptConfig/promptScenarios.tsx` - 新增分析场景定义
  - `src/components/GraphMap/ModularAnalysisPanel.tsx` - 添加提示词调整入口
  - `src/components/GraphMap/types.ts` - 更新类型定义
  - `src/hooks/useAnalysisModules.ts` - 支持自定义提示词

---

## ADDED Requirements

### Requirement: 分析模块提示词场景定义

系统 SHALL 为4个分析模块定义提示词场景，支持用户自定义。

#### 场景定义

| 场景ID | 名称 | 描述 | 变量 |
|--------|------|------|------|
| `relation_discovery` | 关系发现 | 发现图谱间潜在关联关系的提示词 | graphs, existing_relations, concepts |
| `cross_domain_insights` | 跨学科洞察 | 分析跨领域知识交叉点的提示词 | graphs, domains, concepts |
| `learning_path_suggestions` | 学习路径建议 | 推荐最优学习顺序的提示词 | graphs, relations, difficulty |
| `knowledge_gaps` | 知识缺口分析 | 识别知识体系空白的提示词 | graphs, concepts, relations |

#### Scenario: 提示词场景加载
- **WHEN** 用户打开模块化分析面板
- **THEN** 系统加载各模块对应的提示词模板
- **AND** 显示当前生效的模板级别（系统级/用户级/图谱级）

---

### Requirement: 模块化分析面板提示词入口

系统 SHALL 在模块化分析面板中提供提示词调整入口。

#### Scenario: 打开提示词编辑
- **WHEN** 用户点击分析模块卡片上的"编辑提示词"按钮
- **THEN** 系统打开提示词编辑器
- **AND** 显示当前模块的提示词内容
- **AND** 显示可用变量列表

#### Scenario: 提示词编辑界面
- **WHEN** 提示词编辑器打开
- **THEN** 显示与 `PromptConfigPanel` 一致的编辑界面
- **AND** 支持变量插入功能
- **AND** 支持AI智能优化功能
- **AND** 显示保存和取消按钮

---

### Requirement: 提示词实时保存

系统 SHALL 实现提示词的实时保存功能。

#### Scenario: 保存提示词
- **WHEN** 用户修改提示词后点击"保存"
- **THEN** 系统保存提示词到用户级或图谱级
- **AND** 显示保存成功提示
- **AND** 下次分析时使用新的提示词

#### Scenario: 自动应用
- **WHEN** 提示词保存成功
- **THEN** 无需刷新页面
- **AND** 下次执行分析时自动使用新提示词

---

### Requirement: 提示词重置功能

系统 SHALL 提供提示词重置功能。

#### Scenario: 重置为默认
- **WHEN** 用户点击"重置为默认"按钮
- **THEN** 系统删除用户自定义的提示词
- **AND** 恢复使用系统默认提示词
- **AND** 显示重置成功提示

---

## MODIFIED Requirements

### Requirement: ModularAnalysisPanel 组件更新

原有的 `ModularAnalysisPanel` 组件 SHALL 添加提示词调整功能。

**修改前**:
- 仅显示模块选择和执行功能
- 无提示词调整入口

**修改后**:
- 每个模块卡片显示"编辑提示词"按钮
- 点击按钮打开提示词编辑器
- 支持实时保存和重置

### Requirement: AnalysisModuleCard 组件更新

原有的 `AnalysisModuleCard` 组件 SHALL 添加提示词编辑入口。

**修改前**:
- 显示模块名称、描述、状态
- 支持勾选和查看结果

**修改后**:
- 添加"编辑提示词"图标按钮
- 点击后触发 `onEditPrompt` 回调

---

## 技术实现要点

### 提示词场景定义

```typescript
// promptScenarios.tsx 新增场景
{
  id: 'relation_discovery',
  name: '关系发现分析',
  description: '发现图谱间潜在关联关系的AI提示词',
  icon: <Network size={20} />,
  variables: ['graphs', 'existing_relations', 'concepts'],
  defaultTemplate: `分析以下知识图谱，发现它们之间潜在的关联关系...`,
  category: 'analysis',
  supportsThreeTier: true,
},
// ... 其他3个场景
```

### 组件集成

```typescript
// ModularAnalysisPanel.tsx
import { PromptEditor } from '../GraphEditor/panels/PromptEditor';

// 状态管理
const [editingPromptModule, setEditingPromptModule] = useState<AnalysisModuleId | null>(null);

// 渲染提示词编辑器
{editingPromptModule && (
  <PromptEditor
    initialContent={getPromptContent(editingPromptModule)}
    variables={getPromptVariables(editingPromptModule)}
    onSave={(content) => handleSavePrompt(editingPromptModule, content)}
    onCancel={() => setEditingPromptModule(null)}
    title={`${getModuleName(editingPromptModule)} - 提示词编辑`}
  />
)}
```

### API 调用

复用现有的 `api.prompts.save` 和 `api.prompts.reset` 接口：
```typescript
// 保存提示词
await api.prompts.save({
  code: 'relation_discovery',
  scope: 'user', // 或 'graph'
  template_content: content,
});

// 重置提示词
await api.prompts.reset(templateId);
```
