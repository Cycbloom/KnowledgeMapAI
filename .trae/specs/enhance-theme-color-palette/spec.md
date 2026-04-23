# 主题色系扩展 Spec

## Why
当前主题预设系统每个预设仅包含单一颜色的深浅变化（如 `sunset` 只有橙色、`rose` 只有粉红色），视觉表现较为单调。用户希望每个主题预设包含一组相近的颜色（色系），如"暖色系"包含红、橙、黄等，"冷色系"包含蓝、青、紫等，使主题更加丰富、有层次感。

## What Changes
- 扩展 `ThemePresetConfig` 接口，新增 `secondary`（次要色）、`tertiary`（第三色）色阶
- 为每个主题预设定义完整的色系组合，而非单一颜色
- 新增 CSS 变量 `--secondary-*` 和 `--tertiary-*` 色阶
- 更新 Tailwind 配置，支持 `secondary-*` 和 `tertiary-*` 颜色类
- 更新 Settings 页面主题选择器，展示色系预览而非单一色块

## Impact
- Affected specs: 主题系统（expand-theme-system）
- Affected code:
  - `src/config/themePresets.ts` — 扩展色系配置
  - `src/index.css` — 新增 CSS 变量
  - `tailwind.config.js` — 新增颜色配置
  - `src/pages/Settings.tsx` — 更新主题预览 UI
  - `src/types/index.ts` — 扩展类型定义

## ADDED Requirements

### Requirement: 主题色系定义
系统 SHALL 为每个主题预设定义完整的色系组合，包含 primary（主色）、secondary（次要色）、tertiary（第三色）三个色阶。

#### 色系设计原则
- **Primary**: 主题的核心颜色，用于主要按钮、链接、强调元素
- **Secondary**: 与 primary 相近的辅助色，用于次要按钮、标签、装饰元素
- **Tertiary**: 与 primary 和 secondary 协调的第三色，用于背景、渐变、点缀

#### 各主题色系方案

| 主题 | Primary | Secondary | Tertiary | 色系描述 |
|------|---------|-----------|----------|----------|
| default | 天蓝色系 | 青色系 | 蓝绿色系 | 清新科技风 |
| ocean | 深蓝色系 | 靛蓝色系 | 紫蓝色系 | 深邃海洋风 |
| forest | 绿色系 | 青绿色系 | 黄绿色系 | 自然生态风 |
| sunset | 橙色系 | 红橙色系 | 黄橙色系 | 温暖活力风 |
| lavender | 紫色系 | 蓝紫色系 | 粉紫色系 | 优雅柔和风 |
| rose | 玫红色系 | 粉红色系 | 红粉色系 | 浪漫温馨风 |
| midnight | 靛蓝色系 | 紫色系 | 蓝紫色系 | 神秘深邃风 |

#### Scenario: 色系颜色协调
- **WHEN** 用户选择 sunset 主题
- **THEN** primary 为橙色系，secondary 为红橙色系，tertiary 为黄橙色系
- **AND** 三种颜色在色轮上相邻，视觉协调

### Requirement: ThemePresetConfig 接口扩展
系统 SHALL 扩展 ThemePresetConfig 接口以支持多色系定义。

#### 接口定义
```typescript
interface ThemePresetConfig {
  name: string;
  primary: PrimaryScale;    // 主色阶
  secondary: PrimaryScale;  // 次要色阶（新增）
  tertiary: PrimaryScale;   // 第三色阶（新增）
  accent: string;
  previewColors: string[];  // 改为数组，展示色系预览
}
```

#### Scenario: 配置向后兼容
- **WHEN** 读取旧版配置（仅有 primary）
- **THEN** 系统自动生成 secondary 和 tertiary 为 primary 的变体
- **AND** 不影响现有功能

### Requirement: CSS 变量扩展
系统 SHALL 为每个主题预设定义 secondary 和 tertiary 的 CSS 变量。

#### CSS 变量命名
```css
:root.theme-sunset {
  /* Primary - 橙色系 */
  --primary-50: #fff7ed;
  --primary-500: #f97316;
  --primary-900: #7c2d12;
  
  /* Secondary - 红橙色系 */
  --secondary-50: #fff1f2;
  --secondary-500: #f43f5e;
  --secondary-900: #881337;
  
  /* Tertiary - 黄橙色系 */
  --tertiary-50: #fefce8;
  --tertiary-500: #eab308;
  --tertiary-900: #713f12;
}
```

#### Scenario: 暗色模式色系支持
- **WHEN** 用户切换到暗色模式
- **THEN** secondary 和 tertiary 色阶同样提供暗色变体
- **AND** 颜色对比度符合可访问性标准

### Requirement: Tailwind 颜色类扩展
系统 SHALL 在 Tailwind 配置中新增 secondary 和 tertiary 颜色类。

#### Tailwind 配置
```javascript
colors: {
  primary: {
    50: 'var(--primary-50)',
    // ...
    900: 'var(--primary-900)',
  },
  secondary: {
    50: 'var(--secondary-50)',
    // ...
    900: 'var(--secondary-900)',
  },
  tertiary: {
    50: 'var(--tertiary-50)',
    // ...
    900: 'var(--tertiary-900)',
  },
}
```

#### Scenario: 组件使用色系颜色
- **WHEN** 开发者使用 `bg-secondary-500` 或 `text-tertiary-600`
- **THEN** 颜色值来自对应的 CSS 变量，随主题切换而变化

### Requirement: Settings 页面色系预览
系统 SHALL 更新 Settings 页面的主题选择器，展示色系预览而非单一色块。

#### Scenario: 色系预览展示
- **WHEN** 用户打开设置页面
- **THEN** 每个主题预设显示 3 个色块（primary、secondary、tertiary）
- **AND** 色块水平排列，直观展示色系组合

#### Scenario: 色系预览交互
- **WHEN** 用户点击某个主题预设
- **THEN** 应用立即切换到该主题，所有色系颜色同时更新

## MODIFIED Requirements

### Requirement: ThemePresetConfig
原有的 ThemePresetConfig 仅包含单一 primary 色阶。现扩展为包含 primary、secondary、tertiary 三个色阶，previewColor 改为 previewColors 数组。

### Requirement: Settings 主题选择器
原有的主题选择器仅显示单一色块预览。现改为显示三个色块组成的色系预览。

## REMOVED Requirements
无移除项。
