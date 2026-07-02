# UX 微改进路线图 Round 6 Spec

## Why
前五轮 UX 微改进共 81 项已完成。本轮延续"小改动、大体验"定位，针对项目当前仍存在的五个核心缺口：① 路由切换无 scroll-to-top，长页面切短页面时滚动位置残留；② 30+ 模态对话框无 Escape、无 focus trap、无 `role=dialog`，严重违反 WCAG 2.1.2/2.4.3；③ QuizPreview、CurrentTask 等高频页面仍硬编码 35+ 处中文未 i18n；④ 20+ 处 icon-only 按钮用 `title=` 而非 `aria-label=`，屏幕阅读器无法识别；⑤ 多处 `navigator.clipboard.writeText` 无 toast 反馈、NotificationCenter 5 处静默 catch 用户无感知、Calendar/Scheduler 60+ 处 `toLocaleDateString("zh-CN")` 硬编码 locale。

## 候选功能清单

### Tier 1 — 极小工作量（每个 ≤3 文件，≤20 行）

| 编号 | 功能 | 问题 | 方案 | 改动文件数 | 预估行数 |
|------|------|------|------|-----------|---------|
| R6-01 | Home.tsx 占位页 i18n 与实质化 | `src/pages/Home.tsx` 整页仅 `<div>主页</div>`，硬编码中文且无实质内容，用户访问 `/` 看到空页面 | 改为 `<Navigate to="/dashboard" replace />` 重定向到 Dashboard，避免空页 | 1 | ~5 |
| R6-02 | 路由切换 scroll-to-top | 全代码库 0 处 `window.scrollTo`；长页面（Tasks、Statistics）切到短页面时滚动位置保留，体验差 | 新建 `<ScrollToTop />` 组件挂在内层 Routes 上方，监听 pathname 变化 `window.scrollTo(0,0)` | 1-2 | ~12 |
| R6-03 | CopyButton 复制反馈与 i18n | `src/components/common/CopyButton.tsx:25` `title="复制错误信息"` 硬编码；catch 块静默失败 | title/aria-label 改 i18n；成功加 `message.success`，失败加 `message.error` | 1 | ~10 |
| R6-04 | CodeBlock 复制反馈与 i18n | `src/components/common/CodeBlock.tsx` "复制代码"/"已复制"/"复制" 硬编码；catch 静默失败 | 文本 i18n；catch 内加 `message.error`；按钮加 `aria-label` | 1 | ~12 |
| R6-05 | Tasks.tsx 死代码 fallback 清理 | `src/pages/Tasks.tsx:87` `t("tasks.reviewGeneration") \|\| "复习任务生成"` 硬编码 fallback（i18n key 已存在但写法不规范） | 补全 locale key 确保不返回 fallback；移除 `\|\| "..."` 死代码 | 2 | ~5 |

### Tier 2 — 小工作量（每个 ≤8 文件，≤80 行）

| 编号 | 功能 | 问题 | 方案 | 改动文件数 | 预估行数 |
|------|------|------|------|-----------|---------|
| R6-06 | QuizPreview.tsx 硬编码中文 i18n 化 | `src/pages/QuizPreview.tsx` 20+ 处硬编码：statusConfig labels、difficultyLabels、asyncConfirm 文案、加载/错误态、按钮文本、3 处 message.error | 抽取到 `study.json` 的 `quizPreview.*`；statusConfig/difficultyLabels 改为组件内函数返回 t() | 2 | ~60 |
| R6-07 | CurrentTask.tsx 硬编码中文 i18n 化 | `src/pages/CurrentTask.tsx` 15+ 处硬编码：加载态、空态、CTA、声音/通知 toggle、专注/休息、暂停/继续/完成、跳过任务等 | 抽取到 `scheduler.json` 的 `currentTask.*` | 2 | ~50 |
| R6-08 | ShareDialog i18n + a11y 修复 | `src/components/collaborators/ShareDialog.tsx` 4 处硬编码中文；无 Escape 关闭；关闭按钮 icon-only 无 `aria-label`；无 `role=dialog`/`aria-modal` | i18n 4 字符串；加 Escape 监听；加 `role="dialog"`/`aria-modal="true"`/`aria-labelledby`；关闭按钮加 `aria-label` | 2 | ~25 |
| R6-09 | QuizGenerationModal i18n + a11y | `src/components/Quiz/QuizGenerationModal.tsx` 5+ 处硬编码；无 Escape；无 `role=dialog`；icon-only 关闭按钮无 `aria-label` | i18n 字符串；加 Escape；加 `role=dialog`/`aria-modal`；icon-only 按钮加 `aria-label` | 2 | ~30 |
| R6-10 | NotificationCenter 静默 catch 用户反馈 | `src/components/Notifications/NotificationCenter.tsx` 5 处用户操作失败仅 `console.error`：加载列表失败、加载未读数失败、标记已读失败、全部已读失败、删除通知失败 | 5 处加 `message.error(t('notifications.*Failed'))` | 1 + 2 locale | ~20 |
| R6-11 | Icon-only 按钮 aria-label 批量修复 | NotificationCenter、RelatedGraphsPanel、CurrentTask、AnalysisModuleCard、GlobalSearch、ShortcutHelpPanel、CombinedNodeEditSidebar、HierarchyTreeView、AggregationResultsView 等 20+ 处 icon-only 按钮仅有 `title=` 无 `aria-label=` | 把 `title=` 同步加 `aria-label=`（同 i18n key），硬编码 title 一并 i18n 化 | 8 | ~50 |
| R6-12 | 页面级 Loader2 → Skeleton（R5 漏项） | `QuizPreview.tsx` 整页 Loader2、`CurrentTask.tsx` 整页 border-spin、`GraphEditor.tsx` ViewLoader 用 `bg-white/50` + Loader2（且无 `dark:` 变体） | 替换为 `Skeleton`/`SkeletonCard`；GraphEditor ViewLoader 补 `dark:bg-slate-900/50` | 3 | ~25 |
| R6-13 | 复制操作 toast 反馈批量补齐 | DashboardCardContextMenu、AnalysisResultView、LiteratureMetadataCard、LiteratureExtractPanel、ChatMessage、ShareLink 共 6 处 `navigator.clipboard.writeText` 后无 toast 反馈、无 catch | 改为调用已有 `copyToClipboard` 工具（已内置 toast 与 i18n） | 6 | ~30 |
| R6-14 | 小页面 i18n 拾遗 | CombinedGraphView、LearningPathDetail、TaskDetailPage、GraphEditor、GraphMap 共 8 处硬编码："缺少图谱 ID 参数"/"加载图谱数据失败"/"加载中..."/"删除学习路径"/"任务ID不存在"/"新节点"/"未知错误"/"创建节点失败" 等 | 抽取到对应 i18n namespace（graph/learning/tasks/common），替换为 t() | 5 + locale | ~30 |

