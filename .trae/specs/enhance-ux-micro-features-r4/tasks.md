# Tasks

> 以下任务按 Tier 排列。Tier 内任务无依赖，可并行。i18n key 任务需要先于依赖它的 UI 任务完成 locale 文件更新。

## Tier 1 — 极小工作量（5 项）

- [x] Task UX4-01: QuizPreview 残留 alert 替换 ✅
  - [x] SubTask UX4-01.1: 检查 `src/pages/QuizPreview.tsx` 中所有 `alert()` 调用（约 3 处：删除失败、重新生成失败、保存失败）
  - [x] SubTask UX4-01.2: 替换为 messageHelper / frontendEventBus 消息系统（参考项目其他文件的写法）
  - [x] SubTask UX4-01.3: `npm run check` 通过

- [x] Task UX4-02: PromptEditor / BatchGenerateDialog / AIActionSettingsPanel 残留 alert 替换 ✅
  - [x] SubTask UX4-02.1: `src/components/GraphEditor/panels/PromptEditor.tsx` 替换 2 处 alert
  - [x] SubTask UX4-02.2: `src/components/GraphEditor/modals/BatchGenerateDialog.tsx` 替换 2 处 alert（包括"生成完成！共生成 X 道题目"）
  - [x] SubTask UX4-02.3: `src/components/GraphEditor/panels/AIActionSettingsPanel.tsx` 替换 1 处 alert
  - [x] SubTask UX4-02.4: `npm run check` 通过

- [x] Task UX4-03: ConfirmationModal 默认按钮 i18n ✅
  - [x] SubTask UX4-03.1: 检查 `src/locales/zh-CN/confirmDialog.json` 和 `src/locales/en-US/confirmDialog.json` 是否已含 confirm/cancel key，如缺失则补充
  - [x] SubTask UX4-03.2: `src/components/common/ConfirmationModal.tsx` 默认 `confirmText` / `cancelText` 改为 `t('confirmDialog.confirm')` / `t('confirmDialog.cancel')`
  - [x] SubTask UX4-03.3: `npm run check` 通过

- [x] Task UX4-04: QuizList 错误重试改用 refetch ✅
  - [x] SubTask UX4-04.1: `src/components/Quiz/QuizList.tsx` 从 `useQuizSets()` 解构出 `refetch`
  - [x] SubTask UX4-04.2: 错误态按钮 `onClick` 改为调用 `refetch()`，移除 `window.location.reload()`
  - [x] SubTask UX4-04.3: `npm run check` 通过

- [x] Task UX4-05: Tasks 状态枚举本地化 + 空状态图标修正 ✅
  - [x] SubTask UX4-05.1: `src/pages/Tasks.tsx` 新增 `getStatusLabel(status)` 函数，接入 i18n（`tasks.status.pending` 等）
  - [x] SubTask UX4-05.2: `src/locales/zh-CN/tasks.json` 和 `src/locales/en-US/tasks.json` 补充 status.* key
  - [x] SubTask UX4-05.3: 第 494 行附近的 `<span>{task.status}</span>` 改为 `getStatusLabel(task.status)`
  - [x] SubTask UX4-05.4: 空状态图标从 `Clock` 改为 `Inbox`（语义更准确）
  - [x] SubTask UX4-05.5: `npm run check` 通过

## Tier 2 — 小工作量（9 项）

- [x] Task UX4-06: 抽 useDebouncedSearch hook 并推广 ✅
  - [x] SubTask UX4-06.1: 在 `src/hooks/` 下创建 `useDebouncedSearch.ts`（基于现有 `useSearch` 或独立实现，300ms 默认延迟，返回 `{ query, setQuery, debouncedQuery }`）
  - [x] SubTask UX4-06.2: 推广到 `src/components/Study/CardReviewView.tsx`
  - [x] SubTask UX4-06.3: 推广到 `src/components/Quiz/QuizList.tsx`
  - [x] SubTask UX4-06.4: 推广到 `src/pages/RecycleBin.tsx`
  - [x] SubTask UX4-06.5: 推广到 `src/pages/Tasks.tsx`（由 UX4-12 任务一并完成）
  - [x] SubTask UX4-06.6: 推广到 `src/components/Study/QuestionBank.tsx`
  - [x] SubTask UX4-06.7: 推广到 `src/components/Scheduler/ListView.tsx`
  - [x] SubTask UX4-06.8: 推广到 `src/pages/Templates.tsx`
  - [x] SubTask UX4-06.9: 推广到 `src/pages/LearningPaths.tsx`
  - [x] SubTask UX4-06.10: 推广到 `src/components/PluginMarketplace/PluginMarketplace.tsx`
  - [x] SubTask UX4-06.11: 推广到 `src/components/GraphEditor/panels/GraphOutline.tsx`
  - [x] SubTask UX4-06.12: `npm run check` 通过

