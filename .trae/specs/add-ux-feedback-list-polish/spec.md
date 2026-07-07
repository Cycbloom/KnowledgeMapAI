# UX 反馈与列表交互打磨 Spec

## Why

P0–P3 与全局快捷操作 UX 已交付完整的核心能力与"键盘流"快捷入口。但仍有几处小而高频的体验断层：

- **删除即"消失"无回退**：Dashboard / Notes 列表的删除（含批量删除）直接走软删除，但用户看不到"已删除 + 撤销"的提示，误删后必须先想到回收站、再切资源类型、再搜索。后端其实已有 `restore` / `batchRestore` 能力，前端 MessageBar 也已支持 `action: { label, onClick }`，但 UX 层未串起来。
- **笔记底部信息单薄**：`BlockEditor` 已显示保存状态，但无字数 / 阅读时长，写长文时缺乏轻量反馈。
- **Notes 列表缺排序**：Dashboard 有 `sortBy`（updatedAt / createdAt / title / nodeCount），Notes 列表只有 `view` 切换 + 客户端关键字 / 标签过滤，无法按更新时间 / 创建时间 / 标题排序，列表一长难以浏览。
- **Notes 列表缺批量操作**：Dashboard 已实现"选择模式 + 全选 / 批量删除"，Notes 列表只能逐条点删除按钮，遇到清理多条笔记时点击成本高。
- **Dashboard 列表视图表头不吸顶**：长列表滚动时表头随内容滚走，无法稳定看到列含义。

本次目标：以**小而精**的改动补齐这五处断层，全部复用既有组件 / API / 事件总线，不引入新依赖、不改后端契约。

## What Changes

### 新增

- **撤销 Toast（Undo Toast）**：在 `Dashboard` 单条 / 批量删除图谱、`NotesListPage` 单条 / 批量删除笔记成功后，调用既有 `message.success(content, { duration: 5000 })` 并附 `action: { label: '撤销', onClick: restore }`。点击"撤销"调用对应 `restore` / `batchRestore` API，成功后刷新列表查询并 toast 提示"已恢复"。
- **笔记字数与阅读时长**：`BlockEditor` 底部状态栏（与既有"保存状态"同一行）新增字数统计与阅读时长，编辑器内容变化时（debounce 300ms）实时更新。
- **Notes 列表排序下拉**：在 `NotesListPage` 视图切换栏右侧新增排序下拉（updatedAt / createdAt / title），客户端排序，选中值持久化到 `localStorage`（key: `notes-list-sort`），默认 `updatedAt`。
- **Notes 列表批量选择模式**：在 `NotesListPage` 头部操作区新增"批量管理"按钮（与 Dashboard 一致），进入选择模式后每条 `NoteCard` 显示复选框、底部出现批量操作工具栏（全选 / 取消 / 批量删除）。批量删除复用 Dashboard 的批量删除交互模式与确认弹窗，并接 Undo Toast。
- **Dashboard 列表视图吸顶表头**：`Dashboard.tsx` 列表视图的 `<thead>` 增加 `sticky top-0 z-10` 与背景色，长列表滚动时表头保持可见。

### 修改

- **`Dashboard.tsx`**：单条删除（`handleConfirmDelete`）/ 批量删除（`handleConfirmBatchDelete`）成功回调改为带 Undo action 的 `message.success`；列表视图 `<thead>` / `<tr>` 增加 sticky 样式。
- **`NotesListPage.tsx`**：
  - 引入 `isSelectMode` / `selectedIds` 状态与"批量管理"按钮
  - `NoteCard` 接受 `isSelectMode` / `isSelected` / `onToggleSelect`，在选择模式下显示复选框并禁用跳转
  - 新增 `sortBy` 状态（持久化到 localStorage）+ 排序下拉
  - `filteredNotes` 排序逻辑前置（在过滤后排序）
  - 新增批量删除处理（含确认弹窗 + Undo Toast）
  - 单条删除成功后追加 Undo Toast
