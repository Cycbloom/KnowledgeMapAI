# 主题化全覆盖 Spec

## Why
当前主题预设系统已建立（7 个主题配色方案 + CSS 变量基础设施），但存在两个严重问题：1）组件中大量硬编码颜色（blue-*/purple-*/indigo-*/cyan-*）未迁移到主题感知的 `primary-*` 类，导致切换主题后大部分 UI 仍显示原始颜色；2）CSS 变量仅定义了亮色模式（`:root.theme-xxx`），缺少暗色模式变体（`.dark.theme-xxx`），导致暗色模式下主题色对比度不足、视觉体验差。

## What Changes
- 为每个主题预设新增 `.dark.theme-xxx` CSS 变量定义，确保暗色模式下主题色有合适的亮度和对比度
- 将所有组件中硬编码的 `blue-*` 颜色类替换为主题感知的 `primary-*` 类（约 1232 处，100 个文件）
- 将所有组件中硬编码的 `purple-*` 颜色类替换为主题感知的 `primary-*` 类（约 784 处，100 个文件）
- 将所有组件中硬编码的 `indigo-*` 颜色类替换为主题感知的 `primary-*` 类（约 1057 处，82 个文件）
- 将所有组件中硬编码的 `cyan-*` 颜色类替换为主题感知的 `primary-*` 类（约 776 处，69 个文件）
- 更新 `scheduler.css` 中的硬编码 cyan 颜色为 CSS 变量引用
- **BREAKING**: 所有 `blue-*/purple-*/indigo-*/cyan-*` 主题色将变为跟随主题变化，不再固定为蓝/紫/靛/青色

## Impact
- Affected specs: 主题系统（expand-theme-system）、组件主题色迁移（migrate-theme-colors，本 spec 取代）
- Affected code:
  - `src/index.css` — 新增暗色模式 CSS 变量
  - `src/styles/scheduler.css` — 硬编码颜色替换为变量
  - `src/pages/` — 约 20+ 页面组件
  - `src/components/` — 约 80+ UI 组件
  - `tailwind.config.js` — 可能需要扩展 primary 变量

## ADDED Requirements

### Requirement: 暗色模式主题 CSS 变量
系统 SHALL 为每个主题预设定义暗色模式下的 CSS 变量变体，使用 `.dark.theme-xxx` 选择器。

#### 暗色模式变量设计原则
- 暗色模式下 `primary-50` 到 `primary-200` 应更亮（用于文本和图标）
- 暗色模式下 `primary-600` 到 `primary-900` 应更暗（用于背景，避免过亮）
- 暗色模式下 `primary-400` 到 `primary-500` 作为主要交互色（按钮、链接等）

#### Scenario: 暗色模式下主题色正确显示
- **WHEN** 用户选择 Forest 主题 + 暗色模式
- **THEN** `<html>` 元素同时拥有 `dark theme-forest` class
- **AND** CSS 变量 `--primary-500` 取暗色变体值，确保在深色背景上有足够对比度
- **AND** 使用 `text-primary-400` 的文本在暗色背景下清晰可读

#### Scenario: 亮色模式下主题色不受影响
- **WHEN** 用户选择 Forest 主题 + 亮色模式
- **THEN** CSS 变量值与当前 `:root.theme-forest` 定义完全一致
- **AND** 所有组件颜色表现与当前行为相同

### Requirement: 硬编码 blue-* 颜色迁移
系统 SHALL 将所有组件中硬编码的 `blue-*` Tailwind 颜色类替换为主题感知的 `primary-*` 类。

#### 迁移映射规则

