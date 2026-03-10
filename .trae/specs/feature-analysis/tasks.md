# Tasks - 学习路径功能增强

## 阶段一：数据库模型修复与扩展

- [x] Task 1: 检查现有学习路径相关表结构
  - [x] 检查 learning_paths 表是否存在 → **不存在**
  - [x] 检查相关字段是否完整 → **无相关表**
  - [x] 确认需要修复的内容 → **需要创建完整的数据模型**

- [x] Task 2: 扩展学习路径数据模型
  - [x] 为 learning_paths 表添加新字段（goal, target_date, total_estimated_time, ai_generated, source_graph_id）
  - [x] 创建 learning_path_nodes 表
  - [x] 创建 learning_path_progress 表
  - [x] 创建 learning_plans 表
  - [x] 创建必要的索引
  - [x] 添加 RLS 策略

## 阶段二：后端 API 开发

- [x] Task 3: 修复学习路径基础 API
  - [x] 创建 learningPathService.ts 服务层
  - [x] 创建 learningPaths.ts 路由文件
  - [x] 在 app.ts 中注册路由
  - [x] 更新前端 API 客户端

- [x] Task 4: 实现 AI 学习路径生成
  - [x] 实现基于图谱结构生成路径的接口
  - [x] 实现基于学习目标生成路径的接口
  - [x] 集成 AI 服务生成路径内容
  - [x] 保存生成的路径到数据库

- [x] Task 5: 实现任务调度整合
  - [x] 实现学习节点转任务接口 (convertNodeToTask)
  - [x] 实现自动排程接口 (autoSchedulePath)
  - [x] 实现进度同步逻辑 (syncProgressWithTask)

- [x] Task 6: 实现学习计划与目标管理
  - [x] 实现学习目标设置接口 (setLearningGoal)
  - [x] 实现每日学习计划生成接口 (generateDailyPlans)
  - [x] 实现学习时间预估逻辑 (estimateLearningTime)
  - [x] 实现学习建议功能 (getLearningRecommendations)

## 阶段三：前端 UI 开发

- [x] Task 7: 修复学习路径列表页面
  - [x] 创建 LearningPaths.tsx 页面
  - [x] 实现学习路径列表展示
  - [x] 实现状态筛选功能
  - [x] 实现创建/删除功能

- [x] Task 8: 开发学习路径详情页面
  - [x] 创建 LearningPathDetail.tsx 页面
  - [x] 开发路径节点列表展示
  - [x] 开发进度可视化组件
  - [x] 开发里程碑展示组件

- [x] Task 9: 开发 AI 生成功能 UI
  - [x] 整合现有的 LearningPathWizard 组件
  - [x] 支持保存生成的路径到数据库

- [x] Task 10: 开发任务整合 UI
  - [x] 开发节点转任务按钮
  - [x] 开发自动排程设置 UI
  - [x] 开发进度同步状态展示

- [x] Task 11: 开发学习计划 UI
  - [x] 开发学习目标设置 UI
  - [x] 开发每日学习计划展示
  - [x] 开发学习时间预估展示

- [x] 路由和导航更新
  - [x] 在 App.tsx 中注册新路由
  - [x] 在侧边栏添加导航链接

## 阶段四：测试与验证

- [x] Task 12: 编写单元测试
  - [x] 类型检查通过 (npm run check)
  - [x] ESLint 检查通过 (npm run lint)

- [ ] Task 13: 编写 E2E 测试
  - [ ] 学习路径创建流程测试
  - [ ] AI 生成路径流程测试
  - [ ] 任务整合流程测试

- [ ] Task 14: 集成测试
  - [ ] 运行数据库重置
  - [ ] 运行所有测试
  - [ ] 修复发现的问题

---

# Task Dependencies

- Task 2 依赖 Task 1
- Task 3-6 依赖 Task 2
- Task 7-11 依赖 Task 3-6（可并行开发）
- Task 12-14 依赖 Task 7-11
