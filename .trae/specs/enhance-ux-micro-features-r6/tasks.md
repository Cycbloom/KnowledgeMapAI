# Tasks

> 以下任务按 Tier 排列。Tier 内任务无依赖，可并行。i18n key 任务需要先于依赖它的 UI 任务完成 locale 文件更新。

## Tier 1 — 极小工作量（5 项）

- [x] Task R6-01: Home.tsx 占位页实质化 ✅
  - [x] SubTask R6-01.1: Read `src/pages/Home.tsx` 确认当前内容
  - [x] SubTask R6-01.2: 改为 `<Navigate to="/dashboard" replace />`
  - [x] SubTask R6-01.3: `npm run check` 通过

- [x] Task R6-02: 路由切换 scroll-to-top ✅
  - [x] SubTask R6-02.1: 新建 `src/components/common/ScrollToTop.tsx`
  - [x] SubTask R6-02.2: 在 `src/components/common/index.ts` 导出 ScrollToTop
  - [x] SubTask R6-02.3: 在 `src/App.tsx` 的 `<Routes>` 上方挂载 `<ScrollToTop />`
  - [x] SubTask R6-02.4: `npm run check` 通过

- [x] Task R6-03: CopyButton 复制反馈与 i18n ✅
  - [x] SubTask R6-03.1: Read `src/components/common/CopyButton.tsx`
  - [x] SubTask R6-03.2: title/aria-label 改为 `t('common.copyError')`
  - [x] SubTask R6-03.3: catch 加 `message.error(t('common.copyFailed'))`；成功加 `message.success(t('common.copied'))`
  - [x] SubTask R6-03.4: `npm run check` 通过

- [x] Task R6-04: CodeBlock 复制反馈与 i18n ✅
  - [x] SubTask R6-04.1: Read `src/components/common/CodeBlock.tsx`
  - [x] SubTask R6-04.2: "复制代码"/"已复制"/"复制" 改为 t() 调用
  - [x] SubTask R6-04.3: catch 加 `message.error`；按钮加 `aria-label`
  - [x] SubTask R6-04.4: zh-CN/en-US common.json 补充 `copyCode` 和 `copyError` key
  - [x] SubTask R6-04.5: `npm run check` 通过

- [x] Task R6-05: Tasks.tsx 死代码 fallback 清理 ✅
  - [x] SubTask R6-05.1: Read `src/pages/Tasks.tsx:87`
  - [x] SubTask R6-05.2: 在 zh-CN/en-US tasks.json 补充 `reviewGeneration` key（原缺失）
  - [x] SubTask R6-05.3: 移除 `|| "复习任务生成"` 死代码 fallback
  - [x] SubTask R6-05.4: `npm run check` 通过

## Tier 2 — 小工作量（9 项）

- [x] Task R6-06: QuizPreview.tsx 硬编码中文 i18n 化 ✅
  - [x] SubTask R6-06.1: Read QuizPreview.tsx 列出 20+ 处硬编码
  - [x] SubTask R6-06.2: 在 zh-CN/en-US study.json 添加 `quizPreview.*` 命名空间（27 个 key）
  - [x] SubTask R6-06.3: statusConfig/difficultyLabels 改为组件内函数返回 t()
  - [x] SubTask R6-06.4: 替换所有 JSX 文本、message.error、asyncConfirm 文案为 t()
  - [x] SubTask R6-06.5: `npm run check` 通过

- [x] Task R6-07: CurrentTask.tsx 硬编码中文 i18n 化 ✅
  - [x] SubTask R6-07.1: Read CurrentTask.tsx 列出 15+ 处硬编码
  - [x] SubTask R6-07.2: 在 zh-CN/en-US scheduler.json 添加 `currentTask.*` 命名空间（47 个 key，含 QUEUE_CONFIG）
  - [x] SubTask R6-07.3: 替换所有硬编码为 t() 调用，title 同步 i18n
  - [x] SubTask R6-07.4: `npm run check` 通过

