# UX 微改进 Round 5 Checklist

## Tier 1 — 极小工作量

- [x] UX5-01: CalendarPage、useCombinedGraphAIOperations 共 3 处 `window.location.href` 改用 `navigate()`（system.ts console 命令保留 window.location.href，因在 React 上下文外）
- [x] UX5-01 验证: 在 CalendarPage 点击任务事件不触发整页刷新，返回时保留月视图位置
- [x] UX5-02: Register.tsx 的 `w-96` 改为 `w-full max-w-md mx-4`，360px 手机无水平滚动条
- [x] UX5-03: CombinedViewPage 节点详情面板配色基于 isDark 三元；"✕" 字符替换为带 aria-label 的 lucide `<X>` 图标
- [x] UX5-04: Profile.tsx 中 3 处 `as any` 已移除，用 `?.` 链式访问替代
- [x] UX5-04 验证: Tasks.tsx 中 `(task as any).input_data` 与 `(task as any).error_message` 已移除，Task 类型已添加 `input_data?` 与 `error_message?` 字段

## Tier 2 — 小工作量

- [x] UX5-05: `index.html` 的 `<div id="root">` 内含内联 CSS spinner + KnowledgeMap logo
- [x] UX5-05 验证: 首屏加载期间显示居中 spinner 而非白屏
- [x] UX5-05 验证: `<meta name="color-scheme" content="light dark">` 已添加
- [x] UX5-06: `formatters.ts` 的 formatDate/formatDuration 格式串已移入 i18n
- [x] UX5-06 验证: en-US 用户看到 "Mar 15, 2024" / "3 min ago" 等英文格式
- [x] UX5-06 验证: zh-CN/common.json 和 en-US/common.json 已补充 `date.*` / `duration.*` key
- [x] UX5-07: Statistics.tsx 的 MetricCard/ForecastChart/GrowthChart/ForgettingCurveChart 配色基于 isDark 三元
- [x] UX5-07 验证: dark 模式下统计页对比度达标，无白底浅字
- [x] UX5-08: Tasks.tsx 的 `getStatusBadgeClass` 和 `FilterTab` 类名已补充 `dark:` 变体
- [x] UX5-09: LoadingBar/OfflineIndicator/SyncStatusIndicator/SSEStatusIndicator/GlobalSearch 外层已添加 `aria-live="polite" aria-atomic="true"`
- [x] UX5-10: Layout 已接入 `useNetworkStatus({ enableSlowDetection, onOnline, onSlowConnection })`
- [x] UX5-10 验证: 从离线恢复在线时显示 message.success toast
- [x] UX5-10 验证: 慢网络时显示 message.warning toast
- [x] UX5-10 验证: zh-CN/common.json 和 en-US/common.json 已补充 `backOnline` / `slowConnection` key
- [x] UX5-11: formatters.ts 新增 `formatNumber(n, locale)` 工具函数
- [x] UX5-11 验证: LearningStatsCenter/Statistics/Achievements 等大数字显示千分位分隔符

## Tier 3 — 中等工作量

- [x] UX5-12: App.tsx 的 `LazyRoute` 为每个 lazy 组件套 `<ErrorBoundary fallbackRender={...}>`
- [x] UX5-12 验证: 单个路由崩溃时仅该路由区域显示错误 fallback，侧边栏/顶栏保持可用
- [x] UX5-12 验证: RouteErrorFallback 含"重试"和"返回首页"按钮
- [x] UX5-13: Calendar ActivityTimeline/ConsoleHistory/ConceptAggregation 4 子组件/Templates/Tasks 等 8 处空状态已替换为 EmptyState 含 CTA
- [x] UX5-14: Templates/Achievements/Statistics/LearningStatsCenter/Tasks/QuizList/QuizPractice/RecycleBin 加载态已替换为对应骨架屏
- [x] UX5-14 验证: 加载时无布局抖动
- [x] UX5-15: QuizPractice/OfflineIndicator/ErrorBoundary 硬编码中文已 i18n（QuizTypeConfig/QuestionForm/TaskCard/CalendarMonthView 推迟至后续轮次）
- [x] UX5-15 验证: 对应 locale 文件已补充 key（errors.json boundary 段、study.json quizPractice 段、common.json offlineMode）
- [x] UX5-16: 3 处非关键路径 `<img>` 已替换为 LazyImage（NodeDetailSidebar/CombinedNodeDetailSidebar/ExportDialog）
- [x] UX5-16 验证: 替换后的图片有懒加载、骨架占位、错误回退

## 全局验证

- [x] `npm run check` 通过
- [x] `npm run lint` 通过
- [x] Profile.tsx 与 Tasks.tsx 中不再存在 `as any`（Grep 验证）
