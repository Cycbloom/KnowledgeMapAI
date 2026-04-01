# Checklist

## Phase 1: Agent工具扩展

- [x] `get_domain_distribution` 工具实现正确，返回领域分布统计
- [x] `get_graph_overview` 工具实现正确
- [x] `get_graph_nodes` 工具实现正确
- [x] `get_graph_relations` 工具实现正确
- [x] `get_isolated_graphs` 工具实现正确
- [x] `get_knowledge_coverage` 工具实现正确
- [x] `analyze_merge_candidates` 工具实现正确

### 分析工具
- [x] `get_domain_distribution` 工具实现正确，返回领域分布统计
- [x] `get_learning_paths` 工具实现正确
- [x] `get_study_progress` 工具实现正确
- [x] `analyze_difficulty` 工具实现正确
- [x] `get_prerequisite_chain` 工具实现正确
- [x] `get_extension_suggestions` 工具实现正确

### 学习分析工具
- [x] `get_study_progress` 工具实现正确
- [x] `analyze_difficulty` 工具实现正确
- [x] `get_graph_tags` 工具实现正确
- [x] `get_node_relations` 工具实现正确

### 节点分析工具
- [x] `get_graph_tags` 工具实现正确
- [x] `get_node_relations` 工具实现正确

### 合并建议整合
- [x] `analyze_merge_candidates` 工具实现正确
- [x] `MergeSuggestionsSection.tsx` 组件正确展示合并建议

- [x] `MergeSuggestionsSection` 组件已正确集成到 Agent分析面板

### 工具注册
- [ ] 新工具已正确导出
- [ ] 新工具已在AgentService中注册
- [ ] 工具类型定义完整

## Phase 2: Agent自主调用机制

### 工具选择策略
- [ ] `AnalysisGoal` 类型定义正确
- [ ] 知识完整性分析策略实现正确
- [ ] 关系发现策略实现正确
- [ ] 学习优化策略实现正确

### AgentService增强
- [ ] `executeWithAutonomy` 方法正常工作
- [ ] `needsSecondaryAnalysis` 判断逻辑正确
- [ ] `identifyDepthTargets` 正确识别深度分析目标
- [ ] `executeToolSet` 正确执行工具集
- [ ] `executeDepthAnalysis` 正确执行深度分析

### Skills更新
- [ ] `island_detection` Skill使用新工具正常
- [ ] `relation_recommendation` Skill使用新工具正常
- [ ] `learning_path` Skill使用新工具正常
- [ ] `knowledge_gaps` Skill使用新工具正常
- [ ] `knowledge_completeness` Skill正常工作
- [ ] `merge_analysis` Skill正常工作

## Phase 3: 模块整合与移除

### 基础分析移除
- [ ] `MapAnalysisPanel.tsx` 已删除
- [ ] `GraphMap.tsx` 中基础分析状态已移除
- [ ] `onAnalyze` 回调已移除
- [ ] `MapAnalysisResult` 类型已移除
- [ ] 无残留引用

### 分析入口更新
- [ ] 分析按钮逻辑正确
- [ ] 分析模式选择面板显示正常
- [ ] 快速分析模式正常工作
- [ ] 深度分析模式正常工作
- [ ] 自定义分析模式正常工作

### 合并建议整合
- [ ] Agent分析面板显示合并建议
- [ ] `MergeSuggestionsSection` 组件正常工作
- [ ] 合并操作正常执行
- [ ] 关联操作正常执行
- [ ] 忽略操作正常执行

## Phase 4: 智能分析优化

### 面板优化
- [ ] "一键快速分析"按钮正常工作
- [ ] 用户偏好保存功能正常
- [ ] 多模块结果整合展示正确
- [ ] "传递给Agent深度分析"按钮正常

### 分析结果联动
- [ ] 分析结果共享状态正确
- [ ] 快速分析结果可传递给Agent
- [ ] Agent基于快速分析结果优化工具选择

## Phase 5: API更新与测试

### API路由
- [ ] `POST /agent/sessions/:id/autonomous` 路由正常工作
- [ ] `GET /agent/tools` 路由返回工具列表
- [ ] 前端API服务更新正确

### 代码质量
- [ ] TypeScript 类型检查通过
- [ ] ESLint 检查通过
- [ ] 无类型错误
- [ ] 无lint警告

### 功能验证
- [ ] 所有新工具可正常调用
- [ ] Agent自主调用机制正常工作
- [ ] 分析入口切换流畅
- [ ] 合并建议功能完整
- [ ] 快速分析与Agent联动正常

## 用户体验

### 分析流程
- [ ] 用户可清晰理解分析模式区别
- [ ] 快速分析响应时间在预期范围内
- [ ] 深度分析结果有价值
- [ ] 自定义分析灵活可用

### 结果展示
- [ ] 分析结果清晰易懂
- [ ] 建议可执行
- [ ] 操作反馈及时

### 兼容性
- [ ] 与现有功能无冲突
- [ ] 移动端适配正常
- [ ] 暗色模式显示正常