- [x] Task R6-08: ShareDialog i18n + a11y 修复 ✅
  - [x] SubTask R6-08.1: Read ShareDialog.tsx
  - [x] SubTask R6-08.2: 4 处硬编码 i18n；新建 collaborators.json（4 个 key）+ 在 index.ts 注册
  - [x] SubTask R6-08.3: 加 Escape 监听
  - [x] SubTask R6-08.4: 外层加 role=dialog/aria-modal/aria-labelledby；关闭按钮加 aria-label
  - [x] SubTask R6-08.5: `npm run check` 通过

- [x] Task R6-09: QuizGenerationModal i18n + a11y ✅
  - [x] SubTask R6-09.1: Read QuizGenerationModal.tsx
  - [x] SubTask R6-09.2: 5+ 处硬编码 i18n；在 study.json 添加 `quizGeneration.*`（4 个 key）
  - [x] SubTask R6-09.3: 加 Escape 监听；外层加 role=dialog/aria-modal/aria-labelledby
  - [x] SubTask R6-09.4: icon-only 关闭按钮加 aria-label
  - [x] SubTask R6-09.5: `npm run check` 通过

- [x] Task R6-10: NotificationCenter 静默 catch 用户反馈 ✅
  - [x] SubTask R6-10.1: Read NotificationCenter.tsx 确认 5 处静默 catch
  - [x] SubTask R6-10.2: 新建 zh-CN/en-US notifications.json（5 个 key）+ 在 index.ts 注册
  - [x] SubTask R6-10.3: 5 处 catch 加 `message.error(t('notifications.*Failed'))`
  - [x] SubTask R6-10.4: `npm run check` 通过

- [x] Task R6-11: Icon-only 按钮 aria-label 批量修复 ✅
  - [x] SubTask R6-11.1: Grep 9 个文件中 icon-only 按钮
  - [x] SubTask R6-11.2: 20 处 icon-only 按钮加 aria-label；NotificationCenter 3 处 title i18n 化（新增 3 个 key）
  - [x] SubTask R6-11.3: `npm run check` 通过

- [x] Task R6-12: 页面级 Loader2 → Skeleton（R5 漏项）✅
  - [x] SubTask R6-12.1: QuizPreview.tsx Loader2 替换为 SkeletonCard 网格（6 张卡片 + 顶部标题区 Skeleton）
  - [x] SubTask R6-12.2: CurrentTask.tsx border-spin 替换为 Skeleton 布局（h-32 + 3 列 h-24 + h-64）
  - [x] SubTask R6-12.3: GraphEditor.tsx ViewLoader 替换为 Skeleton + `dark:bg-slate-900/50`，从模块级移入组件内（访问 isDark）
  - [x] SubTask R6-12.4: `npm run check` 通过

- [x] Task R6-13: 复制操作 toast 反馈批量补齐 ✅
  - [x] SubTask R6-13.1: Grep 找出 6 处 `navigator.clipboard.writeText` 调用点
  - [x] SubTask R6-13.2: 6 处改用 `copyToClipboard` 工具（DashboardCardContextMenu/AnalysisResultView/LiteratureMetadataCard/LiteratureExtractPanel/ChatMessage/ShareLink）
  - [x] SubTask R6-13.3: `npm run check` 通过

- [x] Task R6-14: 小页面 i18n 拾遗 ✅
  - [x] SubTask R6-14.1: CombinedGraphView.tsx 3 处硬编码 i18n（新建 combinedViewPage.json，7 个 key）
  - [x] SubTask R6-14.2: LearningPathDetail.tsx 19 处硬编码 i18n（在 learningPaths.json 添加 detail 命名空间，18 个 key）
  - [x] SubTask R6-14.3: TaskDetailPage.tsx "任务ID不存在" i18n（tasks.json 添加 1 个 key）
  - [x] SubTask R6-14.4: GraphEditor.tsx "新节点"/"未知错误"/"创建节点失败" i18n（graphEditor.json 添加 nodeCreation 命名空间，3 个 key）
  - [x] SubTask R6-14.5: GraphMap.tsx "确认删除" i18n（graphMap.json 添加 1 个 key）
  - [x] SubTask R6-14.6: 对应 locale 文件已补充
  - [x] SubTask R6-14.7: `npm run check` 通过

