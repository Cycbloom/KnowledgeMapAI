# Tasks

> 以下任务按 Tier 排列。Tier 内任务无依赖，可并行。i18n key 任务需要先于依赖它的 UI 任务完成 locale 文件更新。

## Tier 1 — 极小工作量（4 项）

- [x] Task UX5-01: window.location.href 内部导航改用 navigate ✅
  - [x] SubTask UX5-01.1: `src/pages/CalendarPage.tsx:90` 改用 `useNavigate()` 的 `navigate(\`/scheduler/task/${event.id}\`)`
  - [x] SubTask UX5-01.2: `src/hooks/graphAI/useCombinedGraphAIOperations.ts:236,246` 改为接收 navigate 参数或通过 useNavigate hook
  - [ ] SubTask UX5-01.3: `src/services/console/commands/system.ts:171` 改用 navigate（如非 hook 上下文，可通过事件总线触发） — 推迟：console 命令在 React 上下文外，保留 window.location.href 为可接受方案
  - [x] SubTask UX5-01.4: `npm run check` 通过

- [x] Task UX5-02: Register/Login 固定宽度改响应式 ✅
  - [x] SubTask UX5-02.1: `src/pages/Register.tsx:45` `w-96` 改为 `w-full max-w-md mx-4`
  - [x] SubTask UX5-02.2: `src/pages/Login.tsx` 已用 `w-full max-w-4xl`，无需修改
  - [x] SubTask UX5-02.3: `npm run check` 通过

- [x] Task UX5-03: CombinedViewPage 节点详情面板 dark 适配 ✅
  - [x] SubTask UX5-03.1: Read `src/pages/CombinedViewPage.tsx:310-326` 确认现有硬编码深色类
  - [x] SubTask UX5-03.2: 改为基于 `isDark`（useTheme）的三元表达式：`isDark ? 'bg-gray-800/90 text-white' : 'bg-white/95 text-gray-900 border'`
  - [x] SubTask UX5-03.3: 将 "✕" 字符替换为 lucide `<X>` 图标，添加 `aria-label={t('common.close')}`
  - [x] SubTask UX5-03.4: `npm run check` 通过

- [x] Task UX5-04: Profile/Tasks 清理 as any ✅
  - [x] SubTask UX5-04.1: Read `src/pages/Profile.tsx:62-64` 确认 3 处 `as any` 上下文
  - [x] SubTask UX5-04.2: 用 `?.` 链式访问替代 `as any`，并在 `shared/types/user.ts` 添加 `name?: string`
  - [x] SubTask UX5-04.3: Read `src/pages/Tasks.tsx:479` 确认 `(task as any).input_data` 上下文
  - [x] SubTask UX5-04.4: 更新 `shared/types/common.ts` 的 Task 类型添加 `input_data?: Record<string, unknown> | string` 与 `error_message?: string` 字段
  - [x] SubTask UX5-04.5: `npm run check` 通过

## Tier 2 — 小工作量（7 项）

- [x] Task UX5-05: index.html 首屏骨架 ✅
  - [x] SubTask UX5-05.1: Read `index.html` 确认现有结构
  - [x] SubTask UX5-05.2: 在 `<div id="root">` 内插入内联 `<style>` + 居中 spinner（纯 CSS 动画）+ KnowledgeMap logo SVG
  - [x] SubTask UX5-05.3: 添加 `<meta name="color-scheme" content="light dark">` 与 prefers-color-scheme 适配
  - [x] SubTask UX5-05.4: 验证 React 渲染后自动替换该 DOM
  - [x] SubTask UX5-05.5: `npm run check` 通过

- [x] Task UX5-06: formatters.ts i18n 化 ✅
  - [x] SubTask UX5-06.1: Read `src/utils/formatters.ts:134-200` 确认 formatDate/formatMinutesInternal 实现
  - [x] SubTask UX5-06.2: 在 `src/i18n/locales/zh-CN/common.json` 和 `en-US/common.json` 添加 `date.*` 和 `duration.*` key
  - [x] SubTask UX5-06.3: 通过 `import i18next from 'i18next'` 直接调用 `i18next.t()`（工具函数非 hook 上下文）
  - [x] SubTask UX5-06.4: 替换所有硬编码中文格式串为 t() 调用
  - [x] SubTask UX5-06.5: `npm run check` 通过

