# UX 微改进路线图 Round 4 Spec

## Why
前三轮 UX 微改进（UX-01~UX-10、UX2-01~UX2-20、UX3-01~UX3-18）共 48 项已全部完成。本轮延续"小改动、大体验"定位，填补四个仍存在的缺口：① 原生 `alert()` 在 QuizPreview / PromptEditor / BatchGenerateDialog 等处仍有残留（Round 3 仅替换了 `window.confirm`）；② 多个核心组件（QuizCard / QuizResult / NotificationCenter / ConfirmationModal）存在硬编码中文，未接入 i18n；③ 全局几乎无 `focus-visible` 焦点环，键盘导航体验差；④ 多个搜索输入框无防抖、剪贴板操作无错误反馈、错误态显示原始堆栈等细节问题。

## 候选功能清单

### Tier 1 — 极小工作量（每个 ≤2 文件，≤20 行）

| 编号 | 功能 | 问题 | 方案 | 改动文件数 | 预估行数 |
|------|------|------|------|-----------|---------|
| UX4-01 | QuizPreview 残留 alert 替换 | `QuizPreview.tsx` 3 处 `alert()` 显示删除/重新生成/保存失败，与 Round 3 风格不一致 | 改用 `frontendEventBus.publish("message_show", ...)` 或 messageHelper | 1 | ~15 |
| UX4-02 | PromptEditor/BatchGenerateDialog/AIActionSettingsPanel 残留 alert 替换 | 3 个文件共 5 处 `alert()`，BatchGenerateDialog 甚至 `alert('生成完成！共生成 X 道题目')` 阻塞主进程；代码注释已写 `// Ideally show a toast here` | 统一改用 messageHelper / frontendEventBus | 3 | ~12 |
| UX4-03 | ConfirmationModal 默认按钮 i18n | `ConfirmationModal.tsx` 默认 `confirmText='确定'`, `cancelText='取消'` 硬编码，调用方未传则中文化；locale 已存在 `confirmDialog.json` | 默认值改用 `t('confirmDialog.confirm')` / `t('confirmDialog.cancel')` | 1 | ~4 |
| UX4-04 | QuizList 错误重试改用 refetch | `QuizList.tsx:128` 错误态按钮 `onClick={() => window.location.reload()}` 整页刷新，丢失筛选状态；项目用 React Query 应使用 `refetch()` | 从 `useQuizSets()` 解构 `refetch`，按钮调用 refetch | 1 | ~5 |
| UX4-05 | Tasks 状态枚举本地化 + 空状态图标修正 | `Tasks.tsx:494` 直接显示 `pending/in_progress/completed` 英文枚举；空状态用 `<Clock>` 图标与"无任务"语义不符 | 新增 `getStatusLabel` 函数接入 i18n；空状态图标改 `Inbox` | 1 | ~15 |

### Tier 2 — 小工作量（每个 ≤3 文件，≤80 行）

