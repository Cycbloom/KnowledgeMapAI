# Tasks

- [x] Task 1: 创建统一的 AI 语言管理模块
  - [x] SubTask 1.1: 创建 `src/hooks/useAILanguage.ts`，实现 `useAILanguage` Hook
  - [x] SubTask 1.2: 实现 `getAILanguage()` 工具函数（供非组件使用）
  - [x] SubTask 1.3: 实现 `isEnglishLanguage(language?: string)` 工具函数
  - [x] SubTask 1.4: 导出统一的接口

- [x] Task 2: 重构 API 服务层
  - [x] SubTask 2.1: 修改 `src/services/api/ai.ts`，删除 `getCurrentLanguage` 函数，使用 `getAILanguage()`
  - [x] SubTask 2.2: 修改 `src/services/api/autoGraph.ts`，删除 `getCurrentAILanguage` 函数，使用 `getAILanguage()`
  - [x] SubTask 2.3: 修改 `src/services/mobile/ai.ts`，删除 `getCurrentLanguage` 函数，使用 `getAILanguage()`

- [x] Task 3: 重构 React 组件
  - [x] SubTask 3.1: 修改 `src/pages/LearningMode.tsx`，使用 `useAILanguage()` Hook 简化语言获取逻辑

- [x] Task 4: 验证和测试
  - [x] SubTask 4.1: 运行 `npm run lint` 检查代码规范
  - [x] SubTask 4.2: 运行 `npm run check` 检查类型
  - [x] SubTask 4.3: 测试所有 AI 生成功能，确保语言设置正确

# Task Dependencies
- [Task 2] depends on [Task 1]（需要先创建统一的工具函数）
- [Task 3] depends on [Task 1]（需要先创建 Hook）
- [Task 4] depends on [Task 2, Task 3]（需要先完成重构）
