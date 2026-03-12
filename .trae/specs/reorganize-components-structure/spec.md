# 组件组织结构重构 Spec

## Why

当前 `src/components` 目录存在以下问题：
1. **GraphEditor 目录过大**：包含约 40 个组件文件，职责不清晰，难以维护
2. **可复用组件分散**：部分可复用的 UI 组件散落在功能目录中，未被提取到 `common/`
3. **功能域划分不清晰**：部分组件目录命名和划分不够语义化
4. **features 目录未充分利用**：目前仅作为重导出，没有实际组织作用

## What Changes

- 重组 `GraphEditor` 目录，按功能子域划分子目录
- 提取可复用的 UI 组件到 `common/` 目录
- 优化 `features` 目录结构，按业务功能域组织
- 统一组件导入路径

## Impact

- Affected specs: 前端组件架构
- Affected code: `src/components/`, `src/pages/`

---

## ADDED Requirements

### Requirement: GraphEditor 目录重组

GraphEditor 目录 SHALL 按功能子域划分为以下子目录：

```
GraphEditor/
├── canvas/           # 画布相关组件
│   ├── MindMapCanvas.tsx
│   ├── MindMapNode.tsx
│   ├── MindMapLink.tsx
│   ├── MiniMap.tsx
│   ├── NodeRing.tsx
│   └── CanvasLayout.tsx
├── sidebar/          # 侧边栏相关组件
│   ├── NodeDetailSidebar.tsx
│   ├── NodeEditSidebar.tsx
│   ├── GraphSidebarManager.tsx
├── toolbar/          # 工具栏相关组件
│   ├── GraphToolbar.tsx
│   ├── ViewModeSelector.tsx
│   ├── PresentationControls.tsx
├── modals/           # 弹窗相关组件
│   ├── GraphModalManager.tsx
│   ├── ExportDialog.tsx
│   ├── ShareModal.tsx
│   ├── PodcastModal.tsx
│   ├── TextToGraphModal.tsx
│   ├── BatchGenerateDialog.tsx
│   ├── GraphSettingsModal.tsx
│   ├── EdgeEditDialog.tsx
│   ├── ActionResultModal.tsx
├── panels/           # 面板相关组件
│   ├── GraphAnalysisPanel.tsx
│   ├── GraphOutline.tsx
│   ├── RAGChatPanel.tsx
│   ├── PromptSettingsPanel.tsx
│   ├── AIActionSettingsPanel.tsx
│   ├── PromptEditor.tsx
├── context-menu/     # 右键菜单组件
│   ├── NodeContextMenu.tsx
│   ├── EdgeContextMenu.tsx
├── views/            # 视图组件（已存在）
│   ├── TimelineView.tsx
│   ├── TreeView.tsx
├── mobile/           # 移动端专用组件
│   ├── MobileNodeActionMenu.tsx
│   ├── MobileNodePreviewCard.tsx
└── shared/           # GraphEditor 内部共享组件
    ├── GraphSkeleton.tsx
    ├── GraphStatsSummary.tsx
    ├── GraphStyleSettings.tsx
    ├── RelationshipTypeSettings.tsx
    ├── CommandPalette.tsx
    ├── ExplorationTimeline.tsx
    ├── LayoutOrganizer.tsx
    ├── NodePreviewCard.tsx
    ├── VirtualizedNodeList.tsx
    ├── VirtualizedEdgeList.tsx
    ├── AlternativeBranches.tsx
    ├── BranchPreview.tsx
```

#### Scenario: GraphEditor 组件重组成功
- **WHEN** 开发者需要查找 GraphEditor 相关组件
- **THEN** 可以按功能子域快速定位组件位置

### Requirement: 可复用组件提取

以下组件 SHALL 移动到 `common/` 目录：

1. **NodePreviewCard.tsx** → `common/NodePreviewCard.tsx`（可被 GraphEditor 和 CombinedView 复用）
2. **VirtualizedNodeList.tsx** → `common/VirtualizedNodeList.tsx`（通用虚拟化列表）
3. **VirtualizedEdgeList.tsx** → `common/VirtualizedEdgeList.tsx`（通用虚拟化列表）

#### Scenario: 可复用组件提取成功
- **WHEN** 其他功能模块需要使用预览卡片或虚拟化列表
- **THEN** 可以直接从 `common/` 目录导入使用

### Requirement: 功能域目录优化

以下目录 SHALL 进行优化：

1. **合并相似目录**：
   - `LearningMode/` 和 `LearningPath/` 合并为 `Learning/`
   - `Graph/` 和 `GraphMap/` 可考虑合并或明确职责边界

2. **统一命名规范**：
   - 目录名使用 PascalCase
   - 组件文件使用 PascalCase.tsx

#### Scenario: 功能域目录优化成功
- **WHEN** 开发者需要添加新的学习相关组件
- **THEN** 可以明确知道应放在 `Learning/` 目录下

### Requirement: 导入路径更新

所有受影响组件的导入路径 SHALL 更新：

1. 更新 `src/pages/` 中的导入语句
2. 更新组件间的相互导入
3. 确保类型检查和 lint 检查通过

#### Scenario: 导入路径更新成功
- **WHEN** 运行 `npm run check` 和 `npm run lint`
- **THEN** 所有检查通过，无错误

---

## MODIFIED Requirements

### Requirement: 组件目录结构

原组件目录结构 SHALL 修改为新结构：

**修改前**：
```
components/
├── GraphEditor/ (40+ 文件，无子目录)
├── LearningMode/
├── LearningPath/
├── ...
```

**修改后**：
```
components/
├── GraphEditor/
│   ├── canvas/
│   ├── sidebar/
│   ├── toolbar/
│   ├── modals/
│   ├── panels/
│   ├── context-menu/
│   ├── views/
│   ├── mobile/
│   └── shared/
├── Learning/ (合并 LearningMode 和 LearningPath)
├── common/ (扩展可复用组件)
└── ...
```

---

## REMOVED Requirements

### Requirement: 旧目录结构

**Reason**: 目录结构过于扁平，难以维护
**Migration**: 按新结构重组后，更新所有导入路径
