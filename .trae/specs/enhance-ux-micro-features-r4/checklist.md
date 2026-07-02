# UX 微改进 Round 4 Checklist

## Tier 1 — 极小工作量

- [x] UX4-01: `QuizPreview.tsx` 中 3 处 `alert()` 已替换为 messageHelper / frontendEventBus
- [x] UX4-02: `PromptEditor.tsx` / `BatchGenerateDialog.tsx` / `AIActionSettingsPanel.tsx` 共 5 处 `alert()` 已替换为 messageHelper
- [x] UX4-03: `ConfirmationModal` 默认 `confirmText` / `cancelText` 从 i18n 读取，未传按钮文本时跟随当前语言
- [x] UX4-04: `QuizList` 错误态重试按钮调用 `refetch()` 而非 `window.location.reload()`，保留用户筛选状态
- [x] UX4-05: `Tasks` 列表状态显示本地化标签（pending/in_progress/completed），空状态图标改为 `Inbox`

## Tier 2 — 小工作量

- [x] UX4-06: `useDebouncedSearch` hook 已创建并推广到 10 个高优先级页面（CardReviewView / QuizList / RecycleBin / Tasks / QuestionBank / ListView / Templates / LearningPaths / PluginMarketplace / GraphOutline）
- [x] UX4-06 验证: 在 CardReviewView 输入搜索关键词时，停止输入 300ms 后才触发 filter
- [x] UX4-07: `QuizCard` 状态/难度/类型标签接入 i18n，中英 locale 文件已补充 `study.quizCard.*` key
- [x] UX4-08: `QuizResult` 完成标题/统计标签/卡片类型标签接入 i18n，中英 locale 文件已补充 `study.quizResult.*` key
- [x] UX4-09: `NotificationCenter` 相对时间文本和日期 locale 跟随 i18next.language，中英 locale 文件已补充 `common.timeAgo.*` key
- [x] UX4-10: `src/index.css` 已有全局 `:focus-visible` 兜底样式（使用 var(--primary-500)），补充 `:focus:not(:focus-visible)` 重置
- [x] UX4-10 验证: 关键交互组件（ConfirmationModal/HelpModal/DashboardGraphCard/GraphToolbar）补充 `focus-visible:ring` 样式
- [x] UX4-10 验证: 使用键盘 Tab 导航时按钮有清晰焦点环（CSS 兜底确保全覆盖）
- [x] UX4-11: `copyToClipboard(text)` 工具函数已创建，含 try/catch 和失败 message.error
- [x] UX4-11 验证: `ShareModal`（2 处）/ `CalendarExportModal`（1 处）已改用 `copyToClipboard`，中英 locale 已补充 `common.copyFailed` / `common.clipboardUnavailable` key（`copied` 已存在）
- [x] UX4-12: `Tasks` 错误态显示通用 `t('tasks.loadTasksFailed')`，原始 error.message 仅 console.error，并提供"详情"展开按钮
- [x] UX4-13: `AIProviderConfigSection` 4 个 catch 块均调用 `message.error()` 并 console.error，不再静默吞错
- [x] UX4-14: `RecycleBin` 恢复按钮在 `restoreGraphMutation.isPending` 时禁用并显示 Loader2 spinner

## Tier 3 — 中等工作量

- [x] UX4-15: `useMenuNavigation` hook 已创建，支持 ArrowUp/ArrowDown/Enter/Escape 键盘导航
- [x] UX4-15 验证: `GraphSwitcher` dropdown 项支持键盘上下导航和 Enter 激活
- [x] UX4-15 验证: `NodeContextMenu` 菜单项支持键盘上下导航和 Enter 激活
- [x] UX4-15 验证: `NotificationCenter` 通知列表支持键盘上下导航和 Enter 激活
- [x] UX4-16: `Settings` 页面左侧添加 sticky 锚点导航，点击平滑滚动到对应分区
- [x] UX4-16 验证: 滚动时当前分区锚点高亮（IntersectionObserver，rootMargin: -20% 0px -70% 0px）
- [x] UX4-16 验证: 移动端（< md 断点）锚点导航转为顶部水平滚动 chips
- [x] UX4-17: `TaskForm` 检测到 localStorage 草稿时弹出 `ConfirmationModal` 询问是否恢复，而非直接覆盖表单初始值

## 全局验证

- [x] `npm run check` 通过
- [x] `npm run lint` 通过
- [x] 项目中不再存在 `alert()` / `window.alert()` 调用（src/ 目录已清零）
