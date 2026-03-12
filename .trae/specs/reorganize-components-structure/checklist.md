# Checklist - 组件组织结构重构

## GraphEditor 目录重组

- [x] GraphEditor/canvas/ 目录创建完成
- [x] GraphEditor/sidebar/ 目录创建完成
- [x] GraphEditor/toolbar/ 目录创建完成
- [x] GraphEditor/modals/ 目录创建完成
- [x] GraphEditor/panels/ 目录创建完成
- [x] GraphEditor/context-menu/ 目录创建完成
- [x] GraphEditor/mobile/ 目录创建完成
- [x] GraphEditor/shared/ 目录创建完成

## 组件移动验证

- [x] 画布相关组件移动到 canvas/ 完成
- [x] 侧边栏相关组件移动到 sidebar/ 完成
- [x] 工具栏相关组件移动到 toolbar/ 完成
- [x] 弹窗相关组件移动到 modals/ 完成
- [x] 面板相关组件移动到 panels/ 完成
- [x] 右键菜单组件移动到 context-menu/ 完成
- [x] 移动端专用组件移动到 mobile/ 完成
- [x] 共享组件移动到 shared/ 完成

## 可复用组件提取

- [x] ~~跳过：NodePreviewCard 等组件与 GraphEditor 耦合，不适合移动~~
- [x] ~~跳过：VirtualizedNodeList 依赖 MindMapNode，不适合移动~~
- [x] ~~跳过：VirtualizedEdgeList 依赖 MindMapLink，不适合移动~~

## 功能域目录优化

- [x] Learning/ 目录创建完成
- [x] LearningMode/ 组件移动完成
- [x] LearningPath/ 组件移动完成
- [x] 空目录删除完成

## 导入路径更新

- [x] GraphEditor.tsx 导入路径更新完成
- [x] LearningMode.tsx 导入路径更新完成
- [x] Profile.tsx 导入路径更新完成
- [x] GraphMap.tsx 导入路径更新完成
- [x] CombinedGraphView.tsx 导入路径更新完成
- [x] 其他受影响页面导入路径更新完成
- [x] 组件间相互导入更新完成

## 验证检查

- [x] 类型检查通过 (npm run check)
- [x] 代码检查通过 (npm run lint)
- [ ] 开发服务器启动正常
- [ ] 页面功能正常
