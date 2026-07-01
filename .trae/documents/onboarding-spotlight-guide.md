# 新手引导升级：居中弹窗 → 定位高亮式引导

## 摘要

将知识图谱编辑器的 OnboardingGuide 从居中弹窗式引导升级为 **定位高亮式引导**（spotlight tour），使引导提示框定位到对应 UI 区域旁边，并用遮罩高亮目标元素。同时增加更多引导步骤，并在工具栏设置菜单中添加"重播教程"入口。

## 现状分析

### 当前实现
- **文件**: `src/components/GraphEditor/OnboardingGuide.tsx` — 自研居中弹窗卡片，4 步引导
- **触发**: 首次进入图谱编辑器，通过 `localStorage` 键 `graph-editor-onboarding-complete` 判断
- **问题**:
  1. 引导卡片居中显示，**不定位到具体 UI 元素**，用户不知道描述的区域在哪
  2. 没有遮罩高亮（spotlight）效果
  3. 完成后无法重新触发

### 已有基础设施
- 4 个 `data-tour` 属性已存在于 `GraphEditor.tsx` 中：`canvas`(L1214)、`toolbar`(L1366)、`sidebar`(L1545)、`help`(L1600)
- `GraphToolbar` 系统设置下拉菜单有"操作指南"入口（L1785-1789），当前打开 HelpModal
- i18n 文本在 `src/i18n/locales/zh-CN/graphEditor.json` 的 `onboarding` 命名空间

### 技术选型
- **driver.js**：~14KB gzip，轻量级，原生支持聚光灯高亮、智能定位 tooltip、动画过渡、键盘导航

## 改动方案

### Step 1: 安装 driver.js

```bash
npm install driver.js
```

### Step 2: 重写 OnboardingGuide 组件

**文件**: `src/components/GraphEditor/OnboardingGuide.tsx`

将整个组件重写为基于 driver.js 的引导实现：

- 使用 `driver.js` 的 `driver()` API 创建引导实例
- 定义步骤时通过 `element` 选择器定位到 `data-tour` 元素
- 保留现有的 `isOnboardingComplete` / `markOnboardingComplete` 函数
- 保留 `onComplete` 回调机制
- 导出 `startOnboardingTour` 函数供外部调用（重播场景）

**步骤设计**（6 步）：

| # | element (data-tour) | 标题 | 描述 | popover 位置 |
|---|---------------------|------|------|-------------|
| 1 | `[data-tour="toolbar"]` | 工具栏 | 左上角工具栏，提供导航、编辑、AI 助手、视图切换和系统设置等功能 | bottom |
| 2 | `[data-tour="canvas"]` | 画布区域 | 核心区域，支持思维导图、象限、时间线等多种视图模式来组织和连接知识节点 | top |
| 3 | `[data-tour="sidebar"]` | 侧边栏 | 右侧面板，选中节点后可编辑内容、查看详情、管理知识点 | left |
| 4 | 新增 `[data-tour="rag-chat"]` | AI 智能问答 | 左下角按钮，点击可展开 AI 问答面板，基于图谱内容智能回答问题 | right/top |
| 5 | 新增 `[data-tour="minimap"]` | 小地图 | 画布右下角的小地图，用于快速定位和导航图谱 | top/left |
| 6 | `[data-tour="help"]` | 快捷键帮助 | 按 ? 键随时查看所有快捷键，也可从设置菜单重新打开本教程 | left |

> 注意：步骤 4、5 需要在对应组件上新增 `data-tour` 属性。

**核心代码结构**：

```typescript
import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import { useTranslation } from "react-i18next";
import { useEffect } from "react";

const ONBOARDING_KEY = "graph-editor-onboarding-complete";

export const isOnboardingComplete = (): boolean => {
  return localStorage.getItem(ONBOARDING_KEY) === "true";
};

export const markOnboardingComplete = (): void => {
  localStorage.setItem(ONBOARDING_KEY, "true");
};

// 导出此函数供工具栏"重播教程"调用
export const startOnboardingTour = (): void => {
  const driverObj = createDriver();
  driverObj.drive();
};

interface OnboardingGuideProps {
  onComplete: () => void;
}

export const OnboardingGuide: React.FC<OnboardingGuideProps> = ({ onComplete }) => {
  const { t } = useTranslation();

  useEffect(() => {
    const driverObj = createDriver(t, onComplete);
    driverObj.drive();
  }, []); // 仅首次挂载时触发

  return null; // driver.js 自行渲染 UI，无需 React 组件渲染内容
};

function createDriver(t?, onComplete?: () => void) {
  return driver({
    showProgress: true,
    showButtons: ["next", "previous", "close"],
    nextBtnText: t?.("graphEditor.onboarding.next") ?? "下一步",
    prevBtnText: t?.("graphEditor.onboarding.prev") ?? "上一步",
    doneBtnText: t?.("graphEditor.onboarding.finish") ?? "开始使用",
    progressText: "{{current}} / {{total}}",
    onDestroyStarted: () => {
      markOnboardingComplete();
      onComplete?.();
    },
    steps: [
      {
        element: '[data-tour="toolbar"]',
        popover: {
          title: t?.("graphEditor.onboarding.step1Title") ?? "工具栏",
          description: t?.("graphEditor.onboarding.step1Desc") ?? "...",
          side: "bottom" as const,
        },
      },
      // ... 其余步骤
    ],
  });
}
```

