# 移动端预览模式优化计划

## 需求背景

当前移动端预览模式存在以下问题：
1. hover 悬浮预览卡片和底部预览卡片功能重复
2. 底部预览卡片打开时，左下角和右下角的工具按钮被遮挡
3. 点击节点居中时，节点可能被底部预览卡片遮挡

## 解决方案

### 1. 禁用移动端悬浮预览
**文件**: `src/components/GraphEditor/MindMapCanvas.tsx`

在移动端预览模式下，禁用 hover 触发的 NodePreviewCard：
- 检测 `isMobilePreviewMode` 和 `selectedNodeId` 存在时
- 不显示 hover 悬浮预览卡片

### 2. 工具栏位置动态调整
**文件**: `src/components/GraphEditor/MindMapCanvas.tsx`

当移动端预览卡片打开时，左下角和右下角的工具按钮需要上移：
- 计算预览卡片高度（约 200-300px）
- 动态调整工具按钮的 bottom 位置
- 使用 CSS transition 实现平滑动画

### 3. 节点居中位置调整
**文件**: `src/components/GraphEditor/MindMapCanvas.tsx`

点击节点居中时，需要考虑底部预览卡片的高度：
- 修改 `visualCenterY` 计算
- 当预览卡片打开时，视觉中心往上偏移
- 偏移量约为预览卡片高度的一半

## 涉及文件

1. `src/components/GraphEditor/MindMapCanvas.tsx` - 主要修改

## 任务清单

- [x] Task 1: 禁用移动端预览模式下的 hover 悬浮预览
- [x] Task 2: 动态调整左下角工具按钮位置
- [x] Task 3: 动态调整右下角工具按钮位置
- [x] Task 4: 调整节点居中位置计算
- [x] Task 5: 测试验证
