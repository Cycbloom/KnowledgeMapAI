# Tasks

- [x] Task 1: 数据库 Schema 更新
  - [x] SubTask 1.1: 在 `knowledge_points` 表添加 `keywords` JSONB 字段
  - [x] SubTask 1.2: 添加字段注释说明关键词数据结构
  - [ ] SubTask 1.3: 本地数据库重置验证

- [x] Task 2: AI 服务层修改
  - [x] SubTask 2.1: 修改 `generateLearningMaterial` 方法返回关键词
  - [x] SubTask 2.2: 设计关键词提取的 AI Prompt
  - [x] SubTask 2.3: 解析 AI 返回的关键词 JSON 数据

- [x] Task 3: API 路由更新
  - [x] SubTask 3.1: 修改 `/ai/learning-material` API 返回关键词
  - [ ] SubTask 3.2: 新增 `/nodes/:id/keywords` 更新关键词 API (复用现有 update API)
  - [ ] SubTask 3.3: 新增 `/nodes/:id/regenerate-keywords` 重新生成关键词 API (可选)

- [x] Task 4: 前端类型和 API 更新
  - [x] SubTask 4.1: 更新 `Keyword` 类型定义
  - [x] SubTask 4.2: 更新 `KnowledgePoint` 类型包含 keywords
  - [x] SubTask 4.3: 新增关键词相关前端 API 方法

- [x] Task 5: HighlightedReader 组件增强
  - [x] SubTask 5.1: 新增 `keywords` prop 接收预生成关键词
  - [x] SubTask 5.2: 实现使用预生成关键词的高亮逻辑
  - [x] SubTask 5.3: 显示关键词重要程度（颜色深浅）
  - [x] SubTask 5.4: 悬停显示关键词解释
  - [x] SubTask 5.5: 无关键词时回退到本地分析

- [x] Task 6: LearningMode 页面集成
  - [x] SubTask 6.1: 加载知识点时获取关键词数据
  - [x] SubTask 6.2: 将关键词传递给 LearningFocusPanel
  - [x] SubTask 6.3: 生成学习资料后保存关键词到数据库

- [x] Task 7: 关键词管理 UI
  - [x] SubTask 7.1: 在专注模式设置面板显示关键词列表
  - [ ] SubTask 7.2: 添加"重新提取关键词"按钮 (可选)
  - [ ] SubTask 7.3: 实现关键词手动编辑功能（可选）

- [ ] Task 8: 测试与验证
  - [ ] SubTask 8.1: 测试 AI 关键词生成质量
  - [ ] SubTask 8.2: 测试关键词高亮显示
  - [ ] SubTask 8.3: 测试无关键词时的回退逻辑
  - [ ] SubTask 8.4: 测试关键词重新生成功能

# Task Dependencies
- [Task 2] depends on [Task 1]
- [Task 3] depends on [Task 2]
- [Task 4] depends on [Task 1]
- [Task 5] depends on [Task 4]
- [Task 6] depends on [Task 3, Task 4, Task 5]
- [Task 7] depends on [Task 6]
- [Task 8] depends on [Task 6, Task 7]
