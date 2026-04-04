# Tasks

## Phase 1: 知识图谱 ↔ 任务双向联动

- [x] Task 1.1: 数据库表结构扩展
  - [x] Task 1.2: SM-2 间隔重复算法服务
  - [x] Task 1.3: 复习任务管理服务
  - [x] Task 1.4: 学习进度同步服务
  - [x] Task 1.5: 前端组件开发
  - [x] Task 1.6: 学习模式集成

---

## Phase 2: 学习路径 ↔ 任务调度融合

- [x] Task 2.1: 数据库表结构扩展
  - [x] Task 2.2: 路径节点转任务服务
  - [x] Task 2.3: 路径进度同步
  - [x] Task 2.4: 前端组件开发

---

## Phase 3: 智能调度增强

- [x] Task 3.1: 效率数据采集服务
  - [x] Task 3.2: 智能调度服务
  - [x] Task 3.3: 前端智能推荐增强

---

## Phase 4: 统一工作台

- [x] Task 4.1: 工作台页面开发
- [x] Task 4.2: 任务看板组件
- [x] Task 4.3: 知识图谱概览组件
- [x] Task 4.4: 学习进度面板

---

## Phase 2: 学习路径 ↔ 任务调度融合

- [x] Task 2.1: 数据库表结构扩展
  - [x] SubTask 2.1.1: 创建 `path_node_tasks` 关联表
  - [x] SubTask 2.1.2: 创建相关索引和 RLS 策略

- [x] Task 2.2: 路径节点转任务服务
  - [x] SubTask 2.2.1: 创建 `pathTaskService.ts` 服务
  - [x] SubTask 2.2.2: 实现单节点转任务逻辑
  - [x] SubTask 2.2.3: 实现批量节点转任务（含依赖关系）
  - [x] SubTask 2.2.4: 添加路径任务 API 路由

- [x] Task 2.3: 路径进度同步
  - [x] SubTask 2.3.1: 实现节点学习完成同步到任务
  - [x] SubTask 2.3.2: 实现任务完成同步到路径进度
  - [x] SubTask 2.3.3: 更新路径整体进度计算

- [x] Task 2.4: 前端组件开发
  - [x] SubTask 2.4.1: 学习路径页面增加「转为任务」按钮
  - [x] SubTask 2.4.2: 任务调度器支持按路径分组显示
  - [x] SubTask 2.4.3: 路径详情页显示关联任务

---

## Phase 3: 智能调度增强

- [x] Task 3.1: 效率数据采集服务
  - [x] SubTask 3.1.1: 创建 `efficiencyService.ts` 服务
  - [x] SubTask 3.1.2: 实现任务完成时记录效率数据
  - [x] SubTask 3.1.3: 计算各时段效率统计
  - [x] SubTask 3.1.4: 计算各标签/队列效率统计

- [x] Task 3.2: 智能调度服务
  - [x] SubTask 3.2.1: 创建 `smartSchedulerService.ts` 服务
  - [x] SubTask 3.2.2: 实现时段效率优化推荐
  - [x] SubTask 3.2.3: 实现掌握度驱动优先级
  - [x] SubTask 3.2.4: 实现依赖关系感知排序
  - [x] SubTask 3.2.5: 实现任务类型匹配时段

- [x] Task 3.3: 前端智能推荐增强
  - [x] SubTask 3.3.1: 修改 `SmartRecommendationBar` 组件
  - [x] SubTask 3.3.2: 显示智能推荐理由
  - [x] SubTask 3.3.3: 显示最佳执行时段建议

---

## Phase 4: 统一工作台

- [x] Task 4.1: 工作台页面开发
  - [x] SubTask 4.1.1: 创建 `UnifiedWorkbench` 页面框架
  - [x] SubTask 4.1.2: 实现上下分区布局
  - [x] SubTask 4.1.3: 添加路由和导航入口

- [x] Task 4.2: 任务看板组件
  - [x] SubTask 4.2.1: 创建 `TaskKanban` 组件
  - [x] SubTask 4.2.2: 支持快速创建任务
  - [x] SubTask 4.2.3: 支持快速关联知识点

- [x] Task 4.3: 知识图谱概览组件
  - [x] SubTask 4.3.1: 创建 `KnowledgeOverview` 组件
  - [x] SubTask 4.3.2: 显示最近学习的知识点
  - [x] SubTask 4.3.3: 显示待复习知识点

- [x] Task 4.4: 学习进度面板
  - [x] SubTask 4.4.1: 创建 `LearningProgressPanel` 组件
  - [x] SubTask 4.4.2: 显示今日学习统计
  - [x] SubTask 4.4.3: 显示复习任务进度

---

## Task Dependencies

- Task 1.2 依赖 Task 1.1（需要数据库表）
- Task 1.3 依赖 Task 1.2（需要 SM-2 算法）
- Task 1.5 依赖 Task 1.3, Task 1.4（需要后端服务）
- Task 1.6 依赖 Task 1.5（需要前端组件）
- Task 2.2 依赖 Task 2.1（需要数据库表）
- Task 2.4 依赖 Task 2.2, Task 2.3（需要后端服务）
- Task 3.2 依赖 Task 3.1, Task 1.2（需要效率数据和 SM-2）
- Task 3.3 依赖 Task 3.2（需要智能调度服务）
- Task 4.2, 4.3, 4.4 依赖 Phase 1-3 的核心功能
- Task 4.1 依赖 Task 4.2, 4.3, 4.4（需要组件）

---

## 可并行执行的任务

以下任务可以并行开发：
- Task 1.1 和 Task 2.1（数据库表创建）
- Task 1.5 和 Task 2.4（前端组件开发）
- Task 3.1 和 Task 1.3（效率采集和复习任务服务）
