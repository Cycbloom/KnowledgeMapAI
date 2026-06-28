# Tasks

- [x] Task 1: P1-17 修复 useCreateTaskMutation 缺少缓存失效
  - [x] SubTask 1.1: 在 `src/hooks/mutations/useTaskMutations.ts` 中将 `useCreateTaskMutation` 从 `createSimpleMutation(api.tasks.create)` 改为 `createInvalidationMutation(api.tasks.create, [["tasks"]])`
  - [x] SubTask 1.2: 确认 `useRetryTaskMutation` 与 `useDeleteTaskMutation` 保持现状不变

- [x] Task 2: P1-18 为 PeriodicTaskCard 添加 React.memo
  - [x] SubTask 2.1: 在 `src/components/Achievements/PeriodicTaskCard.tsx` 中将 `export const PeriodicTaskCard: React.FC<...> = ({ task }) => { ... }` 改为内部组件 + `export const PeriodicTaskCard = React.memo(PeriodicTaskCardComponent)`，参考 `src/components/Scheduler/TaskCard.tsx` 的模式（但使用默认浅比较，不传 `areEqual`）

- [x] Task 3: P1-18 为 PresetCard 添加 React.memo
  - [x] SubTask 3.1: 在 `src/components/AutoGraph/PresetCard.tsx` 中将 `export const PresetCard: React.FC<...> = ({ ... }) => { ... }` 改为内部组件 `PresetCardComponent` + `export const PresetCard = React.memo(PresetCardComponent)`

- [x] Task 4: P1-18 为 ModuleItem 添加 React.memo
  - [x] SubTask 4.1: 在 `src/components/AutoGraph/ModuleItem.tsx` 中将 `export const ModuleItem: React.FC<...> = ({ ... }) => { ... }` 改为内部组件 `ModuleItemComponent` + `export const ModuleItem = React.memo(ModuleItemComponent)`

- [x] Task 5: P1-19 改造 adapter.ts 为动态 import
  - [x] SubTask 5.1: 在 `src/services/api/adapter.ts` 中移除顶部 `import { mobileApi } from "../mobile"`，新增 `let mobileApiLoaded: IApi | null = null` 模块级变量
  - [x] SubTask 5.2: 新增 `export async function preloadMobileApi(): Promise<void>` 函数，仅在 `isCapacitorMobile() && shouldUseSupabaseDirect()` 时执行 `const m = await import("../mobile"); mobileApiLoaded = m.mobileApi`
  - [x] SubTask 5.3: 修改 `getResolvedApi`，在 mobile 分支中检查 `mobileApiLoaded !== null`，若未加载则 fallback 到 `webApi`（防御性处理）

- [x] Task 6: P1-19 在 main.tsx 中调用 preloadMobileApi
  - [x] SubTask 6.1: 在 `src/main.tsx` 中 import `preloadMobileApi` from `./services/api/adapter`
  - [x] SubTask 6.2: 将 `createRoot(rootElement).render(...)` 包裹在 async IIFE 中（`void (async () => { ... })()`），先 `await preloadMobileApi()` 再 render

- [x] Task 7: P1-19 在 vite.config.ts 中新增 mobile-only chunk 规则
  - [x] SubTask 7.1: 在 `vite.config.ts` 的 `getChunkStrategy` 函数中（`!id.includes("node_modules")` 检查块内、early return 之前），新增规则：`if (id.includes("src/services/mobile")) return "mobile-only"`

- [x] Task 8: 4.11 创建 asyncConfirm 工具
  - [x] SubTask 8.1: 创建 `src/utils/asyncConfirm.tsx`（扩展名调整为 `.tsx` 以支持 JSX 语法），导出 `asyncConfirm(options: { title: string; message: string; confirmText?: string; cancelText?: string; isDangerous?: boolean }): Promise<boolean>`
  - [x] SubTask 8.2: 实现逻辑：创建临时 div 容器 → createRoot → render `<ConfirmationModal isOpen={true} ... />` → 用户点击后 unmount + 移除容器 + resolve Promise

- [x] Task 9: 4.11 替换 main.tsx 中的 confirm()
  - [x] SubTask 9.1: 在 `src/main.tsx` 中 import `asyncConfirm` from `./utils/asyncConfirm`
  - [x] SubTask 9.2: 将 `if (confirm('发现新版本，是否立即更新？'))` 替换为 `if (await asyncConfirm({ title: '发现新版本', message: '是否立即更新？', confirmText: '立即更新', cancelText: '稍后' }))`，并将 `onUpdate` 回调改为 `async` 函数

# Task Dependencies

- Task 1 独立（修改 useTaskMutations）
- Task 2, 3, 4 可并行（分别修改 3 个独立组件，添加 React.memo）
- Task 5 必须在 Task 6 之前完成（Task 6 调用 Task 5 导出的 preloadMobileApi）
- Task 7 独立（修改 vite.config.ts）
- Task 8 必须在 Task 9 之前完成（Task 9 使用 Task 8 创建的 asyncConfirm）
- Task 6 与 Task 9 都修改 main.tsx，需顺序执行（建议 Task 6 → Task 9）
- 推荐并行批次：[Task 1, 2, 3, 4, 5, 7, 8] → [Task 6] → [Task 9]
