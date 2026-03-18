# 修复移动端大纲视图顶部按钮被遮挡问题 - 实施计划

## [x] 任务 1: 修复 AI 编写教材时加载状态的顶部间距问题
- **Priority**: P0
- **Depends On**: None
- **Description**: 
  - 修复 `LearningMode.tsx` 中 `isGenerating` 状态下加载组件的顶部间距
  - 在移动端为加载状态添加适当的顶部内边距
- **Success Criteria**:
  - AI 正在编写教材时，加载状态在移动端不会被顶部导航栏遮挡
- **Test Requirements**:
  - `programmatic` TR-1.1: 在移动端浏览器窗口大小下，加载状态组件有适当的顶部间距
  - `human-judgement` TR-1.2: 视觉上加载状态在移动端完全可见，没有被遮挡

## [x] 任务 2: 确保紫色按钮（开始挑战按钮）的可见性
- **Priority**: P0
- **Depends On**: None
- **Description**: 
  - 确保顶部的紫色按钮（"开始挑战"按钮）在移动端完全可见
  - 检查并修复按钮的定位问题
- **Success Criteria**:
  - 紫色按钮在移动端不会被任何元素遮挡
- **Test Requirements**:
  - `programmatic` TR-2.1: 在移动端窗口大小下，紫色按钮完全可见
  - `human-judgement` TR-2.2: 视觉上紫色按钮在移动端完全可见，可以正常点击