- [x] Task UX4-07: QuizCard 状态/难度/类型 i18n ✅
  - [x] SubTask UX4-07.1: `src/locales/zh-CN/study.json` 和 `src/locales/en-US/study.json` 添加 `quizCard.status.*`、`quizCard.difficulty.*`、`quizCard.cardType.*` key
  - [x] SubTask UX4-07.2: `src/components/Quiz/QuizCard.tsx` `statusConfig` 改为函数返回 t() 结果；`getDifficultyLabel` / `getCardTypeLabel` 内部改为 t() 调用
  - [x] SubTask UX4-07.3: `npm run check` 通过

- [x] Task UX4-08: QuizResult 整页 i18n ✅
  - [x] SubTask UX4-08.1: `src/locales/zh-CN/study.json` 和 `src/locales/en-US/study.json` 添加 `quizResult.title.excellent` / `quizResult.title.good` / `quizResult.title.needsWork` 和 `quizResult.stats.*` key
  - [x] SubTask UX4-08.2: `src/components/Quiz/QuizResult.tsx` `cardTypeLabels` 改为 t() 调用；完成标题和统计标签替换为 t()
  - [x] SubTask UX4-08.3: `npm run check` 通过

- [x] Task UX4-09: NotificationCenter 时间格式化 i18n ✅
  - [x] SubTask UX4-09.1: `src/locales/zh-CN/common.json` 和 `src/locales/en-US/common.json` 添加 `timeAgo.justNow` / `timeAgo.minutesAgo` / `timeAgo.hoursAgo` / `timeAgo.daysAgo` 等 key（带 {{count}} 插值）
  - [x] SubTask UX4-09.2: `src/components/Notifications/NotificationCenter.tsx:30-34` 相对时间函数改为 t() 调用；`date.toLocaleDateString('zh-CN')` 改为基于 i18next.language
  - [x] SubTask UX4-09.3: `npm run check` 通过

- [x] Task UX4-10: 全局 focus-visible 焦点环 ✅
  - [x] SubTask UX4-10.1: `src/index.css` 已有全局 `:focus-visible` 样式（使用 var(--primary-500)），补充 `:focus:not(:focus-visible)` 重置
  - [x] SubTask UX4-10.2: 关键交互组件补充 `focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2`：ConfirmationModal、HelpModal（替代不存在的 Modal.tsx）、DashboardGraphCard、GraphToolbar（NotificationCenter 由 UX4-09 处理避免冲突）
  - [x] SubTask UX4-10.3: `npm run check` 通过

- [x] Task UX4-11: 统一 clipboard 工具 + 错误反馈 ✅
  - [x] SubTask UX4-11.1: 在 `src/utils/` 下创建 `clipboard.ts`，导出 `copyToClipboard(text: string): Promise<boolean>`
  - [x] SubTask UX4-11.2: `src/locales/zh-CN/common.json` 和 `src/locales/en-US/common.json` 补充 `copyFailed` / `clipboardUnavailable` key（`copied` 已存在）
  - [x] SubTask UX4-11.3: `src/components/GraphEditor/modals/ShareModal.tsx` 2 处 `navigator.clipboard.writeText` 改用 `copyToClipboard`
  - [x] SubTask UX4-11.4: `src/components/Calendar/CalendarExportModal.tsx` 1 处改用 `copyToClipboard`
  - [x] SubTask UX4-11.5: `npm run check` 通过

- [x] Task UX4-12: Tasks 错误态友好显示（含 UX4-06.5 防抖推广） ✅
  - [x] SubTask UX4-12.1: `src/pages/Tasks.tsx:426` 错误态 UI 移除 `(error as Error).message` 直接拼接
  - [x] SubTask UX4-12.2: UI 显示 `t('tasks.loadTasksFailed')` 通用信息；error.message 仅 `console.error`
  - [x] SubTask UX4-12.3: 增加"详情"展开按钮（Disclosure/Collapse），展开后显示 error.message 供高级用户查看
  - [x] SubTask UX4-12.4: `npm run check` 通过
  - [x] SubTask UX4-12.5: 同时完成 UX4-06.5 Tasks.tsx 防抖推广

- [x] Task UX4-13: AIProviderConfigSection 静默吞错修复 ✅
  - [x] SubTask UX4-13.1: `src/locales/zh-CN/settings.json` 和 `src/locales/en-US/settings.json` 添加 `providerConfigLoadFailed` key（`providerConfigSaveFailed` 已存在）
  - [x] SubTask UX4-13.2: `src/components/Settings/AIProviderConfigSection.tsx` 4 个 catch 块均补充 `console.error` 和 `message.error`（加载/保存/测试/清除）
  - [x] SubTask UX4-13.3: `npm run check` 通过

