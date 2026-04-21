# 主题系统扩展 Spec

## Why
当前应用仅支持亮色/暗色两种模式切换，缺乏丰富的视觉个性化选项。用户希望拥有更多主题配色方案，在亮色和暗色之间提供多样化的颜色风格，提升应用的视觉体验和个性化程度。

## What Changes
- 重构 `useTheme.ts`，引入 **ThemePreset**（主题预设）概念，与 ThemeMode（亮/暗/系统）正交组合
- 新增 6 个主题预设配色方案：Ocean（海洋蓝）、Forest（森林绿）、Sunset（日落橙）、Lavender（薰衣草紫）、Rose（玫瑰粉）、Midnight（午夜深蓝）
- 将 Tailwind `primary` 色板改为通过 CSS 变量动态切换，而非硬编码
- 在 Settings 页面新增主题预设选择器 UI
- 更新 i18n 翻译文件，添加新主题名称
- 保留现有 `ColorScheme`（学习状态配色）系统不变，两者独立运作

## Impact
- Affected specs: 主题系统架构
- Affected code:
  - `src/hooks/common/useTheme.ts` — 核心重构
  - `src/config/themePresets.ts` — 新增主题预设配置
  - `tailwind.config.js` — primary 色板改为 CSS 变量引用
  - `src/index.css` — 新增主题预设 CSS 变量定义
  - `src/styles/scheduler.css` — 新增主题预设变量覆盖
  - `src/pages/Settings.tsx` — 新增主题预设选择器
  - `src/i18n/locales/zh-CN.json` — 新增翻译
  - `src/i18n/locales/en-US.json` — 新增翻译
  - `src/components/Layout/Layout.tsx` — 侧边栏主题切换增强
  - `src/components/GraphEditor/toolbar/GraphToolbar.tsx` — 工具栏主题类映射适配

## ADDED Requirements

### Requirement: ThemePreset 主题预设系统
系统 SHALL 提供主题预设（ThemePreset）功能，允许用户在多种配色方案间切换，每个主题预设定义一组完整的 UI 颜色变量。

#### ThemePreset 类型定义
```typescript
export type ThemePreset = 'default' | 'ocean' | 'forest' | 'sunset' | 'lavender' | 'rose' | 'midnight';
```

#### Scenario: 用户选择主题预设
- **WHEN** 用户在设置页面选择一个主题预设（如 Ocean）
- **THEN** 系统将 `<html>` 元素添加 `theme-ocean` class，CSS 变量随之切换，整个应用 UI 颜色立即更新
- **AND** 选择结果持久化到 localStorage

#### Scenario: 主题预设与亮暗模式正交组合
- **WHEN** 用户选择 Ocean 主题预设 + 暗色模式
- **THEN** `<html>` 元素同时拥有 `dark theme-ocean` class，CSS 变量取暗色变体值
- **AND** 任何主题预设都可以与亮色/暗色/系统模式自由组合

### Requirement: 主题预设配色方案定义
系统 SHALL 为每个主题预设定义完整的 CSS 变量集，包括亮色和暗色变体。

#### 预设配色方案

| 预设 | 主色调 | primary-500 | 描述 |
|------|--------|-------------|------|
| default | 天蓝 | #0ea5e9 | 当前默认配色 |
| ocean | 深海蓝 | #0369a1 | 深沉海洋风格 |
| forest | 森林绿 | #16a34a | 自然清新风格 |
| sunset | 日落橙 | #ea580c | 温暖活力风格 |
| lavender | 薰衣草紫 | #7c3aed | 优雅柔和风格 |
| rose | 玫瑰粉 | #e11d48 | 浪漫温馨风格 |
| midnight | 午夜蓝 | #4f46e5 | 神秘深邃风格 |

#### Scenario: 每个预设提供完整的 50-900 色阶
- **WHEN** 主题预设被激活
- **THEN** CSS 变量 `--primary-50` 到 `--primary-900` 全部更新为该预设对应的色阶值

### Requirement: ThemeProvider 重构
系统 SHALL 重构 ThemeProvider 以同时管理 ThemeMode 和 ThemePreset。

#### Scenario: ThemeContext 扩展
- **WHEN** 组件调用 `useTheme()`
- **THEN** 返回的 context 包含 `themePreset`、`setThemePreset`、`availablePresets` 等新字段
- **AND** 保留现有 `theme`、`themeMode`、`setTheme`、`toggleTheme`、`isDark` 字段不变

#### Scenario: 主题预设持久化
- **WHEN** 用户选择新主题预设
- **THEN** 预设名称保存到 `localStorage` 键 `themePreset`
- **WHEN** 应用启动
- **THEN** 从 `localStorage` 读取上次选择的主题预设，若无则使用 `default`

### Requirement: Tailwind primary 色板动态化
系统 SHALL 将 Tailwind 配置中的 `primary` 色板改为引用 CSS 变量，使其随主题预设动态切换。

#### Scenario: Tailwind primary 颜色跟随主题
- **WHEN** 开发者使用 `bg-primary-500` 等 Tailwind class
- **THEN** 颜色值来自 CSS 变量 `--primary-500`，随主题预设切换而变化

### Requirement: Settings 页面主题预设选择器
系统 SHALL 在 Settings 页面的外观设置区域新增主题预设选择器。

#### Scenario: 主题预设选择器展示
- **WHEN** 用户打开设置页面
- **THEN** 在亮色/暗色/系统选择器下方显示主题预设选择器
- **AND** 每个预设以色块卡片形式展示，包含名称和主色调预览
- **AND** 当前选中的预设卡片有高亮边框

#### Scenario: 主题预设切换
- **WHEN** 用户点击某个主题预设卡片
- **THEN** 应用立即切换到该主题预设，所有 UI 颜色更新

### Requirement: i18n 翻译更新
系统 SHALL 为新增的主题预设名称添加中英文翻译。

#### Scenario: 主题预设名称翻译
- **WHEN** 用户语言为中文
- **THEN** 主题预设显示为：默认、海洋、森林、日落、薰衣草、玫瑰、午夜
- **WHEN** 用户语言为英文
- **THEN** 主题预设显示为：Default、Ocean、Forest、Sunset、Lavender、Rose、Midnight

## MODIFIED Requirements

### Requirement: ThemeProvider
原有的 ThemeProvider 仅管理 light/dark/system 模式。现扩展为同时管理 ThemeMode 和 ThemePreset，两者正交组合。ThemeContext 接口新增字段，但保留所有原有字段和行为的向后兼容。

### Requirement: Settings 外观设置区域
原有设置页面仅有亮色/暗色/系统三按钮选择器。现新增主题预设选择器区域，位于模式选择器下方。

## REMOVED Requirements
无移除项。
