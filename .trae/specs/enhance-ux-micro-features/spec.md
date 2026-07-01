# UX 微改进路线图 Round 2 Spec

## Why
第一轮 UX 微改进（UX-01 ~ UX-10）已全部完成。本轮继续聚焦"小改动、大体验"，填补前一轮未覆盖的交互缺口，覆盖图谱编辑器、学习复习、测验、AI 对话、Dashboard、设置六大场景。

## 候选功能清单

### Tier 1 — 高影响 / 极小工作量（每个 ≤3 文件，≤80 行）

| 编号 | 功能 | 问题 | 方案 | 改动文件数 | 预估行数 |
|------|------|------|------|-----------|---------|
| UX2-01 | AI 消息复制按钮 | `ChatMessage.tsx` 仅有 Quote 按钮，无 Copy，复制 AI 回复需手动选中文本 | `ChatMessage.tsx` 添加 Copy 按钮，复用 `CodeBlock.tsx` 的 clipboard 逻辑 | 1 | ~40 |
| UX2-02 | FSRS 评分键盘快捷键 | QuizView 的 Again/Hard/Good/Easy 仅支持点击，无 `1/2/3/4` 或 `Space/Enter` 快捷键 | `QuizView.tsx` + `useCardReviewLogic.ts` 添加 keydown 监听 | 2 | ~80 |
| UX2-03 | 测验选项键盘快捷键 | QuizPractice 选项仅支持鼠标点击，无 `A/B/C/D` 或 `1/2/3/4` 快捷键 | `QuizPractice.tsx` + `useQuizLogic.ts` 添加 keydown 监听 | 2 | ~80 |
| UX2-04 | 测验会话计时器 | QuizPractice 与 QuizView 均无耗时显示，用户无法感知答题节奏 | `QuizProgressBar.tsx` 显示 mm:ss 计时器 | 2 | ~80 |
| UX2-05 | AI 重新生成回复 | 无法对最近一条 AI 回复进行 re-roll，回答不满意时只能重新提问 | `ChatMessage.tsx` 添加 Regenerate 按钮，`index.tsx` 触发重发 | 2 | ~80 |
| UX2-06 | 适应选区快捷键 | 仅有 `h` 适应全图，无快捷键聚焦到当前选中节点 | 新增 `f` 快捷键，`useGraphInteraction.ts` 添加 `fitSelection` | 3 | ~80 |

### Tier 2 — 高影响 / 小工作量（每个 ≤3 文件，≤150 行）

| 编号 | 功能 | 问题 | 方案 | 改动文件数 | 预估行数 |
|------|------|------|------|-----------|---------|
| UX2-07 | 画布缩放级别指示与按钮 | 缩放仅靠 Ctrl +/- 快捷键，工具栏无 +/- 按钮和百分比显示，移动端/新手无法操作 | `GraphToolbar.tsx` 添加缩放按钮和百分比显示 | 2 | ~120 |
| UX2-08 | 边显示快速切换 | 密集图谱边线杂乱，需逐条打开 `EdgeEditDialog` 才能隐藏，无全局切换 | 工具栏添加"简化边/隐藏边标签"切换 | 2 | ~100 |
| UX2-09 | 复习会话完成摘要 | QuizViewFinished 仅显示完成对勾，无卡片数、耗时、准确率等量化反馈 | 完成页显示卡片数/耗时/准确率统计 | 2 | ~120 |
| UX2-10 | 下次复习预测 | CardReviewView 仅显示今日 due 数，无"明日 12 张 / 本周 45 张"预测，用户无法规划 | 利用 FSRS 已有间隔数据，显示未来 7 日复习预测 | 2 | ~150 |
| UX2-11 | 测验标记待复查 | 测验中无法标记题目待回看，标准测验 App 均支持此功能 | `QuizCard.tsx` 添加旗帜按钮，`QuizProgressBar.tsx` 显示标记数 | 3 | ~150 |
| UX2-12 | 测验结果时间统计 | QuizResult 仅显示准确率和错题，无总耗时、平均每题耗时 | `QuizResult.tsx` 显示总耗时/平均耗时/最快最慢题 | 2 | ~120 |
| UX2-13 | AI 停止生成按钮 | AI 流式响应期间无法中止，长回答时用户只能等待 | `ChatInput.tsx` 在 loading 时切换为 Stop 按钮，使用 AbortController | 3 | ~120 |
| UX2-14 | Dashboard 排序选项 | `useDashboardFilters.ts` 硬编码"收藏优先→更新时间"，无按标题/创建时间/节点数排序 | `DashboardHeader.tsx` 添加排序下拉选择器 | 2 | ~120 |
| UX2-15 | Dashboard 状态筛选 chips | GlobalSearch 已有时间/状态 chips，但 Dashboard 仅有标签筛选，无状态/时间范围筛选 | `DashboardHeader.tsx` 添加状态与时间范围筛选 chips | 2 | ~150 |

### Tier 3 — 中等影响 / 中等工作量（每个 ≤3 文件，≤200 行）

