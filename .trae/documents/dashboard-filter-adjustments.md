# DashboardHeader 筛选组件调整计划

## 概述

对首页 `DashboardHeader.tsx` 组件做三项调整：筛选按钮位置移动、筛选行展开动画、筛选行背景色使用主题色。

## 当前状态分析

**文件**: [DashboardHeader.tsx](file:///d:/KnowledgeMap/src/components/Dashboard/DashboardHeader.tsx)

**桌面端按钮当前顺序**（第278-437行）：
```
[视图切换] → [选择/取消选择] → [导入] → [图谱地图] → [AI生成] → [筛选]
```

**筛选行**（第576-680行）：使用 `{filterExpanded && (...)}` 瞬间显示/隐藏，无动画。背景色为 `bg-gray-50`(亮) / `bg-slate-800/50`(暗)，未使用主题色。

## 修改方案

### 修改 1：筛选按钮移到"选择"和"导入"之间

**位置**: 第417-436行（Filter Toggle 按钮）

**操作**: 将筛选按钮从当前位置（AI生成按钮之后）剪切到选择/取消选择按钮之后、导入按钮之前。

**调整后按钮顺序**：
```
[视图切换] → [选择/取消选择] → [筛选] → [导入] → [图谱地图] → [AI生成]
```

**原因**: 筛选是列表级的操作，逻辑上与选择模式更接近，放在选择按钮之后更直观。

### 修改 2：筛选行展开/收起动画

**位置**: 第576-680行（Filter Row）

**操作**: 将 `{filterExpanded && (...)}` 条件渲染改为使用 CSS transition 实现高度动画：

- 外层容器始终渲染（不使用条件渲染），通过 `max-height` + `overflow-hidden` + `transition` 实现展开/收起动画
- 展开时：`max-height: 200px`（足够容纳筛选行内容），`opacity: 1`
- 收起时：`max-height: 0`，`opacity: 0`
- 过渡时间：`duration-300`（300ms），缓动函数：`ease-in-out`
- `pointer-events-none` 在收起状态防止交互

**实现方式**（纯 CSS transition，无需额外依赖）：
```tsx
<div
  className={`flex flex-wrap items-center gap-3 px-4 py-3 rounded-xl border overflow-hidden transition-all duration-300 ease-in-out ${
    filterExpanded
      ? "max-h-[200px] opacity-100"
      : "max-h-0 opacity-0 py-0 px-0 border-0 pointer-events-none"
  } ${isDark ? "..." : "..."}`}
>
```

注意：收起时需将 padding 和 border 也归零，否则会有残余空间。

### 修改 3：筛选行背景色使用主题色

**位置**: 第577-581行（Filter Row 容器的 className）

**操作**: 将背景色从 `bg-gray-50`(亮) / `bg-slate-800/50`(暗) 改为主题色：

- 亮色模式：`bg-primary-50 border-primary-100`（浅主题色背景 + 极浅主题色边框）
- 暗色模式：`bg-primary-900/20 border-primary-800/30`（深主题色半透明背景 + 深主题色半透明边框）

**调整后效果**: 筛选行背景色会随主题切换而变化（天蓝/蓝/绿/橙/紫/玫红/靛），与项目整体主题风格一致。

## 涉及文件

| 文件 | 修改内容 |
|------|----------|
| `src/components/Dashboard/DashboardHeader.tsx` | 三项调整全部在此文件 |

## 验证步骤

1. `npm run check` — 类型检查通过
2. `npm run lint` — 代码检查通过
3. 手动验证：
   - 桌面端筛选按钮在选择和导入按钮之间
   - 点击筛选按钮，筛选行有平滑展开动画
   - 再次点击，筛选行有平滑收起动画
   - 筛选行背景色为主题色（随主题切换变化）
   - 暗色模式下背景色正确
