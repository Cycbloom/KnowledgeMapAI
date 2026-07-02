# UX 微改进路线图 Round 3 Spec

## Why
前两轮 UX 微改进（UX-01~UX-10、UX2-01~UX2-20）共 30 项已全部完成。本轮继续聚焦"小改动、大体验"，重点填补三个缺口：① 大量组件仍使用 `window.confirm` 原生对话框（26 处），与项目 `ConfirmationModal` 风格不一致且不支持 dark mode；② 多个页面加载态为纯文本，缺少骨架屏；③ 多个模态/面板缺少 Esc 键关闭和删除确认等基础交互。

## 候选功能清单

### Tier 1 — 高影响 / 极小工作量（每个 ≤3 文件，≤30 行）

| 编号 | 功能 | 问题 | 方案 | 改动文件数 | 预估行数 |
|------|------|------|------|-----------|---------|
| UX3-01 | 批量替换 window.confirm（第 1 批） | 26 处使用 `window.confirm()`，体验简陋、不支持 dark mode，项目已有 `ConfirmationModal` | 替换 GraphEditor 相关 5 个文件的 confirm 为 ConfirmationModal | 5 | ~80 |
| UX3-02 | 批量替换 window.confirm（第 2 批） | 同上 | 替换 Scheduler/Study/Console 相关 5 个文件的 confirm | 5 | ~80 |
| UX3-03 | 批量替换 window.confirm（第 3 批） | 同上 | 替换 Pages/Quiz/Templates 相关 5 个文件的 confirm | 5 | ~80 |
| UX3-04 | 通知中心 Esc 关闭 | NotificationCenter 支持点击外部关闭，但不支持 Escape 键 | 添加 useEffect 监听 Escape 键关闭 | 1 | ~10 |
| UX3-05 | TaskDetail Esc 关闭 | TaskDetail 模态面板不支持 Escape 键关闭 | 添加 useEffect 监听 Escape 键触发 onClose | 1 | ~8 |
| UX3-06 | 回收站自动清理天数提示 | 回收站页面未提示自动清理策略，用户不知道数据何时被彻底清除 | 空状态和头部添加"已删除项目将在 30 天后永久删除"提示 | 1 | ~5 |

### Tier 2 — 高影响 / 小工作量（每个 ≤3 文件，≤80 行）

| 编号 | 功能 | 问题 | 方案 | 改动文件数 | 预估行数 |
|------|------|------|------|-----------|---------|
| UX3-07 | Dashboard 加载态骨架屏 | Dashboard 加载仅显示纯文本"正在加载图谱..."，项目已有 SkeletonCard 但未使用 | 用 3-6 个 SkeletonCard 替代纯文本 | 1 | ~15 |
| UX3-08 | Study 页面加载态骨架屏 | Study 加载仅显示 "Loading..." 纯文本 | 添加 Study 统计卡片和列表的骨架屏 | 1 | ~20 |
| UX3-09 | Dashboard 卡片双击进入编辑 | 图谱卡片仅支持单击进入学习模式，进入编辑器需 hover 点击小图标 | 添加 onDoubleClick 导航到编辑模式 | 1 | ~10 |
| UX3-10 | 子任务/链接删除确认 | SubtaskList 和 TaskLinks 删除无确认直接删除 | 添加 ConfirmationModal 或 inline 确认 | 2 | ~40 |
| UX3-11 | TaskDetail 删除确认 | TaskDetail 删除按钮直接调用 onDelete，无确认 | 添加 ConfirmationModal | 1 | ~20 |
| UX3-12 | 回收站恢复成功后引导 | 恢复后用户不知道图谱去了哪里 | toast 中添加"查看"链接 | 1 | ~10 |
| UX3-13 | CardReviewView 空状态操作引导 | 卡片搜索无结果时仅显示文字，缺少清除搜索/切换模式按钮 | 添加"清除搜索"和"切换到全部卡片"按钮 | 1 | ~15 |
| UX3-14 | 通知中心删除已读通知 | 只能逐条删除通知，无批量清空 | 添加"删除所有已读通知"按钮 + 确认对话框 | 1 | ~25 |
| UX3-15 | Tasks 页面搜索 | Tasks 页面有筛选标签但缺少关键词搜索 | 添加搜索输入框 | 1 | ~25 |

