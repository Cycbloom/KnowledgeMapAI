# Tasks

## Phase 1: Agent工具扩展

- [x] Task 1: 创建分析工具模块
  - [x] SubTask 1.1: 创建 `api/services/agent/tools/analysisTools.ts` 文件
  - [x] SubTask 1.2: 实现 `get_domain_distribution` 工具
  - [x] SubTask 1.3: 实现 `analyze_graph_structure` 工具
  - [x] SubTask 1.4: 实现 `get_learning_paths` 工具
  - [x] SubTask 1.5: 实现 `get_similar_graphs` 工具
  - [x] SubTask 1.6: 实现 `get_knowledge_coverage` 工具
  - [x] SubTask 1.7: 实现 `analyze_merge_candidates` 工具

- [x] Task 2: 创建学习分析工具
  - [x] SubTask 2.1: 创建 `api/services/agent/tools/learningTools.ts` 文件
  - [x] SubTask 2.2: 实现 `get_study_progress` 工具
  - [x] SubTask 2.3: 实现 `analyze_difficulty` 工具
  - [x] SubTask 2.4: 实现 `get_prerequisite_chain` 工具
  - [x] SubTask 2.5: 实现 `get_extension_suggestions` 工具

- [x] Task 3: 创建节点分析工具
  - [x] SubTask 3.1: 创建 `api/services/agent/tools/nodeTools.ts` 文件
  - [x] SubTask 3.2: 实现 `get_graph_tags` 工具
  - [x] SubTask 3.3: 实现 `get_node_relations` 工具

- [x] Task 4: 更新工具注册
  - [x] SubTask 4.1: 更新 `api/services/agent/tools/index.ts` 导出新工具
  - [x] SubTask 4.2: 在 `AgentService` 构造函数中注册新工具
  - [x] SubTask 4.3: 更新 `types.ts` 添加新工具类型定义

## Phase 2: Agent自主调用机制

- [x] Task 5: 实现工具选择策略
  - [x] SubTask 5.1: 创建 `api/services/agent/strategies/ToolSelectionStrategy.ts`
  - [x] SubTask 5.2: 定义分析目标类型 `AnalysisGoal`
  - [x] SubTask 5.3: 实现知识完整性分析策略
  - [x] SubTask 5.4: 实现关系发现策略
  - [x] SubTask 5.5: 实现学习优化策略

- [x] Task 6: 增强AgentService
  - [x] SubTask 6.1: 添加 `executeWithAutonomy` 方法
  - [x] SubTask 6.2: 实现 `needsSecondaryAnalysis` 判断逻辑
  - [x] SubTask 6.3: 实现 `identifyDepthTargets` 深度分析目标识别
  - [x] SubTask 6.4: 实现 `executeToolSet` 工具集执行方法
  - [x] SubTask 6.5: 实现 `executeDepthAnalysis` 深度分析方法

- [x] Task 7: 更新Skills定义
  - [x] SubTask 7.1: 更新 `island_detection` Skill使用新工具
  - [x] SubTask 7.2: 更新 `relation_recommendation` Skill使用新工具
  - [x] SubTask 7.3: 更新 `learning_path` Skill使用新工具
  - [x] SubTask 7.4: 更新 `knowledge_gaps` Skill使用新工具
  - [x] SubTask 7.5: 新增 `knowledge_completeness` Skill
  - [x] SubTask 7.6: 新增 `merge_analysis` Skill

## Phase 3: 模块整合与移除

- [x] Task 8: 移除基础分析模块
  - [x] SubTask 8.1: 删除 `src/components/GraphMap/MapAnalysisPanel.tsx`
  - [x] SubTask 8.2: 从 `GraphMap.tsx` 移除基础分析相关状态
  - [x] SubTask 8.3: 从 `GraphMap.tsx` 移除 `onAnalyze` 回调
  - [x] SubTask 8.4: 移除 `types.ts` 中的 `MapAnalysisResult` 类型

