# Tasks

## 阶段一：类型定义统一 (优先级: 高)

- [x] Task 1: 创建共享类型目录
  - [ ] SubTask 1.1: 创建 `shared/types` 目录结构
  - [ ] SubTask 1.2: 迁移 scheduler 相关类型到 `shared/types/scheduler.ts`
  - [ ] SubTask 1.3: 迁移 graph 相关类型到 `shared/types/graph.ts`
  - [ ] SubTask 1.4: 迁移 user 相关类型到 `shared/types/user.ts`
  - [ ] SubTask 1.5: 创建 `shared/types/index.ts` 统一导出
  - [ ] SubTask 1.6: 更新前后端导入路径

## 阶段二： 路由层拆分 (优先级: 高)

- [x] Task 2: 拆分 scheduler.ts 路由文件
  - [ ] SubTask 2.1: 创建 `api/routes/scheduler/` 目录
  - [ ] SubTask 2.2: 提取任务 CRUD 相关路由到 `tasks.ts`
  - [ ] SubTask 2.3: 提取执行记录相关路由到 `executions.ts`
  - [ ] SubTask 2.4: 提取专注会话相关路由到 `focus.ts`
  - [ ] SubTask 2.5: 提取成就系统相关路由到 `achievements.ts`
  - [ ] SubTask 2.6: 提取任务模板相关路由到 `templates.ts`
  - [ ] SubTask 2.7: 提取周期调度相关路由到 `schedules.ts`
  - [ ] SubTask 2.8: 提取时间段设置相关路由到 `timeSlots.ts`
  - [ ] SubTask 2.9: 提取统计分析相关路由到 `analytics.ts`
  - [ ] SubTask 2.10: 创建 `index.ts` 统一注册所有子路由
  - [ ] SubTask 2.11: 更新 `app.ts` 中的路由导入

## 阶段三： 服务层优化 (优先级: 高)

- [x] Task 3: 拆分 schedulerService.ts
  - [ ] SubTask 3.1: 创建 `api/services/scheduler/` 目录
  - [ ] SubTask 3.2: 提取任务管理逻辑到 `taskService.ts`
  - [ ] SubTask 3.3: 提取执行记录逻辑到 `executionService.ts`
  - [ ] SubTask 3.4: 提取专注会话逻辑到 `focusService.ts`
  - [ ] SubTask 3.5: 提取成就系统逻辑到 `achievementService.ts`
  - [ ] SubTask 3.6: 提取模板管理逻辑到 `templateService.ts`
  - [ ] SubTask 3.7: 提取统计分析逻辑到 `analyticsService.ts`
  - [ ] SubTask 3.8: 创建 `index.ts` 统一导出
  - [ ] SubTask 3.9: 更新路由层的导入路径

## 阶段四: 前端 API 客户端优化 (优先级: 中)

- [ ] Task 4: 重构前端 API 服务层
  - [ ] SubTask 4.1: 创建 `src/services/api/modules/` 目录
  - [ ] SubTask 4.2: 拆分 `scheduler.ts` 为多个模块
  - [ ] SubTask 4.3: 创建统一的 API 类型定义
  - [ ] SubTask 4.4: 优化 `client.ts` 错误处理
  - [ ] SubTask 4.5: 更新 `index.ts` 统一导出

## 阶段五: Hooks 优化 (优先级: 中)

- [ ] Task 5: 重构 Hooks 目录结构
  - [ ] SubTask 5.1: 创建 `src/hooks/queries/` 目录
  - [ ] SubTask 5.2: 创建 `src/hooks/mutations/` 目录
  - [ ] SubTask 5.3: 创建 `src/hooks/state/` 目录
  - [ ] SubTask 5.4: 创建 `src/hooks/utils/` 目录
  - [ ] SubTask 5.5: 迁移并合并重复的 Hooks
  - [ ] SubTask 5.6: 创建 `src/hooks/index.ts` 统一导出
  - [ ] SubTask 5.7: 更新组件中的 Hooks 导入路径

## 阶段六: 组件目录重组 (优先级: 中)

- [ ] Task 6: 重组组件目录结构
  - [ ] SubTask 6.1: 创建 `src/components/common/` 目录
  - [ ] SubTask 6.2: 创建 `src/components/features/` 目录
  - [ ] SubTask 6.3: 创建 `src/components/layout/` 目录
  - [ ] SubTask 6.4: 迁移 Scheduler 组件到 `features/Scheduler/`
  - [ ] SubTask 6.5: 迁移 GraphEditor 组件到 `features/GraphEditor/`
  - [ ] SubTask 6.6: 迁移 Study 组件到 `features/Study/`
  - [ ] SubTask 6.7: 迁移通用组件到 `common/`
  - [ ] SubTask 6.8: 更新组件导入路径

## 阶段七: 错误处理统一 (优先级: 低)

- [ ] Task 7: 统一错误处理机制
  - [ ] SubTask 7.1: 创建统一的错误类型定义
  - [ ] SubTask 7.2: 优化后端错误处理中间件
  - [ ] SubTask 7.3: 创建前端错误处理工具
  - [ ] SubTask 7.4: 统一 API 响应格式

## 阶段八: 文档和测试更新 (优先级: 低)

- [ ] Task 8: 更新相关文档和测试
  - [ ] SubTask 8.1: 更新导入路径相关的测试文件
  - [ ] SubTask 8.2: 更新项目文档说明新的目录结构

# Task Dependencies

- [Task 2] depends on [Task 1]  # 路由拆分依赖类型定义
- [Task 3] depends on [Task 1]  # 服务拆分依赖类型定义
- [Task 4] depends on [Task 1]  # API 客户端依赖类型定义
- [Task 5] depends on [Task 4]  # Hooks 依赖 API 客户端
- [Task 6] depends on [Task 5]  # 组件依赖 Hooks
- [Task 7] can run in parallel with other tasks
- [Task 8] depends on [Task 1-7]  # 文档更新依赖所有重构完成