## Tier 3 — 中等工作量（2 项）

- [x] Task R6-15: 模态对话框可访问性批量修复 ✅
  - [x] SubTask R6-15.1: Read useFocusTrap.ts 确认 hook 签名（{ enabled, initialFocus?, restoreFocus? } → RefObject）
  - [x] SubTask R6-15.2: 新建 `src/components/common/ModalShell.tsx`，封装 useFocusTrap + Escape + role=dialog/aria-modal/aria-labelledby + 点击遮罩关闭
  - [x] SubTask R6-15.3: 在 common/index.ts 导出 ModalShell
  - [x] SubTask R6-15.4: 8 个模态改造为 ModalShell 包裹：QuizGenerationModal、ShareDialog、NodeSelectorModal（在 GraphMap/）、GenerateCardsModal（在 Learning/）、GraphOverviewEditModal（在 Learning/）、BatchGenerateDialog、GraphSettingsModal、VersionHistoryModal
  - [x] SubTask R6-15.5: 嵌套模态验证：useFocusTrap 无栈管理，已知限制记录（ShareDialog+InviteCollaboratorDialog、GraphOverviewEditModal+ConfirmationModal）
  - [x] SubTask R6-15.6: `npm run check` + `npm run lint` 通过

- [x] Task R6-16: 日期格式化 i18n 批量修复（Calendar/Scheduler 模块）✅
  - [x] SubTask R6-16.1: Read formatters.ts 确认现有 format pattern
  - [x] SubTask R6-16.2: 扩展 formatters.ts：DateInput 类型扩展为 `string|number|Date|null|undefined`；新增 8 个 pattern（time/short-date/month-day/weekday-short/weekday-long/month-year/long-date/month-day-weekday）
  - [x] SubTask R6-16.3: 10 个文件 15 处 `toLocaleDateString("zh-CN", ...)` 替换为 `formatDate(...)`（CalendarWeekView/CalendarDayView/CalendarScheduleView/ActivityTimeline/SchedulerStats/LearningStatsEnhanced/DailyReview/DailyStats/FocusHeatmap/MonthlyReport）
  - [x] SubTask R6-16.4: Grep 验证 10 个目标文件 `toLocaleDateString("zh-CN"` 清零
  - [x] SubTask R6-16.5: `npm run check` 通过

## 全局验证

- [x] Task V1: `npm run check` 通过 ✅
- [x] Task V2: `npm run lint` 通过 ✅
- [x] Task V3: Grep 验证 R6-16 覆盖的 10 个文件 `toLocaleDateString("zh-CN"` 清零 ✅（其他文件 13 处不在本轮范围）

# Task Dependencies

## Tier 内依赖
- [Tier 1: R6-01 ~ R6-05] 全部可并行
- [Tier 2: R6-06 ~ R6-14] 大部分可并行；R6-08/R6-09 与 R6-15 都修改模态，R6-08/R6-09 先完成 i18n 和基础 a11y，R6-15 再做 ModalShell 包裹
- [Tier 3: R6-15 ~ R6-16] 全部可并行

## Tier 间依赖
- R6-04 的 `copyCode` key 在 R6-13 之前完成（R6-13 依赖 copyToClipboard 工具，无需新 key）
- R6-08/R6-09 在 R6-15 之前完成
- R6-12 与 R6-06 都修改 QuizPreview.tsx，同 sub-agent 顺序处理

## 建议分组（便于 sub-agent 复用模式）
- **路由体验组**：R6-01 + R6-02
- **复制反馈组**：R6-03 + R6-04 + R6-13
- **i18n 集中组**：R6-06 + R6-07 + R6-14 + R6-05
- **模态 a11y 组**：R6-08 + R6-09 → R6-15
- **静默 catch 组**：R6-10
- **a11y aria-label 组**：R6-11
- **Skeleton 收尾组**：R6-12
- **日期 i18n 组**：R6-16