| 硬编码类 | 替换为 |
|----------|--------|
| `bg-blue-{n}` | `bg-primary-{n}` |
| `text-blue-{n}` | `text-primary-{n}` |
| `border-blue-{n}` | `border-primary-{n}` |
| `ring-blue-{n}` | `ring-primary-{n}` |
| `hover:bg-blue-{n}` | `hover:bg-primary-{n}` |
| `hover:text-blue-{n}` | `hover:text-primary-{n}` |
| `focus:border-blue-{n}` | `focus:border-primary-{n}` |
| `focus:ring-blue-{n}` | `focus:ring-primary-{n}` |
| `shadow-blue-{n}` | `shadow-primary-{n}` |
| `from-blue-{n}` | `from-primary-{n}` |
| `to-blue-{n}` | `to-primary-{n}` |
| `via-blue-{n}` | `via-primary-{n}` |

#### Scenario: blue-* 迁移后主题切换生效
- **WHEN** 用户切换到 Rose（玫瑰粉）主题
- **THEN** 原先使用 `bg-blue-500` 的按钮现在显示玫瑰粉色
- **AND** 原先使用 `text-blue-600` 的文本现在显示玫瑰粉深色

### Requirement: 硬编码 purple-* 颜色迁移
系统 SHALL 将所有组件中硬编码的 `purple-*` Tailwind 颜色类替换为主题感知的 `primary-*` 类。

#### 迁移映射规则
与 blue-* 相同的映射模式：`purple-{n}` → `primary-{n}`

#### Scenario: purple-* 迁移后主题切换生效
- **WHEN** 用户切换到 Forest（绿色）主题
- **THEN** 原先使用 `bg-purple-50` 的背景现在显示绿色浅色
- **AND** 原先使用 `text-purple-600` 的文本现在显示绿色深色

### Requirement: 硬编码 indigo-* 颜色迁移
系统 SHALL 将所有组件中硬编码的 `indigo-*` Tailwind 颜色类替换为主题感知的 `primary-*` 类。

#### 迁移映射规则
与 blue-* 相同的映射模式：`indigo-{n}` → `primary-{n}`

### Requirement: 硬编码 cyan-* 颜色迁移
系统 SHALL 将所有组件中硬编码的 `cyan-*` Tailwind 颜色类替换为主题感知的 `primary-*` 类。

#### 迁移映射规则
与 blue-* 相同的映射模式：`cyan-{n}` → `primary-{n}`

### Requirement: scheduler.css 硬编码颜色主题化
系统 SHALL 将 `src/styles/scheduler.css` 中的硬编码 cyan 颜色替换为 CSS 变量引用，使其跟随主题变化。

#### Scenario: 调度器主题跟随
- **WHEN** 用户切换到 Sunset（日落橙）主题
- **THEN** 调度器中的主交互色（原 cyan）变为橙色系
- **AND** 调度器的队列颜色（q0/q1/q2）保持不变（功能性颜色）

### Requirement: 排除项
以下场景不需要迁移，保持原有颜色：

1. **Settings.tsx 主题选择器 UI** — 展示各主题预览色的色块需要保留硬编码颜色
2. **功能性颜色** — 错误红（red-*）、成功绿（green-*）、警告黄（yellow-*/amber-*）等语义化颜色保持不变
3. **调度器队列颜色** — q0（cyan）、q1（emerald）、q2（amber）为功能性标识色，保持不变
4. **第三方库组件** — 颜色由第三方库控制的组件不在迁移范围
5. **TagSystem.tsx 的 TAG_COLORS** — 标签颜色为区分性颜色，非主题色，保持不变
6. **learningStatusColors.ts** — 学习状态颜色为功能性标识色，保持不变

## MODIFIED Requirements

### Requirement: 主题预设 CSS 变量定义
原有的主题预设 CSS 变量仅定义了 `:root.theme-xxx` 选择器（亮色变体）。现扩展为同时定义 `.dark.theme-xxx` 选择器（暗色变体），两者共同构成完整的主题色系。

### Requirement: 组件颜色实现
原有组件使用硬编码的 blue-*/purple-*/indigo-*/cyan-* 颜色类。现统一迁移为 `primary-*` 主题感知类，使组件颜色跟随主题预设动态变化。

## REMOVED Requirements
无移除项。本 spec 取代 `migrate-theme-colors` spec（该 spec 仅覆盖 blue-* 迁移，本 spec 扩展为全覆盖）。
