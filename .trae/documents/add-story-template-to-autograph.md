# 计划：AI 知识图谱生成器添加故事创作模板选项

## Summary
在首页「AI 知识图谱生成器」对话框中添加缺失的 **"创意写作"** 分类（含小说/故事创作模板），使用户能通过 AI 生成器创建故事创作类型的图谱。

## Current State Analysis

### 问题根因
[AutoGraphGenerator.tsx](src/components/AutoGraph/AutoGraphGenerator.tsx#L65-L70) 中 `CATEGORIES` 数组只定义了 4 个分类：
```typescript
const CATEGORIES: TemplateCategory[] = [
  "knowledge",    // 知识学习
  "project",      // 项目规划
  "analysis",     // 问题分析
  "architecture", // 系统架构
  // 缺少 "creative" !!!
];
```

由于缺少 `"creative"`，UI 渲染循环（第 788 行 `{CATEGORIES.map((cat) => ...}`）永远不会渲染创意分类下的 `story_creation` 选项。

### 已就绪的支撑代码（无需修改）
| 项目 | 文件 | 行号 | 状态 |
|------|------|------|------|
| TypeScript 类型 | [graph.ts](shared/types/graph.ts) | L58 | ✅ `story_creation` 已在 `TemplateType` 联合类型中 |
| 模板配置 | [graph.ts](shared/types/graph.ts) | L217-223 | ✅ `TEMPLATE_TYPE_MAP` 含完整配置 |
| 分类映射 | [graph.ts](shared/types/graph.ts) | L247 | ✅ `creative: ["story_creation"]` |
| 分类图标 | [AutoGraphGenerator.tsx](src/components/AutoGraph/AutoGraphGenerator.tsx) | L83-84 | ✅ `case "creative": return <Sparkles>` |
| 分类颜色 | [AutoGraphGenerator.tsx](src/components/AutoGraph/AutoGraphGenerator.tsx) | L116-121 | ✅ pink 配色已定义 |
| i18n 中文 | [zh-CN.json](src/i18n/locales/zh-CN.json) | L1438/L1459 | ✅ 标签和描述已存在 |
| i18n 英文 | [en-US.json](src/i18n/locales/en-US.json) | - | ✅ 标签和描述已存在 |

## Proposed Changes

### Change 1: CATEGORIES 数组添加 "creative"
**文件**: `d:\KnowledgeMap\src\components\AutoGraph\AutoGraphGenerator.tsx`
**位置**: 第 65-70 行
**修改**: 在数组末尾添加 `"creative"`

```typescript
// Before
const CATEGORIES: TemplateCategory[] = [
  "knowledge",
  "project",
  "analysis",
  "architecture",
];

// After
const CATEGORIES: TemplateCategory[] = [
  "knowledge",
  "project",
  "analysis",
  "architecture",
  "creative",
];
```

**原因**: 这是唯一需要修改的代码行。所有支撑代码（图标、颜色、i18n、类型映射）均已就绪。

### Change 2: UI 布局微调（5 个分类适配）
**文件**: 同上
**位置**: 第 787 行 `grid grid-cols-2 gap-2`
**修改**: 考虑将分类按钮改为 `grid-cols-3` 或保持 `grid-cols-2`（第 5 个自动换行到第二行）

当前是 4 个分类用 `grid-cols-2`（2×2 排列）。加一个后变成 3+2 或 2×3。建议保持 `grid-cols-2` 不变，让第 5 个自然换行，视觉上仍然整齐。

## Assumptions & Decisions
1. 不需要修改后端 — AI 生成流程已经支持传入任意 `template_type` 值
2. 不需要修改 Dashboard 的模板选择（Dashboard 已有 story_creation 选项）
3. 用户选择 story_creation 后，创建的图谱会正确进入 StoryEditor 编辑器模式（GraphEditor.tsx 第 1185 行已有处理）

## Verification Steps
1. 启动开发服务器 `npm run dev`
2. 打开首页，点击「AI 知识图谱生成器」
3. 展开「模板类型」，确认出现第 5 个分类 **"创意写作"**（粉色 Sparkles 图标）
4. 点击展开后显示 **"小说/故事创作"** 子选项
5. 选择该选项后正常进入生成流程
6. 创建完成后确认图谱进入 StoryEditor 编辑模式