| 编号 | 功能 | 问题 | 方案 | 改动文件数 | 预估行数 |
|------|------|------|------|-----------|---------|
| UX4-06 | 抽 useDebouncedSearch hook 并推广 | 项目已有 `useSearch({ debounceMs: 300 })` 但 23 处搜索框仍直接 setState 触发 filter，大列表卡顿 | 抽 `useDebouncedSearch` 通用 hook，批量替换 CardReviewView / QuizList / RecycleBin / Tasks / QuestionBank / ListView / Templates / LearningPaths / PluginMarketplace 等 10 个高优先级页面 | 1 + 10 | ~50 |
| UX4-07 | QuizCard 状态/难度/类型 i18n | `QuizCard.tsx:16-77` `statusConfig.label` / `getDifficultyLabel` / `getCardTypeLabel` 全硬编码中文 | 抽到 i18n locale 的 `study.quizCard.*` key | 1 + 2 locale | ~30 |
| UX4-08 | QuizResult 整页 i18n | `QuizResult.tsx:42-145` `cardTypeLabels` / 完成标题（`'太棒了！'` 等）/ 统计标签（`'总题数'` 等）全硬编码 | 补充 `study.quizResult.*` 翻译 key 并替换 | 1 + 2 locale | ~25 |
| UX4-09 | NotificationCenter 时间格式化 i18n | `NotificationCenter.tsx:30-34` `'刚刚'/'X分钟前'/'X小时前'` 硬编码；`date.toLocaleDateString('zh-CN')` 写死 locale | 使用 i18n `common.timeAgo.*` key，locale 跟随 i18next.language | 1 + 2 locale | ~12 |
| UX4-10 | 全局 focus-visible 焦点环 | 全项目仅 1 处使用 `focus-visible:`；大量按钮仅 `hover:`，键盘 Tab 无视觉反馈，违反 WCAG 2.4.7 | 在 `src/index.css` 全局添加 `:focus-visible` 兜底样式；关键交互组件补充 `focus-visible:ring-2 focus-visible:ring-primary-500` | 1 css + 5 关键组件 | ~30 |
| UX4-11 | 统一 clipboard 工具 + 错误反馈 | ShareModal（2 处）/ CalendarExportModal 直接 `navigator.clipboard.writeText()` 无 await 无 catch，非 HTTPS 或权限被拒时静默失败 | 抽 `copyToClipboard(text): Promise<boolean>` 工具，失败时 `message.error(t('common.copyFailed'))` | 1 工具 + 3 调用处 | ~30 |
| UX4-12 | Tasks 错误态友好显示 | `Tasks.tsx:426` 直接拼 `(error as Error).message` 到 UI，可能含 SQL/堆栈；对用户不友好 | error.message 仅 console.error；UI 显示通用 `t('tasks.loadTasksFailed')`；增加"详情"展开按钮 | 1 | ~15 |
| UX4-13 | AIProviderConfigSection 静默吞错修复 | `AIProviderConfigSection.tsx:66,104` `catch {}` 完全吞错；加载失败时用户看到空表单不知原因 | catch 中调用 `message.error(t('settings.providerConfigLoadFailed'))` 并 console.error | 1 | ~10 |
| UX4-14 | RecycleBin 恢复按钮 loading + 防重复点击 | `RecycleBin.tsx:391,402` 恢复按钮直接 onClick 调 handleRestore，无 disabled/loading，可能重复点击 | 用 `restoreGraphMutation.isPending` disabled + Loader2 spinner | 1 | ~15 |

### Tier 3 — 中等工作量（每个 ≤3 文件，≤150 行）

| 编号 | 功能 | 问题 | 方案 | 改动文件数 | 预估行数 |
|------|------|------|------|-----------|---------|
| UX4-15 | 抽 useMenuNavigation hook 统一菜单键盘导航 | GraphSwitcher / NodeContextMenu / NotificationCenter 列表项仅支持鼠标点击，与 CommandPalette 已有的 ArrowUp/Down 实现不一致 | 参考 CommandPalette keydown 处理，抽 `useMenuNavigation(itemsRef)` hook 复用 | 1 hook + 3 文件 | ~80 |
| UX4-16 | Settings 锚点导航 | `Settings.tsx` 12+ 分区单页滚动很长，用户难以跳转，移动端更糟 | 左侧加 sticky 锚点导航，点击平滑滚动；滚动时高亮当前分区 | 1 | ~80 |
| UX4-17 | TaskForm 草稿恢复提示 | `TaskForm.tsx:70-96` localStorage 草稿重新打开时直接覆盖表单初始值，用户不知是"草稿"还是"新建" | 打开表单时若有 draft，弹 `ConfirmationModal` 询问"检测到未完成的草稿，是否恢复？" | 1 | ~25 |

## Impact
- 仅涉及前端 `src/` 目录，不涉及后端 API 变更
- UX4-01/02 是 Round 3 的延续（alert 清零），是本轮必收的快速收益项
- UX4-06（防抖 hook 推广）覆盖 10 个页面，是本轮影响面最广的项
- UX4-07/08/09/03 集中修补 i18n 缺口，使中英双语支持真正落地到核心组件
- UX4-10（focus-visible）是全局性可访问性短板的兜底修复
- 所有功能均为增量添加或就地替换，不影响现有功能

## ADDED Requirements

### Requirement: 替换 QuizPreview 残留 alert (UX4-01)
系统 SHALL 将 `QuizPreview.tsx` 中 3 处 `alert()` 调用替换为统一的 messageHelper / frontendEventBus 消息系统。

#### Scenario: 删除题目失败时显示友好错误
- **WHEN** 用户在 QuizPreview 触发删除题目且后端返回失败
- **THEN** 系统通过 messageHelper 显示错误 toast，不阻塞主进程

### Requirement: 替换 PromptEditor/BatchGenerateDialog/AIActionSettingsPanel 残留 alert (UX4-02)
系统 SHALL 将 3 个文件中共 5 处 `alert()` 调用替换为统一的 messageHelper 消息系统。

