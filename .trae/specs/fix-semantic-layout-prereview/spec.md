# 语义布局提交前修复 Spec

## Why

最终审查发现 3 个需要修复的问题：桌面端下拉菜单缺少语义模式选项、UMAP 坐标归一化逻辑有 bug、API 层 GraphViewMode 类型不同步。

## What Changes

- **GraphToolbar.tsx 桌面端下拉菜单** — 在桌面端视图模式下拉列表中添加 semantic 模式选项
- **mindmapLayout.ts 归一化逻辑** — 修复 createSemanticLayout 中混合了两种缩放方法导致节点偏移的 bug
- **graphCalculator.worker.ts 归一化逻辑** — 修复 Worker 中相同的归一化 bug
- **MindMapCanvas.tsx 硬编码中文** — 将语义布局不可用提示改为 i18n t() 调用

## Impact

- Affected code:
  - `src/components/GraphEditor/toolbar/GraphToolbar.tsx` — 桌面端下拉菜单
  - `src/utils/mindmapLayout.ts` — createSemanticLayout 归一化
  - `src/workers/graphCalculator.worker.ts` — Worker 归一化
  - `src/components/GraphEditor/canvas/MindMapCanvas.tsx` — i18n 提示文字

## ADDED Requirements

无新增需求。

## MODIFIED Requirements

### Requirement: 桌面端视图模式下拉菜单（现有）

桌面端视图模式下拉菜单 SHALL 包含 semantic 模式选项，与移动端底部菜单保持一致。

### Requirement: UMAP 坐标归一化（现有）

createSemanticLayout 的坐标归一化 SHALL 使用正确的缩放方法：先计算保持纵横比的缩放因子，再应用缩放和偏移，不应混合归一化（0-1）和纵横比缩放两种方法。

## REMOVED Requirements

无移除项。
