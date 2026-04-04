# Tasks

## Phase 1: 确认步骤实现

- [x] Task 1: 创建分析确认面板组件
  - [x] SubTask 1.1: 创建 `AnalysisConfirmPanel.tsx` 组件
  - [x] SubTask 1.2: 实现分析类型显示（快速/深度/自定义）
  - [x] SubTask 1.3: 实现分析范围显示（全部/选中图谱列表）
  - [x] SubTask 1.4: 实现 TOKEN 消耗预估显示
  - [x] SubTask 1.5: 实现确认和取消按钮

- [x] Task 2: 实现 TOKEN 预估逻辑
  - [x] SubTask 2.1: 创建 `estimateTokenConsumption` 函数
  - [x] SubTask 2.2: 根据分析类型和图谱数量计算消耗
  - [x] SubTask 2.3: 提供最小和最大消耗范围

- [x] Task 3: 更新 AgentAnalysisPanel 状态管理
  - [x] SubTask 3.1: 添加 `step` 状态（select/confirm/execute）
  - [x] SubTask 3.2: 添加 `confirmState` 状态存储确认信息
  - [x] SubTask 3.3: 修改 SkillSelector 点击逻辑为进入确认步骤

## Phase 2: 自定义分析功能

- [x] Task 4: 实现自定义分析输入界面
  - [x] SubTask 4.1: 创建 `CustomAnalysisInput.tsx` 组件
  - [x] SubTask 4.2: 实现多行文本输入框
  - [x] SubTask 4.3: 添加输入提示和示例
  - [x] SubTask 4.4: 实现输入内容验证（非空检查）

- [x] Task 5: 集成自定义分析到确认流程
  - [x] SubTask 5.1: 自定义分析模式下显示输入界面
  - [x] SubTask 5.2: 将用户输入传递到 AgentService
  - [x] SubTask 5.3: 更新 system prompt 支持自定义目标

## Phase 3: 数据范围限制

- [x] Task 6: 更新 AgentService 传递 graphIds
  - [x] SubTask 6.1: 确保 `context.graphIds` 正确传递到工具
  - [x] SubTask 6.2: 更新 `getUserPrompt` 方法使用 graphIds

- [x] Task 7: 更新工具支持 graphIds 参数
  - [x] SubTask 7.1: 更新 `get_graph_overview` 工具使用 graphIds
  - [x] SubTask 7.2: 更新 `get_graph_relations` 工具使用 graphIds
  - [x] SubTask 7.3: 更新 `get_isolated_graphs` 工具使用 graphIds
  - [x] SubTask 7.4: 更新其他相关工具

- [x] Task 8: 添加未选中图谱的警告提示
  - [x] SubTask 8.1: 检测是否选中图谱
  - [x] SubTask 8.2: 未选中时显示警告信息
  - [x] SubTask 8.3: 提供继续分析全部图谱的选项

## Phase 4: 分析模式差异化

- [x] Task 9: 实现快速分析模式优化
  - [x] SubTask 9.1: 快速分析只调用概览工具
  - [x] SubTask 9.2: 限制快速分析的输出长度
  - [x] SubTask 9.3: 优化快速分析的 prompt

- [x] Task 10: 实现深度分析模式优化
  - [x] SubTask 10.1: 深度分析支持获取详细信息
  - [x] SubTask 10.2: 深度分析支持多轮工具调用
  - [x] SubTask 10.3: 深度分析输出详细报告

## Phase 5: 验证和测试

- [x] Task 11: 代码检查
  - [x] SubTask 11.1: 运行 `npm run check` 验证 TypeScript 类型
  - [x] SubTask 11.2: 运行 `npm run lint` 验证代码风格

- [x] Task 12: 功能验证
  - [x] SubTask 12.1: 验证快速分析确认流程
  - [x] SubTask 12.2: 验证深度分析确认流程
  - [x] SubTask 12.3: 验证自定义分析输入和执行
  - [x] SubTask 12.4: 验证选中图谱时数据范围限制
  - [x] SubTask 12.5: 验证 TOKEN 预估显示

---

# Task Dependencies

- Task 2 依赖 Task 1（确认面板需要预估函数）
- Task 3 依赖 Task 1 和 Task 2（状态管理需要确认面板组件）
- Task 5 依赖 Task 4（集成需要输入组件）
- Task 7 依赖 Task 6（工具更新需要 Service 传递参数）
- Task 9-10 依赖 Task 6-7（模式优化需要数据范围限制）
- Task 11-12 依赖所有实现任务完成

# Parallelizable Work

以下任务可以并行执行：
- Task 1, Task 2, Task 4（UI 组件和工具函数可并行开发）
- Task 6, Task 7（Service 和工具更新可并行开发）
- Task 9, Task 10（不同分析模式优化可并行开发）

# 实施建议

建议分阶段实施：
1. **Phase 1**：实现确认步骤，解决用户最迫切的需求（点击后立即执行的问题）
2. **Phase 2**：实现自定义分析功能
3. **Phase 3**：优化数据范围限制，减少 TOKEN 消耗
4. **Phase 4**：进一步优化各分析模式的差异化
5. **Phase 5**：验证和测试

每个阶段完成后可独立交付使用。