- **`BlockEditor.tsx`**：底部状态栏左侧（既有 slashHint 占位）改为动态显示 `字数 X · 约 Y 分钟`（仅在文档非空时显示，空时保留 slashHint）；右侧保留保存状态。
- **`message` helper 类型**：`MessageOptions` 增加可选 `action: { label: string; onClick: () => void }` 字段，对齐 `MessageShowPayload.action`（实际 `frontendEventBus.publish` 已支持，仅类型补全）。

### 不做（明确排除）

- 不做 Task / Scheduler 任务的 Undo Toast（任务为硬删除，且调度系统复杂度高于本次范围）
- 不做"撤销所有最近操作"的通用 undo 栈（仅覆盖删除图谱 / 笔记这一类高频误操作）
- 不做笔记编辑器内容变更的 reload 守卫（unsaved changes guard，复杂度高且与自动保存机制冲突，本次范围外）
- 不做 Notes 列表的服务端排序（沿用客户端排序，与 Dashboard 一致；当前 NotesListPage 已是客户端过滤）
- 不做 Dashboard 卡片视图的批量选择 UI 改造（既有卡片选择模式已可用）
- 不引入新依赖
- 不修改任何后端 API 契约（所有 restore / batchRestore 端点已存在）

## Impact

- **Affected specs**：
  - `add-global-quick-actions-ux`（最近项 hook 在 Dashboard / Notes 已接入，本 spec 仅在既有页面新增 UI，不冲突）
  - `extend-notes-p2-writing-refresh-search`（共享 `NotesListPage` / `BlockEditor`，本 spec 仅追加底部状态栏与列表交互，不动 P2 写作辅助 / 刷新 / 搜索功能）
  - `extend-notes-p3-block-refs-embeds`（共享 `BlockEditor` 底部状态栏区域，本 spec 仅追加字数 / 阅读时长，不与 P3 块引用 / 嵌入面板冲突）
- **Affected code**：
  - 新增：
    - `src/components/Notes/NotesListSortDropdown.tsx`（小型下拉组件，对齐 `DashboardHeader` 中排序下拉风格）
    - `src/components/Notes/NotesBatchActions.tsx`（批量操作工具栏，对齐 `DashboardBatchActions` 风格）
    - `src/hooks/useNoteWordCount.ts`（编辑器字数 + 阅读时长计算 hook，debounce 300ms）
    - `src/hooks/useUndoableDelete.ts`（封装"删除 + 撤销"通用流程：deleteFn / restoreFn / 资源名称 i18n key）
  - 修改：
    - `src/utils/messageHelper.ts`（`MessageOptions` 类型补 `action` 字段）
    - `src/pages/Dashboard.tsx`（删除回调追加 Undo action；列表视图表头 sticky 样式）
    - `src/pages/Notes/NotesListPage.tsx`（排序下拉、选择模式、批量删除、Undo Toast）
    - `src/components/Notes/BlockEditor.tsx`（底部状态栏追加字数 / 阅读时长）
    - `src/i18n/locales/zh-CN/notes.json` + `en-US/notes.json`（新增 `notes.sort.*` / `notes.batch.*` / `notes.undo.*` / `notes.editor.footer.*` 命名空间）
    - `src/i18n/locales/zh-CN/dashboard.json` + `en-US/dashboard.json`（新增 `dashboard.undo.*` 命名空间，与 Notes 共用 message key 时也可只放 common.json）
- **风险**：
  - Undo action 在 toast 自动消失（5s）后用户无法再撤销 —— 与既有软删除 30 天回收站兜底，不引入"永久丢失"
  - 批量删除 + Undo 涉及对多条 restore 调用 —— 复用既有 `batchRestore`，若部分 restore 失败仅 toast 提示"部分恢复失败"，不阻塞主流程
  - Notes 列表选择模式下复选框与现有 `onClick={navigate}` 冲突 —— 在选择模式下拦截点击事件、仅触发 `onToggleSelect`，退出选择模式恢复正常跳转
  - Dashboard sticky 表头在移动端列表视图（实际上移动端用 `<div>` 而非 `<table>`，sticky 仅作用于桌面端 `<table>`）

