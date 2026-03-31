# Tasks

## Phase 1: 智能选择功能

- [x] Task 1: 实现多选功能增强
  - [x] SubTask 1.1: 扩展 `multiSelectedGraphIds` 支持不限数量选择
  - [x] SubTask 1.2: 添加选择状态视觉反馈（高亮、边框）
  - [x] SubTask 1.3: 实现Ctrl/Cmd+点击多选
  - [x] SubTask 1.4: 实现Shift+点击范围选择

- [x] Task 2: 实现框选功能
  - [x] SubTask 2.1: 在 GraphMapCanvas 添加拖拽选择框
  - [x] SubTask 2.2: 计算选择框与图谱节点的碰撞检测
  - [x] SubTask 2.3: 选中框内所有图谱
  - [x] SubTask 2.4: 显示框选结果面板

- [x] Task 3: 实现关联选择
  - [x] SubTask 3.1: 添加右键菜单"选择关联图谱"
  - [x] SubTask 3.2: 查询与当前图谱有关系的所有图谱
  - [x] SubTask 3.3: 批量选中关联图谱

- [x] Task 4: 实现批量操作面板
  - [x] SubTask 4.1: 创建 `BatchOperationPanel.tsx` 组件
  - [x] SubTask 4.2: 实现批量创建关系功能
  - [x] SubTask 4.3: 实现批量分析功能
  - [x] SubTask 4.4: 实现批量删除功能

## Phase 2: Agent工具系统

- [x] Task 5: 创建Agent服务基础架构
  - [x] SubTask 5.1: 创建 `api/services/agent/` 目录结构
  - [x] SubTask 5.2: 实现 `AgentService.ts` 核心类
  - [x] SubTask 5.3: 实现 `ToolRegistry.ts` 工具注册表
  - [x] SubTask 5.4: 实现会话管理逻辑

- [x] Task 6: 实现图谱工具
  - [x] SubTask 6.1: 实现 `get_graph_overview` 工具
  - [x] SubTask 6.2: 实现 `get_graph_details` 工具
  - [x] SubTask 6.3: 实现 `get_graph_nodes` 工具
  - [x] SubTask 6.4: 实现 `get_graph_relations` 工具
  - [x] SubTask 6.5: 实现 `search_graphs` 工具
  - [x] SubTask 6.6: 实现 `get_isolated_graphs` 工具
  - [x] SubTask 6.7: 实现 `get_domain_distribution` 工具
  - [x] SubTask 6.8: 实现 `analyze_graph_structure` 工具
  - [x] SubTask 6.9: 实现 `get_learning_paths` 工具

- [x] Task 7: 创建Agent API路由
  - [x] SubTask 7.1: 创建 `api/routes/agent.ts`
  - [x] SubTask 7.2: 实现 `POST /sessions` 创建会话
  - [x] SubTask 7.3: 实现 `POST /sessions/:id/execute` 执行分析
  - [x] SubTask 7.4: 实现 `GET /sessions/:id/stream` SSE流式返回
  - [x] SubTask 7.5: 实现 `POST /sessions/:id/interrupt` 用户干预

- [x] Task 8: 创建前端Agent API
  - [x] SubTask 8.1: 创建 `src/services/api/agent.ts`
  - [x] SubTask 8.2: 实现会话创建和管理方法
  - [x] SubTask 8.3: 实现SSE连接和消息处理

## Phase 3: Agent分析界面

- [x] Task 9: 创建Agent分析面板
  - [x] SubTask 9.1: 创建 `AgentAnalysisPanel.tsx` 主组件
  - [x] SubTask 9.2: 创建 `SkillSelector.tsx` Skill选择器
  - [x] SubTask 9.3: 创建 `SessionLog.tsx` 会话日志组件
  - [x] SubTask 9.4: 创建 `ToolCallCard.tsx` 工具调用卡片
  - [x] SubTask 9.5: 创建 `AnalysisResultView.tsx` 结果展示组件

- [x] Task 10: 实现预定义Skills
  - [x] SubTask 10.1: 实现"知识孤岛检测"Skill
  - [x] SubTask 10.2: 实现"学习路径规划"Skill
  - [x] SubTask 10.3: 实现"跨领域发现"Skill
  - [x] SubTask 10.4: 实现"知识缺口分析"Skill
  - [x] SubTask 10.5: 实现"关系推荐"Skill

- [x] Task 11: 集成到图谱地图
  - [x] SubTask 11.1: 在工具栏添加"Agent分析"入口
  - [x] SubTask 11.2: 支持选中图谱后启动针对性分析
  - [x] SubTask 11.3: 实现分析结果与图谱的交互联动

## Phase 4: 组内分析功能（可选扩展）

- [ ] Task 12: 实现组内分析
  - [ ] SubTask 12.1: 添加"组内分析"菜单项
  - [ ] SubTask 12.2: 实现组内知识点关联分析
  - [ ] SubTask 12.3: 生成组内知识网络图
  - [ ] SubTask 12.4: 推荐跨图谱知识点关系

## 验证

- [x] Task 13: 代码检查
  - [x] SubTask 13.1: 运行 `npm run check` 验证 TypeScript 类型
  - [x] SubTask 13.2: 运行 `npm run lint` 验证代码风格

---

# Task Dependencies

- Task 2-4 依赖 Task 1（选择功能是基础）
- Task 7 依赖 Task 5-6（API需要服务和工具）
- Task 8 依赖 Task 7（前端API需要后端API）
- Task 9-11 依赖 Task 8（界面需要前端API）
- Task 12 依赖 Task 1-4 和 Task 9-11（组内分析需要选择和Agent功能）
- Task 13 依赖所有实现任务完成

# Parallelizable Work

以下任务可以并行执行：
- Task 1-4（选择功能各模块可并行）
- Task 5-6（服务和工具可并行开发）
- Task 9-10（界面和Skills可并行开发）

# 实施建议

建议分阶段实施：
1. **Phase 1**：先实现智能选择功能，解决数据展示问题 ✅ 已完成
2. **Phase 2**：实现Agent系统，提供渐进式分析能力 ✅ 已完成
3. **Phase 3**：实现Agent分析界面 ✅ 已完成
4. **Phase 4**：扩展组内分析等高级功能（可选）

每个阶段完成后可独立交付使用。
