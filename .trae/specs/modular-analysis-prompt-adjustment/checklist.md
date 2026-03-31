# Checklist

## 提示词场景定义

- [x] `relation_discovery` 场景定义正确，包含完整的变量和默认模板
- [x] `cross_domain_insights` 场景定义正确，包含完整的变量和默认模板
- [x] `learning_path_suggestions` 场景定义正确，包含完整的变量和默认模板
- [x] `knowledge_gaps` 场景定义正确，包含完整的变量和默认模板
- [x] 所有场景都设置了 `category: 'analysis'`

## 组件更新

- [x] `AnalysisModuleCard` 正确显示"编辑提示词"按钮
- [x] 按钮样式与现有设计一致
- [x] 点击按钮正确触发 `onEditPrompt` 回调

## 面板集成

- [x] `ModularAnalysisPanel` 正确集成 `PromptEditor` 组件
- [x] 提示词编辑器显示当前模块的提示词内容
- [x] 可用变量列表正确显示
- [x] 保存功能正常工作
- [x] 重置功能正常工作

## 类型定义

- [x] `AnalysisModuleCardProps` 包含 `onEditPrompt` 属性
- [x] 提示词相关类型定义完整

## Hook 功能

- [x] `getPromptContent` 方法正确获取模块提示词
- [x] `savePrompt` 方法正确保存提示词
- [x] `resetPrompt` 方法正确重置提示词
- [x] 执行分析时使用自定义提示词

## 用户体验

- [x] UI 风格与现有 `PromptConfigPanel` 一致
- [x] 提示词保存后显示成功提示
- [x] 提示词重置后显示成功提示
- [x] 编辑器支持变量插入功能
- [x] 编辑器支持 AI 智能优化功能

## 代码质量

- [x] TypeScript 类型检查通过
- [x] ESLint 检查通过
