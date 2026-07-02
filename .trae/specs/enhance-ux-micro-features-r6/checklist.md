# UX 微改进 Round 6 Checklist

## Tier 1 — 极小工作量

- [x] R6-01: Home.tsx 改为 `<Navigate to="/dashboard" replace />`，访问 `/` 不再显示空页
- [x] R6-02: 新建 ScrollToTop 组件，挂载在 App.tsx 的 Routes 上方
- [x] R6-02 验证: 从 Tasks 长列表页面切换到 Dashboard 时，Dashboard 从顶部开始展示
- [x] R6-03: CopyButton 的 title/aria-label 已 i18n；成功显示 message.success，失败显示 message.error
- [x] R6-04: CodeBlock 的"复制代码"/"已复制"/"复制"已 i18n；catch 内有 message.error；按钮有 aria-label
- [x] R6-04 验证: zh-CN/common.json 和 en-US/common.json 已补充 `copyCode` 和 `copyError` key
- [x] R6-05: Tasks.tsx 中 `t("tasks.reviewGeneration") || "复习任务生成"` 的硬编码 fallback 已移除
- [x] R6-05 验证: zh-CN/tasks.json 和 en-US/tasks.json 已含 `reviewGeneration` key（原缺失，已补充）

## Tier 2 — 小工作量

- [x] R6-06: QuizPreview.tsx 中 20+ 处硬编码中文已替换为 t() 调用
- [x] R6-06 验证: statusConfig 和 difficultyLabels 改为组件内函数返回 t() 结果（切换语言会刷新）
- [x] R6-06 验证: zh-CN/study.json 和 en-US/study.json 已含 `quizPreview.*` 命名空间（27 个 key）
- [x] R6-07: CurrentTask.tsx 中 15+ 处硬编码中文已替换为 t() 调用
- [x] R6-07 验证: zh-CN/scheduler.json 和 en-US/scheduler.json 已含 `currentTask.*` 命名空间（47 个 key，含 QUEUE_CONFIG）
- [x] R6-08: ShareDialog 4 处硬编码中文已 i18n
- [x] R6-08 验证: ShareDialog 加了 Escape 关闭、role=dialog、aria-modal=true、aria-labelledby
- [x] R6-08 验证: ShareDialog 关闭按钮有 aria-label={t('common.close')}
- [x] R6-08 验证: 新建 collaborators.json 并在 index.ts 注册
- [x] R6-09: QuizGenerationModal 5+ 处硬编码中文已 i18n
- [x] R6-09 验证: QuizGenerationModal 加了 Escape、role=dialog、aria-modal，icon-only 按钮有 aria-label
- [x] R6-09 验证: study.json 添加 `quizGeneration.*` 命名空间（4 个 key）
- [x] R6-10: NotificationCenter 5 处静默 catch 已加 message.error(t('notifications.*Failed'))
- [x] R6-10 验证: 新建 zh-CN/en-US notifications.json（5 个 key）并在 index.ts 注册
- [x] R6-11: NotificationCenter/RelatedGraphsPanel/CurrentTask 等 9 个文件中 20 处 icon-only 按钮已加 aria-label
- [x] R6-11 验证: NotificationCenter 3 处硬编码 title 已 i18n 化（新增 3 个 key）
- [x] R6-12: QuizPreview 整页 Loader2 已替换为 SkeletonCard 网格
- [x] R6-12 验证: CurrentTask 整页 border-spin 已替换为 Skeleton 布局
- [x] R6-12 验证: GraphEditor ViewLoader 已替换为 Skeleton 并补 `dark:bg-slate-900/50`，从模块级移入组件内
- [x] R6-13: DashboardCardContextMenu/AnalysisResultView/LiteratureMetadataCard/LiteratureExtractPanel/ChatMessage/ShareLink 6 处已改用 copyToClipboard 工具
- [x] R6-13 验证: 复制成功/失败有 toast 反馈
- [x] R6-14: CombinedGraphView/LearningPathDetail/TaskDetailPage/GraphEditor/GraphMap 共 8+ 处硬编码中文已 i18n
- [x] R6-14 验证: 对应 locale 文件已补充缺失 key（新建 combinedViewPage.json 7 key；learningPaths.detail 18 key；tasks.json 1 key；graphEditor.nodeCreation 3 key；graphMap.json 1 key）

## Tier 3 — 中等工作量

- [x] R6-15: 新建 ModalShell 组件，封装 useFocusTrap + Escape + role=dialog + aria-modal + 点击遮罩关闭
- [x] R6-15 验证: ModalShell 已在 common/index.ts 导出
- [x] R6-15 验证: QuizGenerationModal/ShareDialog/NodeSelectorModal/GenerateCardsModal/GraphOverviewEditModal/BatchGenerateDialog/GraphSettingsModal/VersionHistoryModal 8 个模态已用 ModalShell 包裹
- [x] R6-15 验证: 键盘用户按 Tab 焦点被限制在模态内（focus trap）
- [x] R6-15 验证: 按 Escape 模态关闭，焦点返回触发按钮（restoreFocus 默认 true）
- [x] R6-15 验证: 嵌套模态已知限制记录（useFocusTrap 无栈管理，ShareDialog+InviteCollaboratorDialog、GraphOverviewEditModal+ConfirmationModal）
- [x] R6-16: CalendarWeekView/CalendarDayView/CalendarScheduleView/ActivityTimeline/SchedulerStats/LearningStatsEnhanced/DailyReview/DailyStats/FocusHeatmap/MonthlyReport 共 15 处 `toLocaleDateString("zh-CN")` 已替换为 `formatDate(...)`
- [x] R6-16 验证: 英文环境下日期显示为英文格式（基于 i18next.language）
- [x] R6-16 验证: formatters.ts 已扩展添加 8 个新 pattern（time/short-date/month-day/weekday-short/weekday-long/month-year/long-date/month-day-weekday），DateInput 类型扩展支持 Date|null|undefined

## 全局验证

- [x] `npm run check` 通过
- [x] `npm run lint` 通过
- [x] Grep 验证 R6-16 覆盖的 10 个文件 `toLocaleDateString("zh-CN"` 清零（其他文件 13 处不在本轮范围）
