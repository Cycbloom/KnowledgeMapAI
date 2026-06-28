# Checklist

## P1-17 useCreateTaskMutation 缓存失效

- [x] `src/hooks/mutations/useTaskMutations.ts` 中 `useCreateTaskMutation` 使用 `createInvalidationMutation(api.tasks.create, [["tasks"]])`
- [x] `useRetryTaskMutation` 与 `useDeleteTaskMutation` 保持 `createInvalidationMutation` 失效 `[["tasks"]]` 不变

## P1-18 React.memo 补齐

- [x] `src/components/Achievements/PeriodicTaskCard.tsx` 使用 `React.memo` 包裹
- [x] `src/components/AutoGraph/PresetCard.tsx` 使用 `React.memo` 包裹
- [x] `src/components/AutoGraph/ModuleItem.tsx` 使用 `React.memo` 包裹
- [x] 3 个组件的导出名保持不变（`PeriodicTaskCard`、`PresetCard`、`ModuleItem`），不破坏消费者

## P1-19 移动端服务动态 import

- [x] `src/services/api/adapter.ts` 不再包含顶部静态 `import { mobileApi } from "../mobile"`
- [x] `src/services/api/adapter.ts` 导出 `preloadMobileApi` 异步函数
- [x] `preloadMobileApi` 仅在 `isCapacitorMobile() && shouldUseSupabaseDirect()` 时动态 import
- [x] `getResolvedApi` 检查 `mobileApiLoaded` 模块级变量
- [x] `src/main.tsx` 在 render 前调用 `await preloadMobileApi()`
- [x] `vite.config.ts` 的 `getChunkStrategy` 包含 `src/services/mobile` → `mobile-only` 规则

## 4.11 confirm() 替换

- [x] `src/utils/asyncConfirm.tsx` 存在并导出 `asyncConfirm` 函数（扩展名由 `.ts` 调整为 `.tsx` 以支持 JSX 语法）
- [x] `asyncConfirm` 返回 `Promise<boolean>`
- [x] `asyncConfirm` 内部使用 `ConfirmationModal` 组件
- [x] `src/main.tsx` 不再包含 `confirm(` 调用
- [x] `src/main.tsx` 使用 `await asyncConfirm(...)` 替代

## 类型与代码规范

- [x] `npm run check` 通过（无新增 TypeScript 错误）
- [x] `npm run lint` 通过（无新增 ESLint 错误）
- [x] 无新增 `any` 类型
- [x] 无新增非空断言（`!`）
- [x] 前端无新增 `console.log` / `console.info`
