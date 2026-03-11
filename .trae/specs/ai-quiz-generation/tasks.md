# Tasks

## 后端开发

- [x] Task 1: 数据库架构更新
  - [x] SubTask 1.1: 在 schema 文件中添加 quiz_sets 表定义
  - [x] SubTask 1.2: 在 schema 文件中添加 quiz_set_cards 关联表定义
  - [x] SubTask 1.3: 为 study_cards 表添加 quiz_set_id 字段
  - [x] SubTask 1.4: 添加必要的索引和 RLS 策略
  - [x] SubTask 1.5: 运行 `npx supabase db reset` 验证架构

- [x] Task 2: 测验集合 API 开发
  - [x] SubTask 2.1: 创建 `api/routes/quizSets.ts` 路由文件
  - [x] SubTask 2.2: 实现测验集合 CRUD 接口（GET, POST, PUT, DELETE）
  - [x] SubTask 2.3: 实现获取测验集合卡片列表接口
  - [x] SubTask 2.4: 添加请求验证 Schema
  - [x] SubTask 2.5: 注册路由到主应用

- [x] Task 3: AI 测验生成服务增强
  - [x] SubTask 3.1: 在 `api/services/ai/index.ts` 中增强 generateCards 方法，支持难度参数
  - [x] SubTask 3.2: 实现批量生成任务处理器 `api/services/taskProcessors/quizGenerationProcessor.ts`
  - [x] SubTask 3.3: 实现测验生成 API `/quiz-sets/generate`
  - [x] SubTask 3.4: 实现单题重新生成 API `/quiz-sets/:id/regenerate/:cardId`
  - [x] SubTask 3.5: 添加生成进度追踪机制

## 前端开发

- [x] Task 4: 测验管理页面
  - [x] SubTask 4.1: 创建测验列表组件 `src/components/Quiz/QuizList.tsx`
  - [x] SubTask 4.2: 创建测验卡片预览组件 `src/components/Quiz/QuizCard.tsx`
  - [x] SubTask 4.3: 在 Study.tsx 页面添加测验管理入口
  - [x] SubTask 4.4: 实现测验集合的删除确认对话框

- [x] Task 5: 测验生成配置界面
  - [x] SubTask 5.1: 创建知识点选择器组件 `src/components/Quiz/KnowledgePointSelector.tsx`
  - [x] SubTask 5.2: 创建题型配置组件 `src/components/Quiz/QuizTypeConfig.tsx`
  - [x] SubTask 5.3: 创建难度选择组件 `src/components/Quiz/DifficultySelector.tsx`
  - [x] SubTask 5.4: 创建测验生成配置模态框 `src/components/Quiz/QuizGenerationModal.tsx`
  - [x] SubTask 5.5: 实现高级配置折叠面板

- [x] Task 6: 测验预览与编辑界面
  - [x] SubTask 6.1: 创建测验预览页面 `src/pages/QuizPreview.tsx`
  - [x] SubTask 6.2: 创建题目列表组件 `src/components/Quiz/QuestionList.tsx`
  - [x] SubTask 6.3: 复用 QuestionForm 组件实现题目编辑
  - [x] SubTask 6.4: 实现单题重新生成功能
  - [x] SubTask 6.5: 实现手动添加题目功能

- [x] Task 7: 测验练习模式
  - [x] SubTask 7.1: 创建测验练习页面 `src/pages/QuizPractice.tsx`
  - [x] SubTask 7.2: 实现测验进度条组件
  - [x] SubTask 7.3: 创建测验结果统计页面 `src/components/Quiz/QuizResult.tsx`
  - [x] SubTask 7.4: 实现错题重练功能

- [x] Task 8: 前端 API 集成
  - [x] SubTask 8.1: 创建测验 API 服务 `src/services/api/quiz.ts`
  - [x] SubTask 8.2: 创建测验相关类型定义 `src/types/quiz.ts`
  - [x] SubTask 8.3: 创建测验操作 Hook `src/hooks/useQuizQueries.ts`

## 测试与验证

- [x] Task 9: 功能测试
  - [x] SubTask 9.1: 编写测验集合 CRUD API 测试
  - [x] SubTask 9.2: 编写测验生成 E2E 测试
  - [x] SubTask 9.3: 编写测验练习 E2E 测试
  - [x] SubTask 9.4: 运行 `npm run lint` 和 `npm run check` 验证代码质量
  - [x] SubTask 9.5: 运行 `npx playwright test` 验证功能

---

# Task Dependencies

- [Task 2] depends on [Task 1] - API 开发依赖数据库架构
- [Task 3] depends on [Task 1] - AI 服务增强依赖数据库架构
- [Task 5] depends on [Task 8] - 配置界面依赖 API 服务
- [Task 6] depends on [Task 5] - 预览界面依赖生成功能
- [Task 7] depends on [Task 6] - 练习模式依赖预览完成
- [Task 9] depends on [Task 1-8] - 测试依赖所有功能完成

# Parallelizable Work

以下任务可以并行执行：
- Task 1（数据库）和 Task 8（前端 API 类型定义）
- Task 4（测验管理页面）和 Task 5（配置界面）- 在 API 就绪后
- Task 6（预览界面）和 Task 7（练习模式）- 部分组件可并行