### Requirement: ConfirmationModal 默认按钮 i18n (UX4-03)
系统 SHALL 将 `ConfirmationModal` 的默认 `confirmText` / `cancelText` 改为从 i18n 读取，使调用方未传按钮文本时跟随当前语言。

### Requirement: QuizList 错误重试使用 refetch (UX4-04)
系统 SHALL 在 QuizList 错误态重试按钮中调用 React Query 的 `refetch()`，而不是 `window.location.reload()`，以保留用户筛选状态。

### Requirement: Tasks 状态枚举本地化 (UX4-05)
系统 SHALL 在 Tasks 列表中显示本地化的状态标签（pending/in_progress/completed），并将空状态图标改为语义正确的 `Inbox`。

### Requirement: 抽 useDebouncedSearch hook 并推广 (UX4-06)
系统 SHALL 提供 `useDebouncedSearch` 通用 hook，并在 10 个高优先级页面的搜索输入框中使用，避免每次按键触发完整 filter。

#### Scenario: 用户在 CardReviewView 输入搜索关键词
- **WHEN** 用户在搜索框快速输入 "javascript"
- **THEN** 系统在停止输入 300ms 后才触发 filter，输入过程中不卡顿

### Requirement: QuizCard 状态/难度/类型 i18n (UX4-07)
系统 SHALL 将 QuizCard 的状态标签、难度标签、卡片类型标签接入 i18n，跟随当前语言显示。

### Requirement: QuizResult 整页 i18n (UX4-08)
系统 SHALL 将 QuizResult 的完成标题、统计标签、卡片类型标签接入 i18n。

### Requirement: NotificationCenter 时间格式化 i18n (UX4-09)
系统 SHALL 将 NotificationCenter 的相对时间文本（"刚刚"、"X分钟前"等）和日期 locale 跟随 i18next.language。

### Requirement: 全局 focus-visible 焦点环 (UX4-10)
系统 SHALL 在全局 CSS 添加 `:focus-visible` 兜底样式，并在关键交互组件补充 `focus-visible:ring` 样式，使键盘 Tab 导航时有清晰视觉反馈。

#### Scenario: 键盘用户 Tab 切换按钮
- **WHEN** 用户使用 Tab 键在按钮间切换
- **THEN** 当前聚焦按钮显示清晰的焦点环（2px primary 色 outline + offset）

### Requirement: 统一 clipboard 工具 (UX4-11)
系统 SHALL 提供 `copyToClipboard(text): Promise<boolean>` 工具函数，并在 ShareModal、CalendarExportModal 等 3 处调用，失败时显示错误 toast。

### Requirement: Tasks 错误态友好显示 (UX4-12)
系统 SHALL 在 Tasks 错误态显示通用友好错误信息，原始 error.message 仅记录到 console，并提供"详情"展开按钮供高级用户查看。

### Requirement: AIProviderConfigSection 错误反馈 (UX4-13)
系统 SHALL 在 AIProviderConfigSection 的 catch 块中调用 `message.error()` 提示用户，而非静默吞错。

### Requirement: RecycleBin 恢复按钮 loading (UX4-14)
系统 SHALL 在 RecycleBin 恢复操作期间禁用按钮并显示 spinner，防止重复点击。

#### Scenario: 用户点击恢复按钮
- **WHEN** 用户点击恢复按钮且 mutation 进行中
- **THEN** 按钮禁用并显示 Loader2 spinner，完成后恢复可点击

### Requirement: 抽 useMenuNavigation hook (UX4-15)
系统 SHALL 提供 `useMenuNavigation` 通用 hook，支持 ArrowUp/ArrowDown/Enter/Esc 键盘导航，并在 GraphSwitcher、NodeContextMenu、NotificationCenter 中使用。

### Requirement: Settings 锚点导航 (UX4-16)
系统 SHALL 在 Settings 页面左侧添加 sticky 锚点导航，点击平滑滚动到对应分区，滚动时高亮当前分区。

### Requirement: TaskForm 草稿恢复提示 (UX4-17)
系统 SHALL 在 TaskForm 检测到 localStorage 草稿时，弹出 ConfirmationModal 询问用户是否恢复草稿，而非直接覆盖表单初始值。

#### Scenario: 用户重新打开有草稿的 TaskForm
- **WHEN** 用户打开 TaskForm 且 localStorage 存在未提交草稿
- **THEN** 系统弹出 ConfirmationModal 询问"检测到未完成的草稿，是否恢复？"

## MODIFIED Requirements
无（所有功能均为增量添加或就地替换）

## REMOVED Requirements
无