## ADDED Requirements

### Requirement: 撤销 Toast（删除图谱 / 笔记）

系统 SHALL 在用户删除图谱（单条 / 批量）或笔记（单条 / 批量）成功后，显示一条带"撤销"按钮的成功 toast，停留 5 秒；用户在 toast 可见期间点击"撤销"即调用对应 `restore` / `batchRestore` 接口恢复资源，并刷新对应列表查询。

#### Scenario: 删除单个图谱后撤销

- **WHEN** 用户在 Dashboard 删除一个图谱并确认，后端返回成功
- **THEN** 显示 toast：`已删除图谱「{title}」` + `撤销`按钮，停留 5 秒
- **AND** 5 秒内用户点击"撤销"
- **AND** 系统调用 `graphsApi.restore(id)` 成功
- **AND** 刷新 `useGraphs` 查询，被删图谱回到列表
- **AND** 显示 toast：`已恢复`

#### Scenario: 批量删除图谱后撤销

- **WHEN** 用户在 Dashboard 批量删除 N 个图谱成功
- **THEN** 显示 toast：`已删除 N 个图谱` + `撤销`按钮，停留 5 秒
- **AND** 5 秒内用户点击"撤销"
- **AND** 系统调用 `graphsApi.batchRestore(ids)` 成功
- **AND** 刷新 `useGraphs` 查询，被删图谱回到列表

#### Scenario: 删除单个笔记后撤销

- **WHEN** 用户在 Notes 列表删除一条笔记成功
- **THEN** 显示 toast：`已删除笔记「{title}」` + `撤销`按钮，停留 5 秒
- **AND** 5 秒内用户点击"撤销"
- **AND** 系统调用 `notesApi.restore(id)` 成功
- **AND** 刷新 `useNotesList` 查询，被删笔记回到列表

#### Scenario: 批量删除笔记后撤销

- **WHEN** 用户在 Notes 列表批量删除 N 条笔记成功
- **THEN** 显示 toast：`已删除 N 条笔记` + `撤销`按钮，停留 5 秒
- **AND** 5 秒内用户点击"撤销"
- **AND** 系统调用 `notesApi.batchRestore(ids)` 成功（若批量 restore 端点不存在则降级为并行单条 restore）
- **AND** 刷新 `useNotesList` 查询

#### Scenario: Toast 超时未撤销

- **WHEN** 删除成功 toast 显示 5 秒后用户未点击"撤销"
- **THEN** toast 自动消失
- **AND** 不再显示撤销按钮（用户仍可去回收站手动恢复）

#### Scenario: 撤销恢复失败

- **WHEN** 用户点击"撤销"但 `restore` / `batchRestore` 接口返回失败
- **THEN** 显示 error toast：`恢复失败，请前往回收站手动恢复`
- **AND** 不阻塞列表正常显示

### Requirement: 笔记字数与阅读时长

系统 SHALL 在 `BlockEditor` 底部状态栏显示当前文档的字数与预估阅读时长，文档内容变化时（debounce 300ms）实时更新。

#### Scenario: 显示字数与阅读时长

- **WHEN** 用户打开任意笔记，文档非空
- **THEN** 底部状态栏左侧显示 `字数 {count} · 约 {minutes} 分钟`
- **AND** 字数按 CJK 字符 + 英文单词混合计算（中文按字符数、英文按空格分词）
- **AND** 阅读时长按 300 字 / 分钟估算（不足 1 分钟显示 1 分钟）

#### Scenario: 空文档

