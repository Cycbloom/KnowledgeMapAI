# 前端组件状态优化规范

## Why
TaskTemplates.tsx 组件包含过多本地状态（15+ useState），导致组件臃肿、难以维护和测试。通过抽取自定义 hook 和使用 useReducer，可以显著提升代码可读性、可测试性和可维护性。

## What Changes
- 创建 `useTemplateForm` hook 抽取表单状态和逻辑
- 创建 `useTemplateList` hook 抽取列表状态和逻辑
- 创建 `useTemplateModals` hook 抽取模态框状态
- 重构 TaskTemplates.tsx 组件使用新的 hooks
- 添加单元测试覆盖新 hooks

## Impact
- Affected specs: 前端组件架构
- Affected code: 
  - `src/components/Templates/TaskTemplates.tsx`
  - 新增 `src/hooks/templates/useTemplateForm.ts`
  - 新增 `src/hooks/templates/useTemplateList.ts`
  - 新增 `src/hooks/templates/useTemplateModals.ts`

## ADDED Requirements

### Requirement: 模板表单状态管理 Hook
系统 SHALL 提供 `useTemplateForm` hook 用于管理模板表单状态。

#### Scenario: 初始化表单
- **WHEN** 调用 useTemplateForm()
- **THEN** 返回默认的表单数据和操作方法

#### Scenario: 更新表单字段
- **WHEN** 调用 updateField('name', '新模板')
- **THEN** formData.name 更新为 '新模板'

#### Scenario: 重置表单
- **WHEN** 调用 resetForm()
- **THEN** 所有表单字段恢复为默认值

#### Scenario: 设置编辑数据
- **WHEN** 调用 setFormDataForEdit(template)
- **THEN** 表单数据填充为模板数据

### Requirement: 模板列表状态管理 Hook
系统 SHALL 提供 `useTemplateList` hook 用于管理模板列表状态。

#### Scenario: 加载模板列表
- **WHEN** 组件挂载时
- **THEN** 自动调用 API 加载模板列表

#### Scenario: 搜索过滤
- **WHEN** 设置 searchQuery 为 "学习"
- **THEN** filteredTemplates 只包含匹配的模板

#### Scenario: 分类过滤
- **WHEN** 设置 selectedCategory 为 "study"
- **THEN** filteredTemplates 只包含学习类模板

### Requirement: 模板模态框状态管理 Hook
系统 SHALL 提供 `useTemplateModals` hook 用于管理模态框状态。

#### Scenario: 打开创建模态框
- **WHEN** 调用 openCreateModal()
- **THEN** isCreating 设为 true，表单重置

#### Scenario: 打开编辑模态框
- **WHEN** 调用 openEditModal(template)
- **THEN** isEditing 设为 true，表单填充模板数据

#### Scenario: 打开应用模态框
- **WHEN** 调用 openApplyModal(template)
- **THEN** isApplying 设为 true，placeholderValues 初始化

#### Scenario: 关闭所有模态框
- **WHEN** 调用 closeAllModals()
- **THEN** 所有模态框状态设为 false

### Requirement: 重构后的 TaskTemplates 组件
系统 SHALL 提供重构后的 TaskTemplates 组件，使用新的 hooks 管理状态。

#### Scenario: 组件渲染
- **WHEN** 渲染 TaskTemplates 组件
- **THEN** 正确显示模板列表和所有交互功能

#### Scenario: 功能完整性
- **WHEN** 用户进行任何模板操作（创建、编辑、删除、应用）
- **THEN** 功能与重构前完全一致
