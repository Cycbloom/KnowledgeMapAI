# UX 微改进路线图 Round 5 Spec

## Why
前四轮 UX 微改进共 65 项已完成。本轮延续"小改动、大体验"定位，针对项目当前仍存在的五个核心缺口：① 路由级 ErrorBoundary 缺失，单页崩溃导致整站白屏；② `formatters.ts` 通用工具硬编码中文，i18n 完全失效；③ Statistics/Tasks 等页面 dark 模式缺失或对比度不足；④ EmptyState/Skeleton 组件已存在但覆盖率极低（仅 1-2 处使用）；⑤ 多处 `window.location.href` 内部导航导致整页刷新、`as any` 违反项目规则、缺 aria-live、数字无千分位等细节问题。

## 候选功能清单

### Tier 1 — 极小工作量（每个 ≤3 文件，≤20 行）

| 编号 | 功能 | 问题 | 方案 | 改动文件数 | 预估行数 |
|------|------|------|------|-----------|---------|
| UX5-01 | window.location.href 内部导航改用 navigate | CalendarPage、useCombinedGraphAIOperations、console system command 共 4 处用 `window.location.href` 触发整页刷新，丢失 SPA 状态 | 改用 `useNavigate()` 的 `navigate()` | 3 | ~10 |
| UX5-02 | Register/Login 固定宽度改响应式 | `Register.tsx:45` 和 `Login.tsx` 用 `w-96` 固定宽度，360px 手机出现水平滚动条 | 改为 `w-full max-w-md mx-4` | 2 | ~2 |
| UX5-03 | CombinedViewPage 节点详情面板 dark 适配 | 节点详情面板硬编码 `bg-gray-800/90 text-white`，亮色模式下突兀；"✕" 字符无 aria-label | 改为 isDark 三元；用 lucide `<X>` + aria-label | 1 | ~10 |
| UX5-04 | Profile.tsx 与 Tasks.tsx 清理 as any | Profile.tsx 3 处 `as any`、Tasks.tsx 1 处 `(task as any).input_data` 违反项目"禁止 any"规则 | 派生正确类型或更新 UserTask 类型定义 | 2-3 | ~15 |

### Tier 2 — 小工作量（每个 ≤8 文件，≤80 行）

| 编号 | 功能 | 问题 | 方案 | 改动文件数 | 预估行数 |
|------|------|------|------|-----------|---------|
| UX5-05 | index.html 首屏空白填充 | `<div id="root">` 是空的，从 HTML 下载到 React 首次渲染期间纯白屏 | 在 root 内插入内联 CSS spinner + logo，React 渲染后自动替换 | 1 | ~30 |
| UX5-06 | formatters.ts i18n 化 | `formatDate`/`formatDuration` 工具硬编码"刚刚/X分钟前/X小时前"等中文，en-US 用户仍看到中文 | 将格式串移入 i18n `common.date.*`/`common.duration.*`，函数支持 locale 参数 | 1 + 2 locale | ~80 |
| UX5-07 | Statistics.tsx dark 模式适配 | MetricCard/ForecastChart/GrowthChart/ForgettingCurveChart 内部全用 `bg-white`/`text-gray-800` 硬编码亮色，dark 模式下白底浅字对比度严重不足 | 参考 LearningStatsCenter.tsx 的 isDark 三元模式适配图表与卡片配色 | 1 | ~50 |
| UX5-08 | Tasks FilterTab 与状态徽章 dark 模式 | `getStatusBadgeClass` 四组徽章类、`FilterTab` 选中/未选中类全部无 `dark:` 变体 | 补齐 dark: 类（参考 KanbanView 配色） | 1 | ~20 |
| UX5-09 | aria-live 动态区域 | LoadingBar/OfflineIndicator/SyncStatusIndicator/SSEStatusIndicator/GlobalSearch 状态变化时屏幕阅读器无感知 | 为这些状态指示器外层加 `aria-live="polite" aria-atomic="true"` | 6 | ~12 |
| UX5-10 | 网络状态完整感知 | OfflineIndicator 仅显示离线，恢复在线/慢网络无提示 | Layout 接入 `useNetworkStatus({ enableSlowDetection, onOnline, onSlowConnection })`，回调触发 message.success/warning | 2 | ~20 |
| UX5-11 | 数字千分位格式化 | 统计页/学习时长/XP 等大数字直接输出原始数字，超 10000 难读 | formatters.ts 新增 `formatNumber(n, locale)` 工具，统计卡片接入 | 1 + 5-8 调用点 | ~15 |