- [x] Task 9: 更新分析入口
  - [x] SubTask 9.1: 更新 `GraphMapToolbar.tsx` 分析按钮逻辑
  - [x] SubTask 9.2: 实现分析模式选择面板 `AnalysisModeSelector`
  - [x] SubTask 9.3: 更新工具栏Props移除 `onAnalyze`
  - [x] SubTask 9.4: 添加分析模式状态管理

- [x] Task 10: 整合合并建议功能
  - [x] SubTask 10.1: 在 `AgentAnalysisPanel` 添加合并建议展示
  - [x] SubTask 10.2: 创建 `MergeSuggestionsSection.tsx` 组件
  - [x] SubTask 10.3: 实现合并建议的交互操作（合并/关联/忽略）
  - [x] SubTask 10.4: 添加合并建议的后端API支持

## Phase 4: 智能分析优化

- [ ] Task 11: 优化智能分析面板
  - [ ] SubTask 11.1: 添加"一键快速分析"按钮
  - [ ] SubTask 11.2: 实现用户偏好保存功能
  - [ ] SubTask 11.3: 优化结果展示，整合多模块结果
  - [ ] SubTask 11.4: 添加"传递给Agent深度分析"按钮

- [ ] Task 12: 实现分析结果联动
  - [ ] SubTask 12.1: 创建分析结果共享状态
  - [ ] SubTask 12.2: 实现快速分析结果传递给Agent
  - [ ] SubTask 12.3: Agent基于快速分析结果优化工具选择

## Phase 5: API更新与测试

- [ ] Task 13: 更新API路由
  - [ ] SubTask 13.1: 添加 `POST /agent/sessions/:id/autonomous` 路由
  - [ ] SubTask 13.2: 添加 `GET /agent/tools` 路由获取工具列表
  - [ ] SubTask 13.3: 更新前端API服务 `src/services/api/agent.ts`

- [ ] Task 14: 类型检查与代码质量
  - [ ] SubTask 14.1: 运行 `npm run check` 验证TypeScript类型
  - [ ] SubTask 14.2: 运行 `npm run lint` 验证代码风格
  - [ ] SubTask 14.3: 修复所有类型错误和lint警告

- [ ] Task 15: 功能验证
  - [ ] SubTask 15.1: 验证所有新工具正常工作
  - [ ] SubTask 15.2: 验证Agent自主调用机制正常
  - [ ] SubTask 15.3: 验证分析入口切换正常
  - [ ] SubTask 15.4: 验证合并建议功能正常
  - [ ] SubTask 15.5: 验证快速分析与Agent联动正常

---

# Task Dependencies

- Task 4 依赖 Task 1, Task 2, Task 3（工具注册需要所有工具实现）
- Task 5 依赖 Task 4（策略需要工具定义）
- Task 6 依赖 Task 5（自主调用需要策略）
- Task 7 依赖 Task 6（Skills更新需要自主调用机制）
- Task 8 依赖 Task 7（移除基础分析需要Agent功能完善）
- Task 9 依赖 Task 8（入口更新需要移除旧模块）
- Task 10 依赖 Task 7（合并建议需要Agent工具支持）
- Task 11 依赖 Task 9（优化需要新入口）
- Task 12 依赖 Task 11（联动需要优化完成）
- Task 13 依赖 Task 6（API需要自主调用机制）
- Task 14, Task 15 依赖所有实现任务完成

# Parallelizable Work

以下任务可以并行执行：
- Task 1, Task 2, Task 3（不同工具模块可并行开发）
- Task 8 和 Task 10（移除和整合可并行）
- Task 11 和 Task 13（前端优化和API更新可并行）

# 实施建议

建议按阶段实施：
1. **Phase 1**：先扩展工具集，不影响现有功能
2. **Phase 2**：实现自主调用机制，增强Agent能力
3. **Phase 3**：整合模块，移除冗余功能
4. **Phase 4**：优化用户体验
5. **Phase 5**：全面测试验证

每个阶段完成后可独立验证，降低风险。