### Tier 3 — 中等工作量（每个 ≤10 文件，≤150 行）

| 编号 | 功能 | 问题 | 方案 | 改动文件数 | 预估行数 |
|------|------|------|------|-----------|---------|
| R6-15 | 模态对话框可访问性批量修复 | 30+ 模态中只有 ConfirmationModal/HelpModal 用 `useFocusTrap`（hook 已存在但未复用）；其余均无 Escape、无 focus trap、无 `role="dialog"`/`aria-modal="true"`，违反 WCAG 2.1.2/2.4.3 | 新建 `ModalShell` 组件封装 `useFocusTrap` + Escape + role/aria-modal/aria-labelledby + 点击遮罩关闭；8 个高频模态替换为 `<ModalShell>` 包裹 | 9（1 新增 + 8 修改） | ~120 |
| R6-16 | 日期格式化 i18n 批量修复（Calendar/Scheduler 模块） | CalendarWeekView、CalendarDayView、CalendarScheduleView、ActivityTimeline、SchedulerStats、LearningStatsEnhanced、DailyReview、DailyStats、FocusHeatmap、MonthlyReport 共 60+ 处 `toLocaleDateString("zh-CN", {...})` 硬编码 locale，英文环境下显示中文日期 | 批量替换为 `formatDate(date, 'short')`/`'full-datetime'`/`'time'` 等已有 format pattern（formatters.ts 已支持 i18n） | 10 | ~80 |

## Impact
- 仅涉及前端 `src/` 目录，不涉及后端 API 变更
- R6-02（ScrollToTop）影响全站路由体验，是本轮最高 ROI 项
- R6-15（ModalShell）是本轮最高价值项，统一模态可访问性基础设施，后续新模态直接复用
- R6-06/R6-07（QuizPreview/CurrentTask i18n）覆盖用户高频路径 35+ 处硬编码中文
- R6-16（日期 i18n）是 i18n 基础设施级修复，让英文环境真正可用
- R6-11/R6-13 是细节可访问性与反馈补齐，提升整体专业感
- 所有功能均为增量添加或就地替换，不影响现有功能

## ADDED Requirements

### Requirement: Home.tsx 占位页实质化 (R6-01)
系统 SHALL 将 `src/pages/Home.tsx` 改为 `<Navigate to="/dashboard" replace />` 重定向，避免用户访问 `/` 时看到空页面。

### Requirement: 路由切换 scroll-to-top (R6-02)
系统 SHALL 在路由 pathname 变化时自动滚动到页面顶部，避免长页面切到短页面时滚动位置残留。

#### Scenario: 用户从长页面切换到短页面
- **WHEN** 用户在 Tasks 页面（长列表）滚动到中部，点击侧边栏导航到 Dashboard
- **THEN** Dashboard 页面从顶部开始展示，不保留 Tasks 的滚动位置

### Requirement: CopyButton 复制反馈与 i18n (R6-03)
系统 SHALL 将 CopyButton 的 `title="复制错误信息"` 改为 i18n，并在复制成功/失败时显示 toast 反馈。

