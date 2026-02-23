# Tasks

- [x] Task 1: 重构联立视图侧边栏结构
  - [x] SubTask 1.1: 参考 GraphSidebarManager 重构 CombinedGraphSidebar
  - [x] SubTask 1.2: 添加 outline/detail/edit/connections 四种模式支持
  - [x] SubTask 1.3: 实现模式切换逻辑

- [x] Task 2: 实现节点详情侧边栏
  - [x] SubTask 2.1: 创建 CombinedNodeDetailSidebar 组件
  - [x] SubTask 2.2: 显示节点完整信息（标题、内容、标签、等级等）
  - [x] SubTask 2.3: 添加 AI 操作按钮（扩展、生成内容、生成卡片等）
  - [x] SubTask 2.4: 添加学习功能按钮（水平测试、学习模式）

- [x] Task 3: 实现节点编辑侧边栏
  - [x] SubTask 3.1: 创建 CombinedNodeEditSidebar 组件
  - [x] SubTask 3.2: 支持编辑节点标题、内容、标签
  - [x] SubTask 3.3: 实现保存和取消逻辑

- [x] Task 4: 实现联立视图 AI 操作 Hook
  - [x] SubTask 4.1: 创建 useCombinedGraphAIOperations hook
  - [x] SubTask 4.2: 实现扩展节点功能
  - [x] SubTask 4.3: 实现生成节点内容功能
  - [x] SubTask 4.4: 实现生成学习卡片功能
  - [x] SubTask 4.5: 实现水平测试和学习模式功能

- [x] Task 5: 实现 AI 分析跨图谱连接
  - [x] SubTask 5.1: 添加 API 接口支持跨图谱节点连接分析
  - [x] SubTask 5.2: 实现连接建议显示
  - [x] SubTask 5.3: 实现确认/拒绝连接建议

# Task Dependencies
- Task 2 依赖 Task 1
- Task 3 依赖 Task 1
- Task 4 依赖 Task 1
- Task 5 依赖 Task 4
