# 增强只读模式 UI 支持 Spec

## Why
当前公开图谱的只读模式仅实现了基本的访问控制，但 UI 上仍有编辑相关的按钮和功能，用户体验不一致。需要在侧边栏、大纲模式等组件中全面支持只读模式，隐藏或禁用编辑功能。

## What Changes
- NodeDetailSidebar 组件添加 `isReadOnly` 属性，隐藏编辑相关按钮
- GraphOutline 组件添加 `isReadOnly` 属性，禁用添加、删除、批量操作等功能
- NodeEditSidebar 在只读模式下不显示或显示只读提示
- 统一传递 `isReadOnly` 属性到所有相关子组件

## Impact
- Affected specs: 图谱协作功能、公开图谱访问
- Affected code:
  - `src/components/GraphEditor/sidebar/NodeDetailSidebar.tsx`
  - `src/components/GraphEditor/sidebar/NodeEditSidebar.tsx`
  - `src/components/GraphEditor/panels/GraphOutline.tsx`
  - `src/pages/GraphEditor.tsx`

## ADDED Requirements

### Requirement: NodeDetailSidebar 只读模式
系统 SHALL 在只读模式下隐藏或禁用节点详情侧边栏中的编辑功能。

#### Scenario: 只读模式下查看节点详情
- **WHEN** 用户以只读模式查看节点详情
- **THEN** 系统应隐藏以下按钮：
  - "编辑"按钮
  - "删除"按钮
  - "生成描述"按钮（Wand2 图标）
  - "深度分析"按钮
  - "生成测验"按钮
  - "后台生成"按钮
  - "开始学习"按钮
  - "开始测试"按钮
  - "生成卡片"按钮

#### Scenario: 只读模式下显示提示
- **WHEN** 用户以只读模式查看节点详情
- **THEN** 系统应在侧边栏顶部显示"只读模式"提示

### Requirement: GraphOutline 只读模式
系统 SHALL 在只读模式下禁用大纲面板中的编辑功能。

#### Scenario: 只读模式下查看大纲
- **WHEN** 用户以只读模式查看大纲
- **THEN** 系统应：
  - 隐藏"添加节点"按钮
  - 隐藏"批量删除"按钮
  - 隐藏"批量生成"按钮
  - 禁用多选模式
  - 隐藏连接发现功能
  - 禁用节点的删除操作

#### Scenario: 只读模式下大纲节点操作
- **WHEN** 用户以只读模式点击大纲中的节点
- **THEN** 系统应只允许查看节点详情，不允许编辑

### Requirement: NodeEditSidebar 只读模式
系统 SHALL 在只读模式下不显示节点编辑侧边栏。

#### Scenario: 只读模式下尝试编辑节点
- **WHEN** 用户以只读模式点击节点
- **THEN** 系统应直接显示节点详情视图，不显示编辑表单

### Requirement: GraphEditor 只读状态传递
系统 SHALL 将只读状态正确传递到所有子组件。

#### Scenario: 只读状态传递
- **WHEN** GraphEditor 检测到用户未登录或无编辑权限
- **THEN** 系统应将 `isReadOnly=true` 传递到：
  - GraphToolbar
  - NodeDetailSidebar
  - GraphOutline
  - 其他需要此状态的组件

## MODIFIED Requirements

### Requirement: GraphEditor 组件
原有的 GraphEditor 组件 SHALL 添加以下功能：
1. 检测用户登录状态和图谱访问权限
2. 计算 `isReadOnly` 状态（未登录或非 owner/collaborator）
3. 将 `isReadOnly` 状态传递到所有子组件

## REMOVED Requirements
无移除的需求。
