# Tasks

- [x] Task 1: 数据库 Schema 更新
  - [x] SubTask 1.1: 在 `knowledge_graphs` 表添加 `reference_books` 字段 (JSONB)
  - [x] SubTask 1.2: 在 `knowledge_graphs` 表添加 `external_links` 字段 (JSONB)
  - [x] SubTask 1.3: 在 `knowledge_graphs` 表添加 `learning_guide` 字段 (TEXT)
  - [x] SubTask 1.4: 添加字段注释说明

- [x] Task 2: 类型定义更新
  - [x] SubTask 2.1: 在 `shared/types/graph.ts` 添加 `ReferenceBook` 接口
  - [x] SubTask 2.2: 在 `shared/types/graph.ts` 添加 `ExternalLink` 接口
  - [x] SubTask 2.3: 更新 `Graph` 接口，添加新字段

- [x] Task 3: 后端 API 扩展
  - [x] SubTask 3.1: 更新 `graphService.ts` 支持新字段的读取
  - [x] SubTask 3.2: 更新 `graphService.ts` 支持新字段的更新
  - [x] SubTask 3.3: 确保 API 返回数据包含新字段

- [x] Task 4: 图谱总览组件开发
  - [x] SubTask 4.1: 创建 `GraphOverviewPanel` 组件基础结构
  - [x] SubTask 4.2: 实现图谱描述展示区域
  - [x] SubTask 4.3: 实现参考书籍列表展示
  - [x] SubTask 4.4: 实现外部链接列表展示
  - [x] SubTask 4.5: 实现学习指南展示（支持 Markdown）
  - [x] SubTask 4.6: 添加编辑按钮和交互

- [x] Task 5: 编辑功能开发
  - [x] SubTask 5.1: 创建 `GraphOverviewEditModal` 编辑模态框
  - [x] SubTask 5.2: 实现参考书籍的添加/编辑/删除功能
  - [x] SubTask 5.3: 实现外部链接的添加/编辑/删除功能
  - [x] SubTask 5.4: 实现学习指南的 Markdown 编辑器
  - [x] SubTask 5.5: 实现保存功能

- [x] Task 6: 学习模式页面集成
  - [x] SubTask 6.1: 修改 `LearningMode.tsx`，在未选择知识点时展示 `GraphOverviewPanel`
  - [x] SubTask 6.2: 确保图谱数据加载时包含新字段
  - [x] SubTask 6.3: 添加从总览页面跳转到知识点学习的功能

- [x] Task 7: 测试与验证
  - [x] SubTask 7.1: 运行类型检查 `npm run check`
  - [x] SubTask 7.2: 运行代码检查 `npm run lint`
  - [x] SubTask 7.3: 手动测试新功能

# Task Dependencies

- [Task 2] depends on [Task 1]
- [Task 3] depends on [Task 2]
- [Task 4] depends on [Task 2]
- [Task 5] depends on [Task 4]
- [Task 6] depends on [Task 3, Task 4, Task 5]
- [Task 7] depends on [Task 6]
