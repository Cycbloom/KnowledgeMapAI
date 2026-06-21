# 修复语义视图 UI 问题

## 概述

语义布局（Semantic）视图存在三个 UI 问题需要修复：
1. 缺少 i18n 翻译键，导致下拉菜单显示原始 key 名（如 `graphEditor.toolbar.semantic`）
2. 不可用提示横幅被工具栏遮挡（z-index 层级过低）
3. 提示文案过于技术化，普通用户难以理解"嵌入向量"的含义

## 当前状态分析

### 问题 1：缺少 i18n 翻译键

**文件**：[ViewModeSelector.tsx](src/components/GraphEditor/toolbar/ViewModeSelector.tsx#L50-L54)

semantic 模式引用了两个不存在的 key：
- `graphEditor.toolbar.semantic` → 显示为原始字符串
- `graphEditor.toolbar.semanticDesc` → 同上

**文件**：[zh-CN.json](src/i18n/locales/zh-CN.json#L2739-L2744) 和 [en-US.json](src/i18n/locales/en-US.json#L2435-L2440)

当前 `viewModes` 部分只有 5 个条目，**缺少**：
| Key | 说明 |
|-----|------|
| `semantic` | 语义视图名称 |
| `semanticDesc` | 语义视图描述 |
| `mindmapDesc` | 思维导图描述 |
| `timelineDesc` | 时间线描述 |
| `treeViewDesc` | 树形视图描述 |
| `planetDesc` | 知识星球描述 |
| `quadrantDesc` | 象限描述 |

> 注：`mindmapDesc`、`planetDesc`、`quadrantDesc`、`timelineDesc`、`treeViewDesc` 虽然在 ViewModeSelector 中被引用，但 locale 文件中也缺失，应一并补全。

### 问题 2：提示横幅被遮挡

**文件**：[MindMapCanvas.tsx](src/components/GraphEditor/canvas/MindMapCanvas.tsx#L714-L717)

```tsx
<div className="... z-10 ...">  // 当前 z-10
```

工具栏各元素使用 `z-50`（见 GraphToolbar.tsx 第 350、801、893、910、956、1048 行），导致 `z-10` 的横幅被完全覆盖。

### 问题 3：提示文案不友好

当前文案：`暂无语义数据，已回退到力导向布局。请先生成知识点嵌入向量。`

问题：
- "嵌入向量"是 ML 技术术语，普通用户无法理解
- 未告知用户如何操作才能解决

## 修改方案

### 修改 1：补充 i18n 翻译键

**文件**：`src/i18n/locales/zh-CN.json`

在 `viewModes` 部分（第 2744 行 `"quadrant"` 之后）添加：

```json
"semantic": "语义聚类",
"semanticDesc": "按内容相似度自动分组",
"mindmapDesc": "力导向自由布局",
"timelineDesc": "按时间顺序排列",
"treeViewDesc": "层级树状结构",
"planetDesc": "星球环绕布局",
"quadrantDesc": "四象限分类"
```

**文件**：`src/i18n/locales/en-US.json`

在对应位置添加：

```json
"semantic": "Semantic",
"semanticDesc": "Group by content similarity",
"mindmapDesc": "Force-directed layout",
"timelineDesc": "Chronological order",
"treeViewDesc": "Hierarchical tree",
"planetDesc": "Orbital layout",
"quadrantDesc": "Four-quadrant grid"
```

### 修改 2：提高横幅 z-index

**文件**：`src/components/GraphEditor/canvas/MindMapCanvas.tsx`（第 715 行）

将 `z-10` 改为 `z-[60]`，确保高于工具栏的 `z-50`。

### 修改 3：优化提示文案

**文件**：`src/components/GraphEditor/canvas/MindMapCanvas.tsx`（第 716 行）

将默认值改为更友好的表述：

- 中文：`暂无语义分析数据，已切换为常规布局。请在知识点的 AI 功能中启用语义分析后重试。`
- 英文：`Semantic data unavailable, switched to standard layout. Enable semantic analysis in AI features and try again.`

同时需要在 i18n 文件中添加正式翻译键 `graphEditor.mindMap.semanticUnavailable`。

## 涉及文件清单

| 文件 | 修改类型 |
|------|----------|
| `src/i18n/locales/zh-CN.json` | 新增 7 个翻译键 |
| `src/i18n/locales/en-US.json` | 新增 7 个翻译键 |
| `src/components/GraphEditor/canvas/MindMapCanvas.tsx` | z-index + 文案 |

## 验证步骤

1. 运行 `npm run check:incremental && npm run lint` 确认无类型/代码错误
2. 启动应用，打开视图模式下拉菜单，确认"语义聚类"正常显示中文（非 raw key）
3. 切换到 semantic 视图且无嵌入数据时，确认黄色提示横幅完整可见（不被工具栏遮挡）
4. 确认提示文案通俗易懂
5. 切换英文 locale，确认所有新增翻译正确显示
