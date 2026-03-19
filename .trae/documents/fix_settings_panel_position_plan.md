# 修复学习设置面板定位问题 - 实施计划

## 问题分析
学习设置面板 (`LearningSettingsPanel`) 当前显示在屏幕右下角，而不是居中显示。

## [x] 任务 1: 修复 LearningSettingsPanel 组件的定位
- **Priority**: P0
- **Depends On**: None
- **Description**: 
  - 检查并修复 `LearningSettingsPanel` 组件的定位逻辑
  - 确保模态框正确居中显示
  - 验证动画和定位属性的兼容性
- **Success Criteria**:
  - 设置面板在屏幕中央正确显示
  - 动画效果正常工作
- **Test Requirements**:
  - `programmatic` TR-1.1: 检查组件的 className 属性是否正确设置为居中定位 ✓
  - `human-judgement` TR-1.2: 手动验证面板在浏览器中是否居中显示

## [x] 任务 2: 验证修复效果
- **Priority**: P1
- **Depends On**: 任务 1
- **Description**: 
  - 打开学习模式页面
  - 点击设置按钮
  - 验证面板是否居中显示
- **Success Criteria**:
  - 设置面板在所有屏幕尺寸下都正确居中
- **Test Requirements**:
  - `human-judgement` TR-2.1: 在浏览器中实际测试，验证面板居中显示 ✓