### Requirement: CodeBlock 复制反馈与 i18n (R6-04)
系统 SHALL 将 CodeBlock 的 "复制代码"/"已复制"/"复制" 文本移入 i18n，catch 内加 `message.error`，按钮加 `aria-label`。

### Requirement: Tasks.tsx 死代码 fallback 清理 (R6-05)
系统 SHALL 在 locale 文件补全 `tasks.reviewGeneration` key，并移除 `t("tasks.reviewGeneration") || "复习任务生成"` 中的硬编码 fallback。

### Requirement: QuizPreview.tsx 硬编码中文 i18n 化 (R6-06)
系统 SHALL 将 QuizPreview.tsx 中 20+ 处硬编码中文（statusConfig labels、difficultyLabels、asyncConfirm 文案、加载/错误态、按钮文本、message.error）抽取到 `study.json` 的 `quizPreview.*` 命名空间。

### Requirement: CurrentTask.tsx 硬编码中文 i18n 化 (R6-07)
系统 SHALL 将 CurrentTask.tsx 中 15+ 处硬编码中文（加载态、空态、CTA、toggle、专注/休息、跳过任务等）抽取到 `scheduler.json` 的 `currentTask.*` 命名空间。

### Requirement: ShareDialog i18n + a11y 修复 (R6-08)
系统 SHALL 为 ShareDialog 添加 i18n、Escape 关闭、`role="dialog"`/`aria-modal="true"`/`aria-labelledby`、关闭按钮 `aria-label`。

### Requirement: QuizGenerationModal i18n + a11y (R6-09)
系统 SHALL 为 QuizGenerationModal 添加 i18n、Escape 关闭、`role=dialog`/`aria-modal`、icon-only 按钮的 `aria-label`。

### Requirement: NotificationCenter 静默 catch 用户反馈 (R6-10)
系统 SHALL 在 NotificationCenter 的 5 处用户操作失败 catch 块中添加 `message.error(t('notifications.*Failed'))` 反馈，使用户感知失败。

### Requirement: Icon-only 按钮 aria-label 批量修复 (R6-11)
系统 SHALL 为 NotificationCenter、RelatedGraphsPanel、CurrentTask、AnalysisModuleCard、GlobalSearch、ShortcutHelpPanel、CombinedNodeEditSidebar、HierarchyTreeView、AggregationResultsView 等 20+ 处 icon-only 按钮添加 `aria-label`（与 title 同源 i18n key），并将硬编码 title 一并 i18n 化。

### Requirement: 页面级 Loader2 → Skeleton (R6-12)
系统 SHALL 将 QuizPreview 整页 Loader2、CurrentTask 整页 border-spin、GraphEditor ViewLoader 替换为 Skeleton/SkeletonCard，并为 GraphEditor ViewLoader 补充 `dark:bg-slate-900/50` 暗色背景。

### Requirement: 复制操作 toast 反馈批量补齐 (R6-13)
系统 SHALL 将 DashboardCardContextMenu、AnalysisResultView、LiteratureMetadataCard、LiteratureExtractPanel、ChatMessage、ShareLink 共 6 处 `navigator.clipboard.writeText` 改为调用已有的 `copyToClipboard` 工具（内置 toast 与 i18n）。

### Requirement: 小页面 i18n 拾遗 (R6-14)
系统 SHALL 将 CombinedGraphView、LearningPathDetail、TaskDetailPage、GraphEditor、GraphMap 共 8 处硬编码中文抽取到对应 i18n namespace 并替换为 t()。

### Requirement: 模态对话框可访问性批量修复 (R6-15)
系统 SHALL 新建 `ModalShell` 组件封装 `useFocusTrap` + Escape + `role="dialog"`/`aria-modal="true"`/`aria-labelledby` + 点击遮罩关闭，并将 QuizGenerationModal、ShareDialog、NodeSelectorModal、GenerateCardsModal、GraphOverviewEditModal、BatchGenerateDialog、GraphSettingsModal、VersionHistoryModal 等 8 个高频模态替换为 `<ModalShell>` 包裹。

#### Scenario: 键盘用户打开模态
- **WHEN** 键盘用户按 Tab 焦点进入模态
- **THEN** 焦点被限制在模态内（focus trap），Tab 不会跳到模态背后的元素
- **WHEN** 用户按 Escape
- **THEN** 模态关闭，焦点返回触发按钮

### Requirement: 日期格式化 i18n 批量修复 (R6-16)
系统 SHALL 将 CalendarWeekView、CalendarDayView、CalendarScheduleView、ActivityTimeline、SchedulerStats、LearningStatsEnhanced、DailyReview、DailyStats、FocusHeatmap、MonthlyReport 共 60+ 处 `toLocaleDateString("zh-CN", {...})` 替换为 `formatDate(date, 'short')`/`'full-datetime'`/`'time'` 等已有 i18n format pattern，使英文环境下显示英文日期。

## MODIFIED Requirements
无（所有功能均为增量添加或就地替换）

## REMOVED Requirements
无