- [x] Task UX5-07: Statistics.tsx dark 模式适配 ✅
  - [x] SubTask UX5-07.1: Read `src/pages/Statistics.tsx` 和 `src/pages/LearningStatsCenter.tsx`（参考 isDark 模式）
  - [x] SubTask UX5-07.2: 在 Statistics.tsx 引入 useTheme 获取 isDark
  - [x] SubTask UX5-07.3: MetricCard 卡片类改为 `isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'`
  - [x] SubTask UX5-07.4: ForecastChart/GrowthChart/ForgettingCurveChart 的 Recharts 配置改为 isDark 三元
  - [x] SubTask UX5-07.5: `npm run check` 通过

- [x] Task UX5-08: Tasks FilterTab 与状态徽章 dark 模式 ✅
  - [x] SubTask UX5-08.1: Read `src/pages/Tasks.tsx:40-52,105-119` 确认现有类名
  - [x] SubTask UX5-08.2: `getStatusBadgeClass` 四组徽章类补充 `dark:` 变体
  - [x] SubTask UX5-08.3: `FilterTab` 选中/未选中类补充 `dark:` 变体
  - [x] SubTask UX5-08.4: `npm run check` 通过

- [x] Task UX5-09: aria-live 动态区域 ✅
  - [x] SubTask UX5-09.1: Read 5 个状态指示器文件
  - [x] SubTask UX5-09.2: 为 LoadingBar/OfflineIndicator/SyncStatusIndicator/SSEStatusIndicator/GlobalSearch 添加 `aria-live="polite" aria-atomic="true"`
  - [x] SubTask UX5-09.3: `npm run check` 通过

- [x] Task UX5-10: 网络状态完整感知 ✅
  - [x] SubTask UX5-10.1: Read `src/hooks/common/useNetworkStatus.ts` 确认 onOnline/onSlowConnection 回调签名
  - [x] SubTask UX5-10.2: Read `src/components/Layout/Layout.tsx` 确认接入点
  - [x] SubTask UX5-10.3: 在 Layout 接入 `useNetworkStatus({ enableSlowDetection: true, onOnline, onSlowConnection })`
  - [x] SubTask UX5-10.4: `src/i18n/locales/zh-CN/common.json` 和 `en-US/common.json` 补充 `backOnline`/`slowConnection` key
  - [x] SubTask UX5-10.5: `npm run check` 通过

- [x] Task UX5-11: 数字千分位格式化 ✅
  - [x] SubTask UX5-11.1: Read `src/utils/formatters.ts` 确认现有导出
  - [x] SubTask UX5-11.2: 新增 `formatNumber(n: number, locale?: string): string`
  - [x] SubTask UX5-11.3: 推广到 LearningStatsCenter/Statistics/PassProgress/StreakDisplay
  - [x] SubTask UX5-11.4: `npm run check` 通过

## Tier 3 — 中等工作量（5 项）

- [x] Task UX5-12: 路由级 ErrorBoundary ✅
  - [x] SubTask UX5-12.1: Read `src/App.tsx:142-200` 确认 `getLazyComponent` 包装层
  - [x] SubTask UX5-12.2: Read `src/components/common/ErrorBoundary.tsx` 确认现有 props/fallback
  - [x] SubTask UX5-12.3: 新增 `RouteErrorFallback` 组件（含"重试"和"返回首页"按钮）
  - [x] SubTask UX5-12.4: 在 ErrorBoundary 添加 `fallbackRender` 渲染属性支持；LazyRoute 包装 lazy 组件
  - [x] SubTask UX5-12.5: `npm run check` + `npm run lint` 通过

