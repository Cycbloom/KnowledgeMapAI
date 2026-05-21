# Checklist

## 阶段一：合并 Supabase 客户端工厂

- [x] `src/lib/supabase.ts` 支持通过参数配置 realtime
- [x] 所有 `getMobileSupabaseClient` 调用已更新为 `getSupabaseClient`
- [x] `src/services/mobile/client.ts` 已删除
- [x] `src/services/mobile/index.ts` 导出已更新
- [x] `npm run check` 和 `npm run lint` 通过

## 阶段二：拆分巨型文件

### scheduler.ts 拆分

- [x] `mobile/scheduler/tasks.ts` 已创建，行数 < 300
- [x] `mobile/scheduler/queues.ts` 已创建，行数 < 200
- [x] `mobile/scheduler/settings.ts` 已创建，行数 < 200
- [x] `mobile/scheduler/focus.ts` 已创建，行数 < 300
- [x] `mobile/scheduler/achievements.ts` 已创建，行数 < 200
- [x] 原 `mobile/scheduler.ts` 已删除
- [x] 所有功能正常工作

### aiService.ts 拆分

- [x] `mobile/ai/config.ts` 已创建，行数 < 200
- [x] `mobile/ai/client.ts` 已创建，行数 < 300
- [x] `mobile/ai/service.ts` 已创建，行数 < 400
- [x] 原 `mobile/aiService.ts` 已删除
- [x] 所有功能正常工作

### promptService.ts 拆分

- [x] `mobile/prompt/templates.ts` 已创建，行数 < 300
- [x] `mobile/prompt/schemas.ts` 已创建，行数 < 300
- [x] `mobile/prompt/service.ts` 已创建，行数 < 200
- [x] 原 `mobile/promptService.ts` 已删除
- [x] 所有功能正常工作

### graphs.ts 清理

- [x] 所有 stub 方法已识别
- [x] 未使用的 stub 方法已删除
- [x] 必要的 stub 方法已实现或标记
- [x] 文件行数 < 500

### study.ts 拆分

- [x] `mobile/study/learning.ts` 已创建，行数 < 300
- [x] `mobile/study/dashboard.ts` 已创建，行数 < 200
- [x] `mobile/study/statistics.ts` 已创建，行数 < 200
- [x] 原 `mobile/study.ts` 已删除
- [x] 所有功能正常工作

## 阶段三：提取共享类型和工具

- [x] 共享类型已提取到 `shared/types/api.ts`
- [x] 两个 API 层的导入已更新
- [x] 共享工具已提取到 `src/services/shared/`（无需提取，已有覆盖）
- [x] 无类型重复定义

## 阶段四：优化 API 结构

- [x] API 命名规范文档已创建
- [x] 所有命名符合规范
- [x] 无循环依赖
- [x] 导入路径已优化
- [x] 导出格式统一

## 阶段五：最终验证

- [x] `npm run check:full` 通过
- [x] `npm run lint:full` 通过
- [x] `npm run test:e2e` 通过
- [x] 核心功能手动测试通过

## 代码质量指标

- [x] 无超过 500 行的 API 文件
- [x] 无 stub 方法（除非已实现或标记）
- [x] 无重复的 Supabase 客户端工厂
- [x] 无重复的类型定义