### Tier 3 — 中等工作量（每个 ≤10 文件，≤150 行）

| 编号 | 功能 | 问题 | 方案 | 改动文件数 | 预估行数 |
|------|------|------|------|-----------|---------|
| UX5-12 | 路由级 ErrorBoundary | 仅顶层和 Layout 外有 1 个 ErrorBoundary，28 个 lazy 路由任一抛错会让整个 Layout 崩溃 | 在 App.tsx 的 `getLazyComponent` 包装层为每个 lazy 组件套 `<ErrorBoundary fallback={RouteErrorFallback}>`，保留侧边栏/顶栏可点击 | 1-2 | ~50 |
| UX5-13 | EmptyState 覆盖率提升 | 项目已有 EmptyState 组件支持 CTA，但仅 1 处使用；8+ 处空状态用纯 `<p>暂无XXX</p>` 无引导 | 将 Calendar ActivityTimeline、ConsoleHistory、ConceptAggregation 4 个子组件、Templates、Tasks 等空状态替换为 EmptyState 含 CTA | 8 | ~50 |
| UX5-14 | Skeleton 覆盖率提升 | Round 3 加了 Skeleton/SkeletonCard 但仅 Dashboard 1 处使用；8 个列表页仍用 spinner | Templates/Achievements/Statistics/LearningStatsCenter/Tasks/QuizList/QuizPractice/RecycleBin 加载态替换为对应骨架 | 8 | ~120 |
| UX5-15 | 多文件硬编码中文 i18n | QuizPractice/QuizTypeConfig/QuestionForm/TaskCard/CalendarMonthView/OfflineIndicator/ErrorBoundary 共 8 文件多处硬编码中文 | 抽取到对应 i18n JSON 文件用 t() 替换 | 8 + locale | ~150 |
| UX5-16 | LazyImage 覆盖率审计与推广 | 项目已有 LazyImage 组件（带 IntersectionObserver/骨架/错误回退），但仅 3 处使用，其余 `<img>` 直接使用无懒加载 | 审计所有 `<img>` 调用，非关键路径图片替换为 LazyImage | 5-8 | ~30 |

## Impact
- 仅涉及前端 `src/` 目录和 `index.html`，不涉及后端 API 变更
- UX5-12（路由级 ErrorBoundary）是本轮最高价值项，消除单点崩溃导致的整站白屏
- UX5-06（formatters i18n）影响全项目日期/时长显示，是 i18n 基础设施级修复
- UX5-07/08（dark 模式）让暗色主题在统计/Tasks 页真正可用
- UX5-13/14（EmptyState/Skeleton 覆盖率）让 Round 3 已有的组件真正发挥作用
- UX5-04（as any 清理）符合项目"禁止 any"硬规则
- 所有功能均为增量添加或就地替换，不影响现有功能

## ADDED Requirements

### Requirement: window.location.href 内部导航改用 navigate (UX5-01)
系统 SHALL 将 CalendarPage、useCombinedGraphAIOperations、console system command 中 4 处 `window.location.href` 内部导航改用 React Router 的 `navigate()`，避免整页刷新丢失 SPA 状态。

#### Scenario: 用户在日历点击任务事件
- **WHEN** 用户在 CalendarPage 点击任务事件
- **THEN** 通过 navigate 跳转到 `/scheduler/task/{id}`，不触发整页刷新，返回时保留月视图位置

### Requirement: Register/Login 响应式宽度 (UX5-02)
系统 SHALL 将 Register 和 Login 页面的固定 `w-96` 改为响应式 `w-full max-w-md mx-4`，确保 360px 手机宽度下不出现水平滚动条。

### Requirement: CombinedViewPage 节点详情面板 dark 适配 (UX5-03)
系统 SHALL 将 CombinedViewPage 节点详情面板的硬编码深色样式改为基于 isDark 的三元表达式，并将 "✕" 字符替换为带 aria-label 的 lucide `<X>` 图标。

### Requirement: 清理 Profile/Tasks as any (UX5-04)
系统 SHALL 移除 Profile.tsx 中 3 处 `as any` 和 Tasks.tsx 中 1 处 `(task as any).input_data`，通过派生正确类型或更新 UserTask 类型定义替代。

