# Tasks

- [x] Task 1: GraphToolbar.tsx 桌面端下拉菜单添加 semantic 模式
  - [x] 1.1: 在桌面端视图模式下拉数组中添加 semantic 模式条目（mode: "semantic", label: t("graphEditor.toolbar.semantic"), icon: MapIcon）

- [x] Task 2: 修复 mindmapLayout.ts 归一化逻辑
  - [x] 2.1: 修改 createSemanticLayout 中的坐标归一化，使用正确的缩放方法

- [x] Task 3: 修复 graphCalculator.worker.ts 归一化逻辑
  - [x] 3.1: 修改 Worker 中 calculateSemanticLayout 的归一化逻辑，与 Task 2 保持一致

- [x] Task 4: MindMapCanvas.tsx 硬编码中文改为 i18n
  - [x] 4.1: 将硬编码中文改为 t() 调用

- [x] Task 5: 运行 lint 和 tsc 验证

# Task Dependencies
- [Task 2] and [Task 3] should use the same normalization logic
- [Task 5] depends on all previous tasks
