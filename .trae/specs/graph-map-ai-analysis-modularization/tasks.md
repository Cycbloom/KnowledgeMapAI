# Tasks

## 后端服务拆分

- [x] Task 1: 拆分 RelationDiscoveryService 为独立方法
  - [x] SubTask 1.1: 创建 `discoverRelationsOnly` 方法，仅返回关系发现结果（已由原有 discoverRelations 实现）
  - [x] SubTask 1.2: 创建 `analyzeCrossDomainInsights` 方法，仅返回跨学科洞察
  - [x] SubTask 1.3: 创建 `generateLearningPathSuggestions` 方法，仅返回学习路径建议
  - [x] SubTask 1.4: 创建 `analyzeKnowledgeGaps` 方法，仅返回知识缺口分析
  - [x] SubTask 1.5: 保留原有 `discoverRelations` 和 `getIntelligentSuggestions` 方法用于向后兼容

- [x] Task 2: 新增独立API端点
  - [x] SubTask 2.1: 添加 `POST /graphs/cross-domain-insights` 路由
  - [x] SubTask 2.2: 添加 `POST /graphs/learning-path-suggestions` 路由
  - [x] SubTask 2.3: 添加 `POST /graphs/knowledge-gaps` 路由
  - [x] SubTask 2.4: 为新路由添加请求参数验证（Zod schema）
  - [x] SubTask 2.5: 添加错误处理和日志记录

- [x] Task 3: 更新前端API服务
  - [x] SubTask 3.1: 在 `src/services/api/graphs.ts` 添加 `getCrossDomainInsights` 方法
  - [x] SubTask 3.2: 添加 `getLearningPathSuggestions` 方法
  - [x] SubTask 3.3: 添加 `getKnowledgeGaps` 方法
  - [x] SubTask 3.4: 更新 TypeScript 类型定义

## 前端组件重构

- [x] Task 4: 创建模块化分析面板组件
  - [x] SubTask 4.1: 创建 `ModularAnalysisPanel.tsx` 主组件
  - [x] SubTask 4.2: 创建 `AnalysisModuleCard.tsx` 模块卡片组件
  - [x] SubTask 4.3: 创建 `types.ts` 类型定义文件
  - [x] SubTask 4.4: 创建 `AnalysisResultViewer.tsx` 结果查看器组件

- [x] Task 5: 实现模块状态管理
  - [x] SubTask 5.1: 创建 `useAnalysisModules` 自定义 Hook
  - [x] SubTask 5.2: 实现模块状态更新逻辑
  - [x] SubTask 5.3: 实现并行执行控制
  - [x] SubTask 5.4: 实现错误处理和重试机制

- [x] Task 6: 重构 GraphRelationDiscoveryPanel
  - [x] SubTask 6.1: 提取关系发现结果展示为独立组件 `RelationsResultSection.tsx`
  - [x] SubTask 6.2: 提取跨学科洞察展示为独立组件 `CrossDomainInsightsSection.tsx`
  - [x] SubTask 6.3: 提取学习建议展示为独立组件 `LearningSuggestionsSection.tsx`
  - [x] SubTask 6.4: 提取知识缺口展示为独立组件 `KnowledgeGapsSection.tsx`

- [x] Task 7: 更新 GraphMap 主页面
  - [x] SubTask 7.1: 更新状态管理以支持模块化分析
  - [x] SubTask 7.2: 更新工具栏分析按钮交互
  - [x] SubTask 7.3: 集成新的模块化分析面板
  - [x] SubTask 7.4: 保持与现有功能的兼容性

- [x] Task 8: 更新 GraphMapToolbar
  - [x] SubTask 8.1: 更新"智能分析"按钮打开模块选择面板
  - [x] SubTask 8.2: 添加分析状态指示器
  - [x] SubTask 8.3: 优化移动端分析入口交互

## 测试与验证

- [x] Task 9: 类型检查验证
  - [x] SubTask 9.1: 运行 `npm run check` 验证 TypeScript 类型
  - [x] SubTask 9.2: 验证前后端类型一致性
  - [x] SubTask 9.3: 验证组件 Props 类型正确

- [x] Task 10: 功能验证
  - [x] SubTask 10.1: 验证模块选择和执行流程设计正确
  - [x] SubTask 10.2: 验证渐进式结果展示设计正确
  - [x] SubTask 10.3: 验证错误处理机制设计正确
  - [x] SubTask 10.4: 验证移动端适配设计正确

---

# Task Dependencies

- Task 2 依赖 Task 1（API端点需要Service方法）
- Task 3 依赖 Task 2（前端API需要后端端点）
- Task 5 依赖 Task 3（状态管理需要前端API）
- Task 6 依赖 Task 4（组件重构需要新组件）
- Task 7 依赖 Task 4, Task 5, Task 6（主页面集成需要所有组件）
- Task 8 依赖 Task 7（工具栏更新需要主页面状态）
- Task 9, Task 10 依赖所有实现任务完成

# Parallelizable Work

以下任务可以并行执行：
- Task 1 和 Task 4（后端和前端组件可并行开发）
- Task 2.1, Task 2.2, Task 2.3（独立API端点可并行开发）
- Task 4.1, Task 4.2, Task 4.3, Task 4.4（独立组件可并行开发）
- Task 6.1, Task 6.2, Task 6.3, Task 6.4（结果展示组件可并行开发）