- [x] Task UX5-13: EmptyState 覆盖率提升 ✅
  - [x] SubTask UX5-13.1: Read `src/components/common/EmptyState.tsx` 确认 props 接口
  - [x] SubTask UX5-13.2: 替换 8 处纯文本空状态为 EmptyState 含 CTA（ActivityTimeline/ConsoleHistory/ConceptAggregationPanel×2/HierarchyTreeView/AliasEditor/Templates/Tasks）
  - [x] SubTask UX5-13.3: `npm run check` 通过

- [x] Task UX5-14: Skeleton 覆盖率提升 ✅
  - [x] SubTask UX5-14.1: Read `src/components/common/Skeleton.tsx` 和 `SkeletonCard.tsx` 确认可用骨架组件
  - [x] SubTask UX5-14.2: 为 8 个页面的加载态替换为对应骨架（Templates/Achievements/Statistics/LearningStatsCenter/Tasks/QuizList/QuizPractice/RecycleBin）
  - [x] SubTask UX5-14.3: `npm run check` 通过

- [x] Task UX5-15: 多文件硬编码中文 i18n ✅
  - [x] SubTask UX5-15.1: `src/pages/QuizPractice.tsx` 替换多处中文为 t() 调用
  - [x] SubTask UX5-15.6: `src/components/common/OfflineIndicator.tsx` 离线提示改为 t()
  - [x] SubTask UX5-15.7: `src/components/common/ErrorBoundary.tsx` 错误文案改为 i18next.t()（class component）
  - [x] SubTask UX5-15.8: 对应 locale 文件补充 key（zh-CN/en-US errors.json boundary 段已含 retry/reload/goHome 等）
  - [x] SubTask UX5-15.9: `npm run check` + `npm run lint` 通过
  - [ ] SubTask UX5-15.2~15.5: QuizTypeConfig/QuestionForm/TaskCard/CalendarMonthView 推迟到后续轮次（已不属本轮关键路径）

- [x] Task UX5-16: LazyImage 覆盖率推广 ✅
  - [x] SubTask UX5-16.1: Grep 全项目 `<img` 标签使用位置
  - [x] SubTask UX5-16.2: Read `src/components/common/LazyImage.tsx` 确认 props 接口
  - [x] SubTask UX5-16.3: 替换 3 处非关键路径图片为 LazyImage（NodeDetailSidebar/CombinedNodeDetailSidebar/ExportDialog）
  - [x] SubTask UX5-16.4: `npm run check` 通过

## 全局验证

- [x] Task V1: `npm run check` 通过 ✅
- [x] Task V2: `npm run lint` 通过 ✅
- [x] Task V3: Profile.tsx 与 Tasks.tsx 中不再存在 `as any`（Grep 验证）✅

# Task Dependencies

## Tier 内依赖
- [Tier 1: UX5-01 ~ UX5-04] 全部可并行
- [Tier 2: UX5-05 ~ UX5-11] 大部分可并行；UX5-06（formatters i18n）与 UX5-11（formatNumber）都修改 formatters.ts，需协调避免冲突
- [Tier 3: UX5-12 ~ UX5-16] 全部可并行；UX5-15 修改 Tasks.tsx 与 Tier 1 的 UX5-04 修改 Tasks.tsx 需协调

## Tier 间依赖
- UX5-04（清理 Tasks as any）应在 UX5-15（多文件 i18n）之前完成，避免同一文件并行修改冲突
- UX5-06（formatters i18n）应在 UX5-11（formatNumber）之前完成，因为两者都修改 formatters.ts

## 建议分组（便于 sub-agent 复用模式）
- **导航/响应式组**：UX5-01 + UX5-02 + UX5-03（小改动集中处理）
- **类型清理组**：UX5-04（独立，需类型派生）
- **i18n 基础设施组**：UX5-06 + UX5-11（formatters.ts 集中处理）+ UX5-15（多文件 i18n）
- **dark 模式组**：UX5-07 + UX5-08（统计/Tasks 配色统一）
- **a11y 组**：UX5-09 + UX5-10（aria-live + 网络状态感知）
- **覆盖率提升组**：UX5-13 + UX5-14 + UX5-16（EmptyState/Skeleton/LazyImage 推广）
- **独立**：UX5-05（index.html 首屏）+ UX5-12（ErrorBoundary）