| 编号 | 功能 | 问题 | 方案 | 改动文件数 | 预估行数 |
|------|------|------|------|-----------|---------|
| UX2-16 | 框选多节点 | `MindMapNode` 已支持 `multiSelected` 但无框选触发方式，仅 Ctrl-click 多选 | `CanvasLayout.tsx` 添加 marquee 拖拽框选 | 3 | ~200 |
| UX2-17 | 节点编辑器 Markdown 预览/工具栏 | `NodeEditSidebar.tsx` 为纯 textarea，无预览切换、无加粗/斜体/标题按钮 | 添加预览切换 toggle + 轻量格式工具栏 | 2 | ~200 |
| UX2-18 | AI 编辑并重发用户消息 | 用户消息发送后无法编辑优化查询，只能清空重发 | `ChatMessage.tsx` 用户消息添加 Edit，编辑后重发并截断后续消息 | 3 | ~180 |
| UX2-19 | 图谱编辑器偏好设置 | Settings 页面无图谱编辑器默认项（默认视图模式/缩放/自动布局/节点配色） | 新增 `GraphEditorSettings.tsx` 设置区块 | 3 | ~200 |
| UX2-20 | 通知偏好设置 | 无法选择接收/静音通知类型，`NotificationType` 已是联合类型但无按类型 mute | 新增 `NotificationSettings.tsx` 设置区块 | 3 | ~200 |

## Impact
- 仅涉及前端 `src/` 目录，不涉及后端 API 变更
- 所有功能均为增量添加，不影响现有功能
- UX2-10（下次复习预测）依赖 FSRS 已有数据，无需后端改动
- UX2-19/UX2-20（设置）可能需要扩展 localStorage 持久化结构

## ADDED Requirements

### Requirement: AI 消息复制按钮 (UX2-01)
系统 SHALL 在每条 AI 助手消息上提供 Copy 按钮，点击后将消息纯文本复制到剪贴板。

#### Scenario: 用户复制 AI 回复
- **WHEN** 用户点击 AI 消息上的 Copy 按钮
- **THEN** 消息文本复制到剪贴板，按钮短暂显示"已复制"状态

### Requirement: FSRS 评分键盘快捷键 (UX2-02)
系统 SHALL 支持使用键盘快捷键（`1/2/3/4` 或 `Space/Enter`）选择复习评分（Again/Hard/Good/Easy）。

#### Scenario: 用户使用键盘评分
- **WHEN** 用户在复习卡片界面按下 `1/2/3/4` 键
- **THEN** 分别触发 Again/Hard/Good/Easy 评分

### Requirement: 测验选项键盘快捷键 (UX2-03)
系统 SHALL 支持使用键盘快捷键（`A/B/C/D` 或 `1/2/3/4`）选择测验选项。

### Requirement: 测验会话计时器 (UX2-04)
系统 SHALL 在测验进度栏显示当前会话已用时间（mm:ss 格式）。

### Requirement: AI 重新生成回复 (UX2-05)
系统 SHALL 在最近一条 AI 消息上提供 Regenerate 按钮，点击后重新生成该回复。

### Requirement: 适应选区快捷键 (UX2-06)
系统 SHALL 支持 `f` 快捷键，将画布视图聚焦到当前选中的节点。

### Requirement: 画布缩放级别指示与按钮 (UX2-07)
系统 SHALL 在工具栏显示当前缩放百分比，并提供 +/- 缩放按钮。

### Requirement: 边显示快速切换 (UX2-08)
系统 SHALL 在工具栏提供"简化边/隐藏边标签"全局切换，用于密集图谱简化显示。

### Requirement: 复习会话完成摘要 (UX2-09)
系统 SHALL 在复习会话完成页显示卡片数、耗时、准确率统计。

### Requirement: 下次复习预测 (UX2-10)
系统 SHALL 在 CardReviewView 显示未来 7 日复习量预测（明日/本周）。

### Requirement: 测验标记待复查 (UX2-11)
系统 SHALL 允许用户在测验中标记题目为"待复查"，并在进度栏显示已标记数。

### Requirement: 测验结果时间统计 (UX2-12)
系统 SHALL 在 QuizResult 显示总耗时、平均每题耗时、最快/最慢题。

### Requirement: AI 停止生成按钮 (UX2-13)
系统 SHALL 在 AI 流式生成期间将发送按钮切换为 Stop 按钮，点击可中止生成。

### Requirement: Dashboard 排序选项 (UX2-14)
系统 SHALL 在 Dashboard 提供排序下拉选择器，支持按标题/创建时间/更新时间/节点数排序。

### Requirement: Dashboard 状态筛选 chips (UX2-15)
系统 SHALL 在 Dashboard 提供状态与时间范围筛选 chips。

### Requirement: 框选多节点 (UX2-16)
系统 SHALL 支持在画布空白处拖拽框选多个节点。

### Requirement: 节点编辑器 Markdown 预览/工具栏 (UX2-17)
系统 SHALL 在节点编辑侧边栏提供 Markdown 预览切换和轻量格式工具栏（加粗/斜体/标题）。

### Requirement: AI 编辑并重发用户消息 (UX2-18)
系统 SHALL 允许用户编辑已发送的消息，编辑后重发并截断该消息之后的所有消息。

### Requirement: 图谱编辑器偏好设置 (UX2-19)
系统 SHALL 在 Settings 页面提供图谱编辑器偏好设置区块（默认视图模式/默认缩放/自动布局）。

### Requirement: 通知偏好设置 (UX2-20)
系统 SHALL 在 Settings 页面提供通知偏好设置，允许按通知类型静音。

## MODIFIED Requirements
无（所有功能均为增量添加）

## REMOVED Requirements
无
