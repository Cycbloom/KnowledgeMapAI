# Tasks

## 提示词场景定义

- [x] Task 1: 添加分析模块提示词场景
  - [x] SubTask 1.1: 在 `promptScenarios.tsx` 中添加 `relation_discovery` 场景定义
  - [x] SubTask 1.2: 添加 `cross_domain_insights` 场景定义
  - [x] SubTask 1.3: 添加 `learning_path_suggestions` 场景定义
  - [x] SubTask 1.4: 添加 `knowledge_gaps` 场景定义
  - [x] SubTask 1.5: 更新 `PromptScenario` 类型，添加 `analysis` 类别

## 组件更新

- [x] Task 2: 更新 AnalysisModuleCard 组件
  - [x] SubTask 2.1: 添加 `onEditPrompt` 回调 prop
  - [x] SubTask 2.2: 添加"编辑提示词"图标按钮（Settings 图标）
  - [x] SubTask 2.3: 按钮样式与现有设计保持一致

- [x] Task 3: 更新 ModularAnalysisPanel 组件
  - [x] SubTask 3.1: 添加 `editingPromptModule` 状态
  - [x] SubTask 3.2: 导入并集成 `PromptEditor` 组件
  - [x] SubTask 3.3: 实现 `handleSavePrompt` 保存逻辑
  - [x] SubTask 3.4: 实现 `handleResetPrompt` 重置逻辑
  - [x] SubTask 3.5: 实现 `getPromptContent` 获取当前提示词
  - [x] SubTask 3.6: 添加提示词编辑模态框或内嵌编辑区域

- [x] Task 4: 更新类型定义
  - [x] SubTask 4.1: 在 `types.ts` 中添加 `AnalysisModuleCardProps` 的 `onEditPrompt` 属性
  - [x] SubTask 4.2: 添加提示词相关的类型定义

## Hook 更新

- [x] Task 5: 更新 useAnalysisModules Hook
  - [x] SubTask 5.1: 添加 `getPromptContent` 方法获取模块提示词
  - [x] SubTask 5.2: 添加 `savePrompt` 方法保存提示词
  - [x] SubTask 5.3: 添加 `resetPrompt` 方法重置提示词
  - [x] SubTask 5.4: 执行分析时使用自定义提示词

## 验证

- [x] Task 6: 类型检查和代码检查
  - [x] SubTask 6.1: 运行 `npm run check` 验证 TypeScript 类型
  - [x] SubTask 6.2: 运行 `npm run lint` 验证代码风格

---

# Task Dependencies

- Task 2 依赖 Task 1（组件需要场景定义）
- Task 3 依赖 Task 2（面板需要组件更新）
- Task 5 依赖 Task 1（Hook 需要场景定义）
- Task 6 依赖所有实现任务完成

# Parallelizable Work

以下任务可以并行执行：
- Task 1 和 Task 4（场景定义和类型定义可并行）
- Task 2 和 Task 5（组件更新和 Hook 更新可并行）