### Tier 3 — 中等影响 / 中等工作量（每个 ≤3 文件，≤150 行）

| 编号 | 功能 | 问题 | 方案 | 改动文件数 | 预估行数 |
|------|------|------|------|-----------|---------|
| UX3-16 | ShareDialog 样式统一 | ShareDialog 使用 bg-opacity-50 等旧样式，与项目 rounded-2xl/backdrop-blur 风格不一致 | 统一为项目标准模态框风格 | 1 | ~15 |
| UX3-17 | QuizList 图谱筛选显示名称 | 图谱筛选下拉框 option 显示 id 而非名称 | 获取图谱信息显示名称 | 2 | ~30 |
| UX3-18 | Tasks 页面批量操作 | 只能逐条删除/重试，无批量操作 | 添加多选模式和批量操作栏 | 1 | ~60 |

## Impact
- 仅涉及前端 `src/` 目录，不涉及后端 API 变更
- UX3-01~03 批量替换 `window.confirm` 是本轮最大收益项，覆盖 26 处（分 3 批实现，每批 5 个文件左右）
- 所有功能均为增量添加，不影响现有功能

## ADDED Requirements

### Requirement: 批量替换 window.confirm (UX3-01~03)
系统 SHALL 将所有 `window.confirm()` 调用替换为项目已有的 `ConfirmationModal` 组件，确保确认对话框风格统一、支持 dark mode。

#### Scenario: 用户执行危险操作时显示确认对话框
- **WHEN** 用户触发删除、清空等不可逆操作
- **THEN** 系统显示 `ConfirmationModal` 确认对话框，用户确认后执行操作

### Requirement: 通知中心 Esc 关闭 (UX3-04)
系统 SHALL 支持按 Escape 键关闭通知中心下拉面板。

### Requirement: TaskDetail Esc 关闭 (UX3-05)
系统 SHALL 支持按 Escape 键关闭 TaskDetail 面板。

### Requirement: 回收站自动清理天数提示 (UX3-06)
系统 SHALL 在回收站页面提示用户已删除项目将在 30 天后永久删除。

### Requirement: Dashboard 加载态骨架屏 (UX3-07)
系统 SHALL 在 Dashboard 加载时显示骨架屏卡片而非纯文本。

### Requirement: Study 页面加载态骨架屏 (UX3-08)
系统 SHALL 在 Study 页面加载时显示骨架屏而非纯文本。

### Requirement: Dashboard 卡片双击进入编辑 (UX3-09)
系统 SHALL 支持双击图谱卡片直接进入编辑模式。

### Requirement: 子任务/链接删除确认 (UX3-10)
系统 SHALL 在删除子任务和链接前显示确认对话框。

### Requirement: TaskDetail 删除确认 (UX3-11)
系统 SHALL 在 TaskDetail 面板删除操作前显示确认对话框。

### Requirement: 回收站恢复成功后引导 (UX3-12)
系统 SHALL 在回收站恢复成功后的 toast 中提供"查看"链接。

### Requirement: CardReviewView 空状态操作引导 (UX3-13)
系统 SHALL 在卡片搜索无结果时提供"清除搜索"和"切换到全部卡片"操作按钮。

### Requirement: 通知中心删除已读通知 (UX3-14)
系统 SHALL 在通知中心提供"删除所有已读通知"按钮。

### Requirement: Tasks 页面搜索 (UX3-15)
系统 SHALL 在 Tasks 页面提供关键词搜索功能。

### Requirement: ShareDialog 样式统一 (UX3-16)
系统 SHALL 将 ShareDialog 样式统一为项目标准模态框风格（rounded-2xl/backdrop-blur）。

### Requirement: QuizList 图谱筛选显示名称 (UX3-17)
系统 SHALL 在测验图谱筛选下拉框中显示图谱名称而非 ID。

### Requirement: Tasks 页面批量操作 (UX3-18)
系统 SHALL 在 Tasks 页面支持多选和批量删除/重试操作。

## MODIFIED Requirements
无（所有功能均为增量添加）

## REMOVED Requirements
无
