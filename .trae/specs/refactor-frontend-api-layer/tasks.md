# Tasks

## 阶段一：合并 Supabase 客户端工厂

- [x] Task 1: 统一 Supabase 客户端工厂
  - [x] SubTask 1.1: 修改 `src/lib/supabase.ts`，支持通过参数配置 realtime
  - [x] SubTask 1.2: 更新 `src/services/mobile/` 中所有使用 `getMobileSupabaseClient` 的地方
  - [x] SubTask 1.3: 删除 `src/services/mobile/client.ts`
  - [x] SubTask 1.4: 更新 `src/services/mobile/index.ts` 的导出
  - [x] SubTask 1.5: 运行 `npm run check` 和 `npm run lint` 验证

## 阶段二：拆分巨型文件

- [x] Task 2: 拆分 `mobile/scheduler.ts`（1181 行）
  - [x] SubTask 2.1: 创建 `mobile/scheduler/tasks.ts` - 任务 CRUD
  - [x] SubTask 2.2: 创建 `mobile/scheduler/queues.ts` - 队列管理
  - [x] SubTask 2.3: 创建 `mobile/scheduler/settings.ts` - 任务设置
  - [x] SubTask 2.4: 创建 `mobile/scheduler/focus.ts` - 专注会话
  - [x] SubTask 2.5: 创建 `mobile/scheduler/achievements.ts` - 成就相关
  - [x] SubTask 2.6: 创建 `mobile/scheduler/index.ts` - 统一导出
  - [x] SubTask 2.7: 删除原 `mobile/scheduler.ts`
  - [x] SubTask 2.8: 运行 `npm run check` 和 `npm run lint` 验证

- [x] Task 3: 拆分 `mobile/aiService.ts`（818 行）
  - [x] SubTask 3.1: 创建 `mobile/ai/config.ts` - AI 配置管理
  - [x] SubTask 3.2: 创建 `mobile/ai/client.ts` - AI 客户端创建
  - [x] SubTask 3.3: 创建 `mobile/ai/service.ts` - AI 服务核心
  - [x] SubTask 3.4: 创建 `mobile/ai/index.ts` - 统一导出
  - [x] SubTask 3.5: 删除原 `mobile/aiService.ts`
  - [x] SubTask 3.6: 运行 `npm run check` 和 `npm run lint` 验证

- [x] Task 4: 拆分 `mobile/promptService.ts`（774 行）
  - [x] SubTask 4.1: 创建 `mobile/prompt/templates.ts` - Prompt 模板
  - [x] SubTask 4.2: 创建 `mobile/prompt/schemas.ts` - Output Schema
  - [x] SubTask 4.3: 创建 `mobile/prompt/service.ts` - Prompt 服务
  - [x] SubTask 4.4: 创建 `mobile/prompt/index.ts` - 统一导出
  - [x] SubTask 4.5: 删除原 `mobile/promptService.ts`
  - [x] SubTask 4.6: 运行 `npm run check` 和 `npm run lint` 验证

- [x] Task 5: 清理 `mobile/graphs.ts` 中的 stub 方法
  - [x] SubTask 5.1: 识别所有 stub 方法
  - [x] SubTask 5.2: 删除未使用的 stub 方法
  - [x] SubTask 5.3: 实现必要的 stub 方法或标记为 TODO
  - [x] SubTask 5.4: 运行 `npm run check` 和 `npm run lint` 验证

- [x] Task 6: 拆分 `mobile/study.ts`（629 行）
  - [x] SubTask 6.1: 创建 `mobile/study/learning.ts` - 学习相关
  - [x] SubTask 6.2: 创建 `mobile/study/dashboard.ts` - Dashboard API
  - [x] SubTask 6.3: 创建 `mobile/study/statistics.ts` - 统计 API
  - [x] SubTask 6.4: 创建 `mobile/study/index.ts` - 统一导出
  - [x] SubTask 6.5: 删除原 `mobile/study.ts`
  - [x] SubTask 6.6: 运行 `npm run check` 和 `npm run lint` 验证

## 阶段三：提取共享类型和工具

- [x] Task 7: 提取共享类型
  - [x] SubTask 7.1: 分析两个 API 层的类型使用情况
  - [x] SubTask 7.2: 提取共享类型到 `shared/types/api.ts`
  - [x] SubTask 7.3: 更新两个 API 层的导入
  - [x] SubTask 7.4: 运行 `npm run check` 和 `npm run lint` 验证

- [x] Task 8: 提取共享工具函数
  - [x] SubTask 8.1: 分析两个 API 层的工具函数使用情况
  - [x] SubTask 8.2: 提取共享工具到 `src/services/shared/`
  - [x] SubTask 8.3: 更新两个 API 层的导入
  - [x] SubTask 8.4: 运行 `npm run check` 和 `npm run lint` 验证

## 阶段四：优化 API 结构

- [x] Task 9: 统一 API 命名规范
  - [x] SubTask 9.1: 制定 API 命名规范文档
  - [x] SubTask 9.2: 检查并修正不符合规范的命名
  - [x] SubTask 9.3: 运行 `npm run check` 和 `npm run lint` 验证

- [x] Task 10: 优化导入导出结构
  - [x] SubTask 10.1: 检查循环依赖
  - [x] SubTask 10.2: 优化导入路径
  - [x] SubTask 10.3: 统一导出格式
  - [x] SubTask 10.4: 运行 `npm run check` 和 `npm run lint` 验证

## 阶段五：最终验证

- [x] Task 11: 全面测试
  - [x] SubTask 11.1: 运行 `npm run check:full` 全量类型检查
  - [x] SubTask 11.2: 运行 `npm run lint:full` 全量代码检查
  - [x] SubTask 11.3: 运行 `npm run test:e2e` E2E 测试
  - [x] SubTask 11.4: 手动测试核心功能

# Task Dependencies

- [Task 2] depends on [Task 1]
- [Task 3] depends on [Task 1]
- [Task 4] depends on [Task 1]
- [Task 5] depends on [Task 1]
- [Task 6] depends on [Task 1]
- [Task 7] depends on [Task 2, Task 3, Task 4, Task 5, Task 6]
- [Task 8] depends on [Task 7]
- [Task 9] depends on [Task 8]
- [Task 10] depends on [Task 9]
- [Task 11] depends on [Task 10]
