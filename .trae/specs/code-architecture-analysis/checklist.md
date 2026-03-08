# Checklist

## 阶段一：类型定义统一

- [x] `shared/types` 目录已创建
- [x] `shared/types/scheduler.ts` 包含所有调度器相关类型
- [x] `shared/types/graph.ts` 包含所有图谱相关类型
- [x] `shared/types/user.ts` 包含所有用户相关类型
- [x] `shared/types/index.ts` 统一导出所有类型
- [ ] 前端代码已更新为从 `shared/types` 导入类型
- [ ] 后端代码已更新为从 `shared/types` 导入类型
- [ ] 旧的重复类型定义文件已删除或标记为废弃

## 阶段二：路由层拆分

- [x] `api/routes/scheduler/` 目录已创建
- [x] `api/routes/scheduler/tasks.ts` 文件已创建
- [x] `api/routes/scheduler/executions.ts` 文件已创建
- [x] `api/routes/scheduler/focus.ts` 文件已创建
- [x] `api/routes/scheduler/dependencies.ts` 文件已创建
- [x] `api/routes/scheduler/templates.ts` 文件已创建
- [x] `api/routes/scheduler/schedules.ts` 文件已创建
- [x] `api/routes/scheduler/timeSlots.ts` 文件已创建
- [x] `api/routes/scheduler/analytics.ts` 文件已创建
- [x] `api/routes/scheduler/subtasks.ts` 文件已创建
- [x] `api/routes/scheduler/links.ts` 文件已创建
- [x] `api/routes/scheduler/knowledgePoints.ts` 文件已创建
- [x] `api/routes/scheduler/recommendations.ts` 文件已创建
- [x] `api/routes/scheduler/progress.ts` 文件已创建
- [x] `api/routes/scheduler/settings.ts` 文件已创建
- [x] `api/routes/scheduler/index.ts` 正确注册所有子路由
- [x] `api/app.ts` 已更新导入路径
- [x] 所有路由功能正常工作（类型检查通过）

## 阶段三：服务层优化

- [x] `api/services/scheduler/` 目录已创建
- [x] `api/services/scheduler/taskService.ts` 文件已创建
- [x] `api/services/scheduler/executionService.ts` 文件已创建
- [x] `api/services/scheduler/focusService.ts` 文件已创建
- [x] `api/services/scheduler/achievementService.ts` 文件已创建
- [x] `api/services/scheduler/statsService.ts` 文件已创建
- [x] `api/services/scheduler/settingsService.ts` 文件已创建
- [x] `api/services/scheduler/index.ts` 统一导出所有服务
- [x] 路由层已更新服务导入路径
- [x] 所有服务功能正常工作（类型检查通过）

## 阶段四：前端 API 客户端优化

- [x] `src/services/api/modules/` 目录已创建
- [x] `src/services/api/modules/scheduler/` 目录包含拆分后的 API 模块
- [x] `src/services/api/modules/scheduler/tasks.ts` 已创建
- [x] `src/services/api/modules/scheduler/focus.ts` 已创建
- [x] `src/services/api/modules/scheduler/schedules.ts` 已创建
- [x] `src/services/api/modules/scheduler/settings.ts` 已创建
- [x] `src/services/api/modules/scheduler/subtasks.ts` 已创建
- [x] `src/services/api/modules/scheduler/links.ts` 已创建
- [x] `src/services/api/modules/scheduler/knowledgePoints.ts` 已创建
- [x] `src/services/api/modules/scheduler/analytics.ts` 已创建
- [x] `src/services/api/modules/scheduler/achievements.ts` 已创建
- [x] `src/services/api/modules/scheduler/index.ts` 统一导出
- [x] 所有 API 调用正常工作（类型检查通过）

## 阶段五：Hooks 优化

- [x] `src/hooks/queries/` 目录已创建
- [x] `src/hooks/mutations/` 目录已创建
- [x] `src/hooks/state/` 目录已创建
- [x] 重复的 Hooks 已合并（移除 useQueries.ts 中的 scheduler hooks）
- [x] `src/hooks/index.ts` 统一导出所有 Hooks
- [x] 组件中的 Hooks 导入路径已更新
- [x] 所有 Hooks 功能正常工作（类型检查通过）

## 阶段六：组件目录重组

- [ ] `src/components/common/` 目录已创建
- [ ] `src/components/features/` 目录已创建
- [ ] `src/components/layout/` 目录已创建
- [ ] Scheduler 组件已迁移到 `features/Scheduler/`
- [ ] GraphEditor 组件已迁移到 `features/GraphEditor/`
- [ ] Study 组件已迁移到 `features/Study/`
- [ ] 通用组件已迁移到 `common/`
- [ ] 组件导入路径已更新
- [ ] 所有组件正常渲染

## 阶段七：错误处理统一

- [ ] 统一的错误类型定义已创建
- [ ] 后端错误处理中间件已优化
- [ ] 前端错误处理工具已创建
- [ ] API 响应格式已统一
- [ ] 错误信息对用户友好

## 阶段八：文档和测试更新

- [ ] 测试文件中的导入路径已更新
- [ ] 测试全部通过
- [ ] 项目文档已更新说明新目录结构
- [ ] README 或开发文档包含目录结构说明