### Requirement: index.html 首屏骨架 (UX5-05)
系统 SHALL 在 `index.html` 的 `<div id="root">` 内插入内联 CSS spinner 和 KnowledgeMap logo，使首屏加载期间显示视觉反馈而非白屏。

#### Scenario: 用户首次打开应用
- **WHEN** 用户打开应用，HTML 已下载但 React 尚未首次渲染
- **THEN** 用户看到居中的 spinner + logo，而非白屏

### Requirement: formatters.ts i18n 化 (UX5-06)
系统 SHALL 将 `formatters.ts` 中的日期/时长格式化字符串移入 i18n，`formatDate`/`formatDuration` 支持 locale 参数，使 en-US 用户看到 "Mar 15, 2024" / "3 min ago" 而非中文。

### Requirement: Statistics.tsx dark 模式适配 (UX5-07)
系统 SHALL 将 Statistics.tsx 的 MetricCard/ForecastChart/GrowthChart/ForgettingCurveChart 配色改为基于 isDark 的三元表达式，使 dark 模式下对比度达标。

### Requirement: Tasks FilterTab 与状态徽章 dark 模式 (UX5-08)
系统 SHALL 为 Tasks 页面的 `getStatusBadgeClass` 和 `FilterTab` 类名补充 `dark:` 变体。

### Requirement: aria-live 动态区域 (UX5-09)
系统 SHALL 为 LoadingBar/OfflineIndicator/SyncStatusIndicator/SSEStatusIndicator/GlobalSearch 等状态指示器外层添加 `aria-live="polite" aria-atomic="true"`，使屏幕阅读器在状态变化时播报。

### Requirement: 网络状态完整感知 (UX5-10)
系统 SHALL 在 Layout 接入 `useNetworkStatus({ enableSlowDetection: true, onOnline, onSlowConnection })`，恢复在线时显示 success toast，慢网络时显示 warning toast。

#### Scenario: 用户从离线恢复在线
- **WHEN** 用户网络从离线恢复在线
- **THEN** 系统显示 message.success("已恢复在线，正在同步数据") toast

### Requirement: 数字千分位格式化 (UX5-11)
系统 SHALL 在 formatters.ts 新增 `formatNumber(n, locale)` 工具函数，统计卡片/学习时长/XP 显示处接入，使大数字显示千分位分隔符。

### Requirement: 路由级 ErrorBoundary (UX5-12)
系统 SHALL 在 App.tsx 的 `getLazyComponent` 包装层为每个 lazy 组件套 `<ErrorBoundary fallback={RouteErrorFallback}>`，使单个路由崩溃时仅该路由区域显示错误 fallback，保留侧边栏/顶栏可点击。

#### Scenario: 某路由组件抛错
- **WHEN** 用户访问 Statistics 页面且该页面组件抛出未捕获错误
- **THEN** 仅 Statistics 路由区域显示错误 fallback（含"重试"按钮），侧边栏/顶栏保持可用，用户可导航到其他页面

### Requirement: EmptyState 覆盖率提升 (UX5-13)
系统 SHALL 将 Calendar ActivityTimeline、ConsoleHistory、ConceptAggregation 4 个子组件、Templates、Tasks 等 8+ 处纯文本空状态替换为 EmptyState 组件，含图标、标题、描述和 CTA 按钮。

### Requirement: Skeleton 覆盖率提升 (UX5-14)
系统 SHALL 将 Templates/Achievements/Statistics/LearningStatsCenter/Tasks/QuizList/QuizPractice/RecycleBin 等 8 个页面的加载态从 spinner 替换为对应骨架屏，避免加载时布局抖动。

### Requirement: 多文件硬编码中文 i18n (UX5-15)
系统 SHALL 将 QuizPractice/QuizTypeConfig/QuestionForm/TaskCard/CalendarMonthView/OfflineIndicator/ErrorBoundary 共 8 文件的硬编码中文抽取到 i18n JSON 文件用 t() 替换。

### Requirement: LazyImage 覆盖率推广 (UX5-16)
系统 SHALL 审计所有 `<img>` 标签使用，将非关键路径图片（节点封面图、用户头像、富文本图片等）替换为 LazyImage 组件，启用懒加载、骨架占位和错误回退。

## MODIFIED Requirements
无（所有功能均为增量添加或就地替换）

## REMOVED Requirements
无
