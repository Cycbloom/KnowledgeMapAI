# Tasks

## Phase 1: 数据库迁移

- [ ] Task 1: 执行云端数据库迁移
  - [ ] SubTask 1.1: 在 Supabase Dashboard 的 SQL Editor 中执行删除并重建 templates 表的 SQL
  - [ ] SubTask 1.2: 验证表结构正确创建
  - [ ] SubTask 1.3: 验证 RLS 策略正确设置
  - [ ] SubTask 1.4: 验证系统预设模板正确插入

- [x] Task 2: 更新本地迁移文件
  - [x] SubTask 2.1: 更新 `supabase/migrations/00000000000000_initial_schema.sql` 中的 templates 表定义
  - [x] SubTask 2.2: 更新 `supabase/migrations/00000000000001_initial_seed.sql` 中的 templates 种子数据
  - [ ] SubTask 2.3: 本地执行 `npx supabase db reset` 验证迁移文件正确

- [x] Task 3: 更新 TypeScript 类型定义
  - [x] SubTask 3.1: 更新 `shared/types/` 中的模板类型定义
  - [x] SubTask 3.2: 更新 `api/services/graph/graphTemplateService.ts` 中的类型
  - [x] SubTask 3.3: 运行 `npm run check` 验证类型正确

## Phase 2: 后端服务开发

- [x] Task 4: 实现 AI 模板生成服务
  - [x] SubTask 4.1: 创建 `api/services/ai/templateGeneratorService.ts`
  - [x] SubTask 4.2: 实现模板生成 prompt 模板
  - [x] SubTask 4.3: 实现模板生成逻辑（调用 AI 解析返回结果）
  - [x] SubTask 4.4: 添加错误处理和重试机制

- [x] Task 5: 扩展 API 路由
  - [x] SubTask 5.1: 在 `api/routes/autoGraph.ts` 添加 `POST /generate-templates` 端点
  - [x] SubTask 5.2: 在 `api/routes/autoGraph.ts` 添加 `POST /apply-template` 端点
  - [x] SubTask 5.3: 添加请求参数验证（Zod schema）
  - [x] SubTask 5.4: 添加性能监控和日志记录

- [x] Task 6: 扩展模板服务
  - [x] SubTask 6.1: 更新 `api/services/graph/graphTemplateService.ts` 支持新字段
  - [x] SubTask 6.2: 添加模板搜索和过滤功能
  - [x] SubTask 6.3: 添加模板标签管理功能

## Phase 3: 前端组件开发

- [x] Task 7: 创建模板生成器组件
  - [x] SubTask 7.1: 创建 `src/components/Templates/TemplateGenerator.tsx`
  - [x] SubTask 7.2: 实现主题输入和分类选择
  - [x] SubTask 7.3: 实现模板方案列表展示
  - [x] SubTask 7.4: 实现模板选择和风格配置
  - [x] SubTask 7.5: 添加加载状态和错误处理

- [x] Task 8: 创建模板预览组件
  - [x] SubTask 8.1: 创建 `src/components/Templates/TemplatePreview.tsx`
  - [x] SubTask 8.2: 实现简化版节点树可视化（缩进表示层级）
  - [x] SubTask 8.3: 显示每个节点的建议内容描述
  - [x] SubTask 8.4: 显示模板元信息（标签、难度、节点数、布局建议）
  - [x] SubTask 8.5: 添加操作按钮（编辑、选择、保存）

- [x] Task 9: 创建模板编辑组件
  - [x] SubTask 9.1: 创建 `src/components/Templates/TemplateEditor.tsx`
  - [x] SubTask 9.2: 实现节点列表编辑（添加、删除、修改标题和内容）
  - [x] SubTask 9.3: 实现边关系编辑
  - [x] SubTask 9.4: 实现模板基本信息编辑（名称、描述、分类）
  - [x] SubTask 9.5: 添加保存和取消功能