- [x] Task UX4-14: RecycleBin 恢复按钮 loading + 防重复点击 ✅
  - [x] SubTask UX4-14.1: `src/pages/RecycleBin.tsx` 恢复按钮添加 `disabled={restoreGraphMutation.isPending}`
  - [x] SubTask UX4-14.2: 按钮内容在 isPending 时显示 `<Loader2 className="animate-spin" />` + t('restoring')（图标按钮场景，title 切换）
  - [x] SubTask UX4-14.3: `src/locales/zh-CN/recycleBin.json` 和 `src/locales/en-US/recycleBin.json` 补充 `restoring` key
  - [x] SubTask UX4-14.4: `npm run check` 通过

## Tier 3 — 中等工作量（3 项）

- [x] Task UX4-15: 抽 useMenuNavigation hook 统一菜单键盘导航 ✅
  - [x] SubTask UX4-15.1: 在 `src/hooks/` 下创建 `useMenuNavigation.ts`，支持 `ArrowUp/ArrowDown` 上下移动、`Enter` 激活、`Escape` 关闭；参考 `src/components/GraphEditor/shared/CommandPalette.tsx` 已有的实现
  - [x] SubTask UX4-15.2: `src/components/GraphEditor/toolbar/GraphSwitcher.tsx` 接入 hook，dropdown 项支持键盘导航
  - [x] SubTask UX4-15.3: `src/components/GraphEditor/context-menu/NodeContextMenu.tsx` 接入 hook，菜单项支持键盘导航
  - [x] SubTask UX4-15.4: `src/components/Notifications/NotificationCenter.tsx` 接入 hook，通知列表支持键盘导航（移除原有重复的 Escape-only useEffect）
  - [x] SubTask UX4-15.5: `npm run check` 通过

- [x] Task UX4-16: Settings 锚点导航 ✅
  - [x] SubTask UX4-16.1: `src/pages/Settings.tsx` 左侧添加 sticky 锚点导航栏（12 个分区）
  - [x] SubTask UX4-16.2: 每个分区加 `id` 和 `ref`，点击锚点 `scrollIntoView({ behavior: 'smooth', block: 'start' })`
  - [x] SubTask UX4-16.3: 使用 `IntersectionObserver` 监听各分区可见性，高亮当前锚点（rootMargin: -20% 0px -70% 0px）
  - [x] SubTask UX4-16.4: 移动端（< md 断点）锚点导航转为顶部水平滚动 chips
  - [x] SubTask UX4-16.5: `npm run check` 通过

- [x] Task UX4-17: TaskForm 草稿恢复提示 ✅
  - [x] SubTask UX4-17.1: `src/locales/zh-CN/scheduler.json` 和 `src/locales/en-US/scheduler.json` 添加 `taskForm.draftDetected` / `taskForm.draftDetectedMessage` / `taskForm.restoreDraft` / `taskForm.discardDraft` key
  - [x] SubTask UX4-17.2: `src/components/Scheduler/TaskForm.tsx` 检测 draft 存在则显示 `asyncConfirm` 询问，确认恢复则用 draft 覆盖表单，取消则 clearDraft 用初始值；新增 `draftCheckComplete` ref 防止 saveDraft 在确认前覆盖草稿
  - [x] SubTask UX4-17.3: `npm run check` 通过

## 全局验证

- [x] Task V1: `npm run check` 通过 ✅
- [x] Task V2: `npm run lint` 通过 ✅
- [x] Task V3: 项目中不再存在 `alert()` / `window.alert()` 调用（src/ 目录已清零） ✅

# Task Dependencies

## Tier 内依赖
- [Tier 1: UX4-01 ~ UX4-05] 全部可并行
- [Tier 2: UX4-06 ~ UX4-14] 大部分可并行；UX4-12 修改 Tasks.tsx 与 UX4-06.5 修改 Tasks.tsx 需协调避免冲突（建议同 sub-agent 顺序处理）
- [Tier 3: UX4-15 ~ UX4-17] 全部可并行

## Tier 间依赖
- 无强依赖；Tier 1 可先完成验证，再启动 Tier 2/3

## 建议分组（便于 sub-agent 复用模式）
- **alert 清零组**：UX4-01 + UX4-02（统一替换模式）
- **i18n 集中组**：UX4-03 + UX4-07 + UX4-08 + UX4-09 + UX4-05（统一中英 locale 添加模式）
- **错误反馈组**：UX4-11 + UX4-12 + UX4-13（统一 message.error + console.error 模式）
- **键盘可访问性组**：UX4-10 + UX4-15（CSS 兜底 + hook 抽象）
- **操作 loading 组**：UX4-14（mutation.isPending 模式，可独立）
- **防抖推广组**：UX4-06（独立，覆盖面广）
- **其他**：UX4-04 + UX4-16 + UX4-17（各自独立）