- **WHEN** 笔记内容为空
- **THEN** 底部状态栏左侧不显示字数 / 阅读时长，保留既有 slashHint 提示

#### Scenario: 输入实时更新

- **WHEN** 用户连续输入文本
- **THEN** 字数 / 阅读时长在停止输入 300ms 后更新
- **AND** 不阻塞编辑器输入性能

### Requirement: Notes 列表排序

系统 SHALL 在 `NotesListPage` 视图切换栏右侧提供排序下拉，支持按"更新时间 / 创建时间 / 标题"排序，选中值持久化到 localStorage。

#### Scenario: 切换排序

- **WHEN** 用户在 Notes 列表打开排序下拉并选择"创建时间"
- **THEN** 当前列表立即按 `createdAt` 倒序重新排列
- **AND** 排序值写入 localStorage `notes-list-sort`
- **AND** 下次进入 Notes 列表时默认使用持久化值

#### Scenario: 排序与过滤叠加

- **WHEN** 用户已设置关键字过滤 / 标签筛选
- **AND** 切换排序
- **THEN** 过滤后的结果按新排序重排
- **AND** 不影响过滤逻辑

#### Scenario: 默认排序

- **WHEN** 用户从未设置过排序
- **THEN** 默认按 `updatedAt` 倒序（与既有列表默认行为一致）

### Requirement: Notes 列表批量选择与批量删除

系统 SHALL 在 `NotesListPage` 提供批量选择模式，进入后每条笔记项显示复选框，底部出现批量操作工具栏，支持全选 / 取消选择 / 批量删除（含确认弹窗 + Undo Toast）。

#### Scenario: 进入选择模式

- **WHEN** 用户点击 Notes 列表头部"批量管理"按钮
- **THEN** 每条 `NoteCard` 左侧出现复选框
- **AND** 点击卡片任意位置仅切换选中状态，不跳转到编辑器
- **AND** 底部出现批量操作工具栏（全选 / 已选 N 条 / 批量删除 / 退出选择模式）

#### Scenario: 全选 / 取消选择

- **WHEN** 用户在选择模式下点击"全选"
- **THEN** 当前页所有笔记被选中
- **AND** "全选"按钮变为"取消全选"

#### Scenario: 批量删除

- **WHEN** 用户在选择模式下点击"批量删除"
- **THEN** 弹出确认弹窗（与 Dashboard 一致风格）
- **AND** 确认后调用 `notesApi` 批量删除（若 batch 端点不存在则并行单条 delete）
- **AND** 成功后退出选择模式、刷新列表
- **AND** 显示 Undo Toast（5 秒可撤销）

#### Scenario: 退出选择模式

- **WHEN** 用户点击工具栏"X"退出选择模式
- **THEN** 复选框隐藏，恢复正常点击跳转行为
- **AND** 已选状态清空

### Requirement: Dashboard 列表视图吸顶表头

系统 SHALL 在 Dashboard 列表视图（桌面端 `<table>`）的长列表滚动时保持表头可见（`sticky`）。

#### Scenario: 长列表滚动表头保持可见

- **WHEN** 用户在 Dashboard 切换到列表视图，且图谱数超过视口高度
- **AND** 向下滚动
- **THEN** 表头（标题 / 描述 / 节点数 / 创建时间 / 更新时间 / 操作）始终停留在列表顶部
- **AND** 表头背景色覆盖内容（不透出下方文字）

#### Scenario: 卡片视图不受影响

- **WHEN** 用户切换到卡片视图
- **THEN** 无 sticky 行为（卡片视图无表头）

## MODIFIED Requirements

### Requirement: MessageBar 的 action 支持

既有 `MessageBar` 已支持 `action: { label, onClick }` 字段。本 spec 在前端代码层面统一使用：删除操作成功后通过 `message.success(content, { duration: 5000, action: { label, onClick } })` 触发 Undo Toast，不再使用纯文本 toast。

## REMOVED Requirements

（无）
