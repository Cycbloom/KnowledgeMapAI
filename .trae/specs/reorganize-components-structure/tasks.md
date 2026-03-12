# Tasks - 组件组织结构重构

## 阶段一：GraphEditor 目录重组

- [x] Task 1: 创建 GraphEditor 子目录结构
  - [x] 创建 canvas/ 目录
  - [x] 创建 sidebar/ 目录
  - [x] 创建 toolbar/ 目录
  - [x] 创建 modals/ 目录
  - [x] 创建 panels/ 目录
  - [x] 创建 context-menu/ 目录
  - [x] 创建 mobile/ 目录
  - [x] 创建 shared/ 目录

- [x] Task 2: 移动画布相关组件到 canvas/
  - [x] 移动 MindMapCanvas.tsx
  - [x] 移动 MindMapNode.tsx
  - [x] 移动 MindMapLink.tsx
  - [x] 移动 MiniMap.tsx
  - [x] 移动 NodeRing.tsx
  - [x] 移动 CanvasLayout.tsx
  - [x] 移动 MindMapCanvas/ 子目录

- [x] Task 3: 移动侧边栏相关组件到 sidebar/
  - [x] 移动 NodeDetailSidebar.tsx
  - [x] 移动 NodeEditSidebar.tsx
  - [x] 移动 GraphSidebarManager.tsx

- [x] Task 4: 移动工具栏相关组件到 toolbar/
  - [x] 移动 GraphToolbar.tsx
  - [x] 移动 ViewModeSelector.tsx
  - [x] 移动 PresentationControls.tsx

- [x] Task 5: 移动弹窗相关组件到 modals/
  - [x] 移动 GraphModalManager.tsx
  - [x] 移动 ExportDialog.tsx
  - [x] 移动 ShareModal.tsx
  - [x] 移动 PodcastModal.tsx
  - [x] 移动 TextToGraphModal.tsx
  - [x] 移动 BatchGenerateDialog.tsx
  - [x] 移动 GraphSettingsModal.tsx
  - [x] 移动 EdgeEditDialog.tsx
  - [x] 移动 ActionResultModal.tsx

- [x] Task 6: 移动面板相关组件到 panels/
  - [x] 移动 GraphAnalysisPanel.tsx
  - [x] 移动 GraphOutline.tsx
  - [x] 移动 RAGChatPanel.tsx
  - [x] 移动 PromptSettingsPanel.tsx
  - [x] 移动 AIActionSettingsPanel.tsx
  - [x] 移动 PromptEditor.tsx

- [x] Task 7: 移动右键菜单组件到 context-menu/
  - [x] 移动 NodeContextMenu.tsx
  - [x] 移动 EdgeContextMenu.tsx

- [x] Task 8: 移动移动端专用组件到 mobile/
  - [x] 移动 MobileNodeActionMenu.tsx
  - [x] 移动 MobileNodePreviewCard.tsx

- [x] Task 9: 移动共享组件到 shared/
  - [x] 移动 GraphSkeleton.tsx
  - [x] 移动 GraphStatsSummary.tsx
  - [x] 移动 GraphStyleSettings.tsx
  - [x] 移动 RelationshipTypeSettings.tsx
  - [x] 移动 CommandPalette.tsx
  - [x] 移动 ExplorationTimeline.tsx
  - [x] 移动 LayoutOrganizer.tsx
  - [x] 移动 NodePreviewCard.tsx
  - [x] 移动 VirtualizedNodeList.tsx
  - [x] 移动 VirtualizedEdgeList.tsx
  - [x] 移动 AlternativeBranches.tsx
  - [x] 移动 BranchPreview.tsx

## 阶段二：可复用组件提取

- [x] Task 10: 提取可复用组件到 common/
  - [x] ~~跳过：NodePreviewCard 等组件与 GraphEditor 耦合，不适合移动~~
  - [x] ~~跳过：VirtualizedNodeList 依赖 MindMapNode，不适合移动~~
  - [x] ~~跳过：VirtualizedEdgeList 依赖 MindMapLink，不适合移动~~

## 阶段三：功能域目录优化

- [x] Task 11: 合并 LearningMode 和 LearningPath 目录
  - [x] 创建 Learning/ 目录
  - [x] 移动 LearningMode/ 下的组件
  - [x] 移动 LearningPath/ 下的组件
  - [x] 删除空目录

## 阶段四：更新导入路径

- [x] Task 12: 更新 pages 中的导入路径
  - [x] 更新 GraphEditor.tsx
  - [x] 更新 LearningMode.tsx
  - [x] 更新 Profile.tsx
  - [x] 更新 GraphMap.tsx
  - [x] 更新 CombinedGraphView.tsx
  - [x] 更新其他受影响的页面

- [x] Task 13: 更新组件间的相互导入
  - [x] 更新 GraphEditor 子目录组件间的导入
  - [x] 更新其他组件对 GraphEditor 组件的导入
  - [x] 更新对 common 组件的导入

## 阶段五：验证

- [x] Task 14: 验证修改
  - [x] 运行类型检查 (npm run check)
  - [x] 运行代码检查 (npm run lint)
  - [ ] 运行开发服务器验证功能正常

---

# Task Dependencies

- Task 2-9 依赖 Task 1（需要先创建目录结构）
- Task 10 依赖 Task 9（需要先移动组件到 shared/）
- Task 11 可以与 Task 2-9 并行执行
- Task 12-13 依赖 Task 2-11（需要组件移动完成）
- Task 14 依赖 Task 12-13（需要导入路径更新完成）
