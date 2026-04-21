# 组件主题色统一迁移 Spec

## Why
当前主题预设系统已建立（7 个主题配色方案），但 100 个组件文件中仅 1 个使用了主题感知的 `primary-*` 颜色类，其余 99 个全部硬编码 `blue-*` 颜色。导致用户切换主题后，大部分 UI 元素仍然显示蓝色，无法跟随主题变化，视觉体验不一致。

## What Changes
- 将所有组件中硬编码的 `blue-*` Tailwind 颜色类替换为主题感知的 `primary-*` 类
- 涉及约 100 个组件文件，共约 1183 处 `blue-*` 类需要迁移
- 确保亮色和暗色模式下颜色表现一致

## Impact
- Affected specs: 主题系统（expand-theme-system）
- Affected code: 约 100 个组件文件，主要集中在：
  - `src/pages/` — 页面组件（Dashboard、Templates、LearningPaths 等）
  - `src/components/` — UI 组件（GraphEditor、Scheduler、Templates 等）

## ADDED Requirements

### Requirement: 组件主题色统一迁移
系统 SHALL 将所有组件中硬编码的 `blue-*` 颜色类替换为主题感知的 `primary-*` 类，使 UI 元素随主题切换而变化。

#### 迁移映射规则

| 硬编码类 | 替换为 |
|----------|--------|
| `bg-blue-600` | `bg-primary-600` |
| `bg-blue-500` | `bg-primary-500` |
| `bg-blue-50` | `bg-primary-50` |
| `bg-blue-100` | `bg-primary-100` |
| `bg-blue-900/20` | `bg-primary-900/20` |
| `bg-blue-900/30` | `bg-primary-900/30` |
| `text-blue-600` | `text-primary-600` |
| `text-blue-500` | `text-primary-500` |
| `text-blue-400` | `text-primary-400` |
| `text-blue-700` | `text-primary-700` |
| `text-blue-300` | `text-primary-300` |
| `border-blue-500` | `border-primary-500` |
| `border-blue-200` | `border-primary-200` |
| `ring-blue-500` | `ring-primary-500` |
| `hover:bg-blue-700` | `hover:bg-primary-700` |
| `hover:bg-blue-600` | `hover:bg-primary-600` |
| `hover:text-blue-600` | `hover:text-primary-600` |
| `hover:text-blue-500` | `hover:text-primary-500` |
| `focus:border-blue-500` | `focus:border-primary-500` |
| `focus:ring-blue-500` | `focus:ring-primary-500` |
| `shadow-blue-600/20` | `shadow-primary-600/20` |
| `from-blue-500/10` | `from-primary-500/10` |
| `to-blue-500/10` | `to-primary-500/10` |

#### Scenario: 主题切换后 UI 颜色同步变化
- **WHEN** 用户切换到 Forest（绿色）主题
- **THEN** 所有按钮、链接、高亮元素显示绿色系，而非蓝色
- **AND** 所有 `primary-*` 类的颜色值自动变为 Forest 主题对应的色阶

#### Scenario: 亮色和暗色模式兼容
- **WHEN** 用户切换到暗色模式
- **THEN** 所有 `primary-*` 类在暗色背景下仍然保持良好的对比度和可读性
- **AND** 组件中已有的 `dark:` 前缀修饰符继续生效

### Requirement: 高频组件优先迁移
系统 SHALL 优先迁移使用 `blue-*` 频率最高的组件文件，确保核心 UI 元素优先支持主题。

#### 高频文件列表（出现次数 >= 20）

| 文件 | blue-* 出现次数 |
|------|-----------------|
| AutoGraphGenerator.tsx | 47 |
| Dashboard.tsx | 48 |
| GraphMap.tsx | 43 |
| Templates.tsx | 42 |
| LearningPaths.tsx | 39 |
| TemplateGenerator.tsx | 25 |
| UnifiedWorkbench.tsx | 25 |
| SaveAsTemplateModal.tsx | 25 |
| GraphOutline.tsx | 29 |
| GraphAnalysisPanel.tsx | 27 |
| TextToGraphModal.tsx | 26 |
| QuickCreateGraphPanel.tsx | 32 |
| GraphToolbar.tsx | 31 |
| DomainManager.tsx | 22 |
| Profile.tsx | 22 |
| Register.tsx | 12 |
| Login.tsx | 12 |
| TemplateEditor.tsx | 20 |
| TaskTemplates.tsx | 36 |
| Tasks.tsx | 20 |

### Requirement: 排除项
以下场景不需要迁移，保持原有颜色：

1. **Settings.tsx 主题选择器 UI** — 展示各主题预览色的色块需要保留硬编码颜色以准确展示各主题的特色
2. **第三方库组件** — 如果组件颜色由第三方库控制，不在本次迁移范围
3. **功能性颜色** — 如错误红（red-*）、成功绿（green-*）、警告黄（yellow-*）等语义化颜色保持不变

## MODIFIED Requirements
无修改项，此为新增功能。

## REMOVED Requirements
无移除项。
