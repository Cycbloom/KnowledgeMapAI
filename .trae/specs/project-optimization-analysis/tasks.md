# Tasks - 项目优化机会分析

## 阶段一：补充测试覆盖

- [ ] Task 1: 完成 AI 测验生成 E2E 测试
  - [ ] 编写测验集合创建测试
  - [ ] 编写测验生成流程测试
  - [ ] 编写测验练习流程测试
  - [ ] 运行测试验证通过

- [ ] Task 2: 完成学习路径功能 E2E 测试
  - [ ] 编写学习路径创建测试
  - [ ] 编写 AI 生成路径测试
  - [ ] 编写学习节点转任务测试
  - [ ] 编写进度同步测试
  - [ ] 运行测试验证通过

- [ ] Task 3: 完成 Prompt 配置功能验收测试
  - [ ] 验证 QuizGenerationModal prompt 配置按钮
  - [ ] 验证 QuickCreateGraphPanel prompt 配置按钮
  - [ ] 验证 PromptConfigPanel 场景列表显示
  - [ ] 验证 prompt 配置保存和加载
  - [ ] 编写 E2E 测试覆盖

## 阶段二：Hooks 组织优化

- [x] Task 4: 创建 Hooks 子目录结构
  - [x] 创建 scheduler/ 目录
  - [x] 创建 common/ 目录

- [x] Task 5: 移动调度器相关 Hooks
  - [x] 移动 useScheduler.ts 到 scheduler/
  - [x] 移动 useSchedulerHotkeys.ts 到 scheduler/
  - [x] 移动 useTaskEvents.ts 到 scheduler/
  - [x] 创建 scheduler/index.ts 导出

- [x] Task 6: 移动图谱编辑器相关 Hooks
  - [x] 移动 useCombinedGraphAIOperations.ts 到 graphAI/
  - [x] 移动 useGraphAIOperations.ts 到 graphAI/
  - [x] 移动图谱相关 hooks 到 graphEditor/
  - [x] 更新 graphAI/index.ts 和 graphEditor/index.ts 导出

- [x] Task 7: 移动通用 Hooks 到 common/
  - [x] 移动 useError.ts
  - [x] 移动 useErrorHandler.ts
  - [x] 移动 useNetworkStatus.ts
  - [x] 移动 useNetworkStatusEnhanced.ts
  - [x] 移动 usePerformance.ts
  - [x] 移动 useSearch.ts
  - [x] 移动 useIntersectionObserver.ts
  - [x] 移动 useIsMobile.ts
  - [x] 移动 useVirtualScroll.ts
  - [x] 移动 useKeyboardShortcuts.tsx
  - [x] 移动 useGlobalShortcuts.tsx
  - [x] 移动 useHistory.ts
  - [x] 移动 useLocalSnapshot.ts
  - [x] 移动 useTheme.ts
  - [x] 移动 useSpeechRecognition.ts
  - [x] 移动 useTextToSpeech.ts
  - [x] 移动 useTopicCheck.ts
  - [x] 移动 useTutorOperations.ts
  - [x] 移动 useWorker.ts
  - [x] 创建 common/index.ts 导出

- [x] Task 8: 更新 Hooks 导入路径
  - [x] 更新 src/pages/ 中的导入
  - [x] 更新 src/components/ 中的导入
  - [x] 更新 hooks 间的相互导入
  - [x] 更新 src/hooks/index.ts 主导出

- [x] Task 9: 验证 Hooks 重组
  - [x] 运行类型检查 (npm run check)
  - [x] 运行代码检查 (npm run lint)
  - [ ] 运行测试验证功能正常

## 阶段三：Store 状态管理优化

- [ ] Task 10: 统一 Store 命名
  - [ ] 将 useStore.ts 重命名为 useAuthStore.ts
  - [ ] 更新所有导入路径
  - [ ] 验证功能正常

- [ ] Task 11: 建立状态管理规范
  - [ ] 创建状态管理规范文档
  - [ ] 定义 Store 划分规则
  - [ ] 定义命名规范

## 阶段四：路由文件组织优化

- [ ] Task 12: 创建路由子目录结构
  - [ ] 创建 graph/ 目录
  - [ ] 创建 study/ 目录
  - [ ] 创建 achievement/ 目录
  - [ ] 创建 core/ 目录
  - [ ] 创建 data/ 目录
  - [ ] 创建 view/ 目录
  - [ ] 创建 notification/ 目录

- [ ] Task 13: 移动图谱相关路由
  - [ ] 移动 graphs.ts 到 graph/
  - [ ] 移动 nodes.ts 到 graph/
  - [ ] 移动 knowledgePoints.ts 到 graph/
  - [ ] 移动 graphRelations.ts 到 graph/
  - [ ] 移动 relationshipTypes.ts 到 graph/
  - [ ] 移动 autoGraph.ts 到 graph/
  - [ ] 创建 graph/index.ts 导出

- [ ] Task 14: 移动学习相关路由
  - [ ] 移动 study.ts 到 study/
  - [ ] 移动 learningPath.ts 到 study/
  - [ ] 移动 learningPaths.ts 到 study/
  - [ ] 移动 quizSets.ts 到 study/
  - [ ] 创建 study/index.ts 导出

- [ ] Task 15: 移动其他路由文件
  - [ ] 移动成就相关路由到 achievement/
  - [ ] 移动核心路由到 core/
  - [ ] 移动数据路由到 data/
  - [ ] 移动视图路由到 view/
  - [ ] 移动通知路由到 notification/
  - [ ] 移动 AI 相关路由到 ai/

- [ ] Task 16: 更新路由注册
  - [ ] 更新 app.ts 中的路由导入
  - [ ] 更新路由注册路径
  - [ ] 验证 API 路由正常

- [ ] Task 17: 验证路由重组
  - [ ] 运行类型检查 (npm run check)
  - [ ] 运行代码检查 (npm run lint)
  - [ ] 运行 API 测试验证功能正常

---

# Task Dependencies

- Task 5-7 依赖 Task 4（需要先创建目录结构）
- Task 8 依赖 Task 5-7（需要 hooks 移动完成）
- Task 9 依赖 Task 8（需要导入路径更新完成）
- Task 10 可以独立执行
- Task 13-15 依赖 Task 12（需要先创建目录结构）
- Task 16 依赖 Task 13-15（需要路由文件移动完成）
- Task 17 依赖 Task 16（需要路由注册更新完成）
- Task 1-3 可以并行执行（测试补充）
- Task 4-9 可以并行执行（Hooks 优化）
- Task 12-17 可以并行执行（路由优化）