- [ ] Task 10: 改造 AutoGraphGenerator 组件
  - [ ] SubTask 10.1: 添加模式切换（直接生成 / 模板生成）
  - [ ] SubTask 10.2: 集成 TemplateGenerator 组件
  - [ ] SubTask 10.3: 实现模板应用后的内容生成流程
  - [ ] SubTask 10.4: 保持原有功能兼容

- [x] Task 11: 创建前端 API 服务
  - [x] SubTask 11.1: 在 `src/services/api/autoGraph.ts` 添加模板生成 API
  - [x] SubTask 11.2: 在 `src/services/api/templates.ts` 添加模板保存和更新 API
  - [x] SubTask 11.3: 添加 TypeScript 类型定义 9.2: 实现节点列表编辑（添加、删除、修改标题和内容）
  - [ ] SubTask 9.3: 实现边关系编辑
  - [ ] SubTask 9.4: 实现模板基本信息编辑（名称、描述、分类）
  - [ ] SubTask 9.5: 添加保存和取消功能

- [ ] Task 10: 改造 AutoGraphGenerator 组件
  - [ ] SubTask 10.1: 添加模式切换（直接生成 / 模板生成）
  - [ ] SubTask 10.2: 集成 TemplateGenerator 组件
  - [ ] SubTask 10.3: 实现模板应用后的内容生成流程
  - [ ] SubTask 10.4: 保持原有功能兼容

- [ ] Task 11: 创建前端 API 服务
  - [ ] SubTask 11.1: 在 `src/services/api/autoGraph.ts` 添加模板生成 API
  - [ ] SubTask 11.2: 在 `src/services/api/templates.ts` 添加模板保存和更新 API
  - [ ] SubTask 11.3: 添加 TypeScript 类型定义

## Phase 4: 集成与优化

- [ ] Task 12: 更新图谱创建流程
  - [ ] SubTask 12.1: 修改 `QuickCreateGraphPanel.tsx` 支持模板选择
  - [ ] SubTask 12.2: 添加"从模板创建"入口
  - [ ] SubTask 12.3: 添加"AI 生成模板"入口

- [ ] Task 13: 更新模板管理页面
  - [ ] SubTask 13.1: 在 `src/pages/Templates.tsx` 添加 AI 生成入口
  - [ ] SubTask 13.2: 优化模板列表展示（支持新字段）
  - [ ] SubTask 13.3: 添加模板预览和编辑功能

- [ ] Task 14: 添加 prompt 模板
  - [ ] SubTask 14.1: 在 `prompt_templates` 表添加模板生成 prompt
  - [ ] SubTask 14.2: 在 `prompt_templates` 表添加模板应用 prompt
  - [ ] SubTask 14.3: 支持用户自定义模板生成规则

## Phase 5: 测试与文档

- [ ] Task 15: 编写单元测试
  - [ ] SubTask 15.1: 测试模板生成服务
  - [ ] SubTask 15.2: 测试模板应用逻辑
  - [ ] SubTask 15.3: 测试 API 端点

- [ ] Task 16: 编写 E2E 测试
  - [ ] SubTask 16.1: 测试模板生成流程
  - [ ] SubTask 16.2: 测试模板应用流程
  - [ ] SubTask 16.3: 测试模板保存和管理

- [ ] Task 17: 代码质量检查
  - [ ] SubTask 17.1: 运行 `npm run lint` 修复问题
  - [ ] SubTask 17.2: 运行 `npm run check` 修复类型错误
  - [ ] SubTask 17.3: 运行 `npm run check:electron` 确保 Electron 兼容

# Task Dependencies

- Task 2 依赖 Task 1（云端数据库迁移完成）
- Task 3 依赖 Task 2（本地迁移文件更新）
- Task 4-6 依赖 Task 3（TypeScript 类型定义）
- Task 7-11 依赖 Task 5（API 端点）
- Task 12-14 依赖 Task 7-11（前端组件）
- Task 15-16 依赖 Task 1-14（所有功能实现）
- Task 17 依赖 Task 15-16（测试完成）

# Parallelizable Work

以下任务可以并行执行：
- Task 7, Task 8, Task 9, Task 10, Task 11（前端组件开发）
- Task 15, Task 16（测试编写）