### Step 3: 为新步骤添加 data-tour 属性

**文件**: `src/pages/GraphEditor.tsx`

- 在 RAG Chat 按钮容器添加 `data-tour="rag-chat"`
- 在 MiniMap 容器添加 `data-tour="minimap"`

需要找到这两个组件的渲染位置，在外层 `<div>` 上添加属性。

### Step 4: 工具栏添加"重播教程"菜单项

**文件**: `src/components/GraphEditor/toolbar/GraphToolbar.tsx`

- 新增 `onReplayTutorial?: () => void` prop
- 在系统设置下拉菜单中，"操作指南"和"快捷键设置"之间，添加"重播教程"菜单项（使用 `GraduationCap` 或 `PlayCircle` 图标）

**文件**: `src/pages/GraphEditor.tsx`

- 在传递给 `GraphToolbar` 的 props 中添加：
  ```tsx
  onReplayTutorial={() => {
    startOnboardingTour();
  }}
  ```

### Step 5: 更新 i18n 文本

**文件**: `src/i18n/locales/zh-CN/graphEditor.json`

更新 `onboarding` 对象，调整步骤标题/描述以匹配新的 6 步顺序，并新增步骤文本：

```json
"onboarding": {
  "step1Title": "工具栏",
  "step1Desc": "左上角工具栏，提供导航、编辑、AI 助手、视图切换和系统设置等功能",
  "step2Title": "画布区域",
  "step2Desc": "核心区域，支持思维导图、象限、时间线等多种视图模式来组织和连接知识节点",
  "step3Title": "侧边栏",
  "step3Desc": "右侧面板，选中节点后可编辑内容、查看详情、管理知识点",
  "step4Title": "AI 智能问答",
  "step4Desc": "点击此按钮展开 AI 问答面板，基于图谱内容智能回答问题",
  "step5Title": "小地图",
  "step5Desc": "画布右下角的小地图，用于快速定位和导航图谱",
  "step6Title": "快捷键帮助",
  "step6Desc": "按 ? 键随时查看所有快捷键，也可从设置菜单重新打开本教程",
  "next": "下一步",
  "prev": "上一步",
  "finish": "开始使用",
  "skip": "跳过",
  "replayTutorial": "重播教程"
}
```

**文件**: `src/i18n/locales/en-US/graphEditor.json`

同步更新英文翻译。

**文件**: `src/i18n/locales/zh-CN/graphEditor.json`（toolbar 部分）

添加 `toolbar.replayTutorial` 键。

### Step 6: 清理旧代码

- 从 `GraphEditor.tsx` 中移除 `showOnboarding` state 和条件渲染 `<OnboardingGuide>`
- 保留 `isOnboardingComplete` 判断逻辑，但改为在组件挂载时自动触发 driver（若未完成则自动开始）
- 移除旧的 `framer-motion` 导入（如果仅用于 OnboardingGuide）

## 文件修改清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `package.json` | 修改 | 添加 `driver.js` 依赖 |
| `src/components/GraphEditor/OnboardingGuide.tsx` | 重写 | 改用 driver.js 实现 |
| `src/pages/GraphEditor.tsx` | 修改 | 添加 data-tour 属性、传入 onReplayTutorial、调整 OnboardingGuide 使用方式 |
| `src/components/GraphEditor/toolbar/GraphToolbar.tsx` | 修改 | 添加 onReplayTutorial prop 和菜单项 |
| `src/i18n/locales/zh-CN/graphEditor.json` | 修改 | 更新 onboarding 和 toolbar 文本 |
| `src/i18n/locales/en-US/graphEditor.json` | 修改 | 更新 onboarding 和 toolbar 文本 |

## 假设与决策

1. **步骤数量**：6 步（原 4 步 + RAG Chat + 小地图）。如果某些区域在首次进入时不可见（如侧边栏默认隐藏），driver.js 会自动滚动到该元素
2. **RAG Chat 按钮**：假设该按钮在页面加载时始终可见（即使面板关闭，按钮也显示在左下角）
3. **小地图**：假设 MiniMap 组件在画布视图下始终渲染。需确认位置
4. **重播教程**：不重置 localStorage，直接调用 `startOnboardingTour()` 即可重新播放
5. **样式定制**：driver.js 的 CSS 需要少量覆盖以匹配项目暗色/亮色主题

## 验证步骤

1. `npm run check` — 类型检查通过
2. `npm run lint` — 代码检查通过
3. 手动验证：
   - 清除 localStorage 中的 `graph-editor-onboarding-complete`，刷新页面，引导自动开始
   - 每步高亮对应区域，tooltip 定位正确
   - 上一步/下一步/跳过/完成均可正常工作
   - 从工具栏设置菜单点击"重播教程"，引导重新开始
   - 切换暗色/亮色主题，引导样式正常
