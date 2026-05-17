# Architecture Optimization Checklist

## Phase 1: 工具函数提取

- [x] `withClient` 工具函数已创建并导出
- [x] `src/services/mobile/scheduler.ts` 已重构使用 `withClient`
- [x] `src/services/mobile/graphs.ts` 已重构使用 `withClient`
- [x] `src/services/mobile/nodes.ts` 已重构使用 `withClient`
- [x] `src/services/mobile/study.ts` 已重构使用 `withClient`
- [x] 所有 Mobile 服务文件已重构使用 `withClient`
- [x] `message` 工具对象已创建并导出
- [x] 所有 `frontendEventBus.publish("message_show", ...)` 调用已替换
- [x] `tc` 主题类名工具对象已创建并导出
- [x] 高频组件已更新使用主题类名工具

## Phase 2: Hook 合并

- [x] 合并后的 `useError` Hook 已实现
- [x] 所有使用旧 `useErrorHandler` 的组件已更新
- [x] `useErrorHandler.ts` 文件已删除
- [x] 合并后的 `useNetworkStatus` Hook 已实现
- [x] 所有使用旧 `useNetworkStatusEnhanced` 的组件已更新
- [x] `useNetworkStatusEnhanced.ts` 文件已删除

## Phase 3: 组件合并

- [x] `Scheduler/TemplateSelector` 组件已增强
- [x] 所有使用旧 TaskTemplateSelector 的文件已更新
- [x] `TaskTemplateSelector.tsx` 文件已删除
- [x] `EmptyState` 组件已验证覆盖所有场景
- [x] 所有使用 `Empty` 的文件已更新（无使用）
- [x] `Empty.tsx` 文件已删除
- [x] 增强版 `ConfirmationModal` 已实现
- [x] 所有使用 `ConfirmDialog` 的文件已更新
- [x] `Console/ConfirmDialog.tsx` 文件已删除

## Phase 4: 服务层优化

- [x] 共享的 `createStreamHandler` 函数已创建
- [x] `src/services/api/ai.ts` 已重构使用共享函数
- [x] `src/services/mobile/ai.ts` 已重构使用共享函数

## 验证

- [x] `npm run check` 类型检查通过
- [x] `npm run lint` 代码检查通过
- [ ] `npx playwright test` E2E 测试通过
- [x] 所有功能正常工作，无回归问题
