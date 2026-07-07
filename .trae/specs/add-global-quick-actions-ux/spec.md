# 全局快捷操作 UX 增强 Spec

## Why

项目已具备完善的快捷键配置基础设施（48 个默认快捷键、持久化 Store、帮助面板）和搜索后端能力，但前端"快捷操作"体验存在明显断层：

- `Ctrl+K` 命令面板仅在 `GraphEditor` 内生效，Dashboard / Notes / Study 等页面无全局快速入口
- `GlobalSearch` 组件已实现但**未被任何页面挂载**，属于死代码
- `DEFAULT_SHORTCUTS` 中约半数 action（`navigateBack/Forward`、`goHome`、`openSettings`、`openSearch` 等）**无全局 handler 接线**，快捷键定义了但不生效
- `Settings` 页 13 个分段中**无快捷键管理入口**，用户只能从帮助浮层进入
- 最近访问仅覆盖图谱（`useRecentGraphs`），无最近节点 / 最近笔记
- `GraphEditor` 全屏无节点层级面包屑，进入子节点后无快速返回上级的视觉路径

本次目标：以**小而精**的改动补齐这些断层，让"键盘流"用户在任何页面都能快速跳转、搜索、执行命令，无需为每个功能做大改版。

## What Changes

### 新增

- **全局命令面板（Global Command Palette）**：在 `Layout` 层挂载模态弹窗，全局 `Ctrl+K`（沿用既有 `openCommandPalette` 快捷键）触发。聚合：
  - 导航跳转（首页 / 图谱地图 / 笔记 / 学习 / 调度 / 统计 / 设置 / 回收站）
  - 最近图谱（来自 `useRecentGraphs`，最多 5 条）
  - 最近节点、最近笔记（新增 hook）
  - 快速操作（新建图谱、切换主题、打开搜索、打开设置）
  - 当前页面相关命令（如 Notes 页提供"新建笔记"）
- **`useRecentNodes` hook**：localStorage 存储，最多 10 条，字段 `id / title / graphId / graphTopic / visitedAt`
- **`useRecentNotes` hook**：localStorage 存储，最多 10 条，字段 `id / title / visitedAt`
- **`Settings` 快捷键分段**：新增 `shortcuts` section，复用 `ShortcutHelpPanel` 的查看 / 自定义 / 单条重置 / 全部重置能力，提供统一入口
- **`GraphEditor` 节点面包屑**：顶部显示 `图谱标题 / 父节点链 / 当前节点`，支持点击跳转到任一父节点

### 修改

- **`Layout.tsx`**：渲染全局命令面板；补齐 `useGlobalShortcuts` 的全局 handler（`navigateBack` / `navigateForward` / `goHome` / `openSettings` / `openSearch` / `toggleTheme` 已有但保留）
- **`useGlobalShortcuts.tsx`**：扩展 `isGlobalShortcut` 白名单，确保新增 handler 在输入框中也能被正确忽略 / 触发
- **`GraphEditor.tsx`**：移除本地 `Ctrl+K` 监听（改为由全局命令面板接管），保留图谱内命令面板的"图谱内"命令注入能力（通过回调将图谱命令注入全局面板，或保留图谱内二级面板 — 见 tasks 决策）
- **`ShortcutHelpPanel.tsx`**：抽取核心逻辑为可在 Settings 内嵌渲染的版本（浮层 + 内嵌双形态）

### 不做（明确排除）

- 不引入 `cmdk` 等新依赖，沿用既有 `CommandPalette` UI 模式
- 不做快捷键冲突检测（复杂度高，本次范围外）
- 不做最近访问的数据库落库与跨设备同步（保持 localStorage，与 `useRecentGraphs` 一致）
- 不做命令面板的模糊匹配算法升级（沿用现有 `includes` 过滤）
- 不重构 `Console`（开发者 CLI 保持独立）

## Impact

- **Affected specs**：无既有 spec 直接受影响；与 `extend-notes-p2-writing-refresh-search`、`extend-notes-p3-block-refs-embeds` 无冲突
- **Affected code**：
  - 新增：`src/components/common/GlobalCommandPalette.tsx`、`src/hooks/useRecentNodes.ts`、`src/hooks/useRecentNotes.ts`、`src/components/Settings/ShortcutSettings.tsx`、`src/components/GraphEditor/shared/NodeBreadcrumb.tsx`
  - 修改：`src/components/Layout/Layout.tsx`、`src/hooks/common/useGlobalShortcuts.tsx`、`src/pages/Settings.tsx`、`src/pages/GraphEditor.tsx`、`src/components/common/ShortcutHelpPanel.tsx`、`src/components/GraphEditor/shared/CommandPalette.tsx`（可选抽取）
- **风险**：
  - 全局 `Ctrl+K` 与 `GraphEditor` 内既有 `Ctrl+K` 监听冲突 — 需在 GraphEditor 中移除本地监听，避免双触发
  - `ShortcutHelpPanel` 抽取双形态时可能影响既有浮层行为 — 需保留浮层入口可用性

## ADDED Requirements

### Requirement: 全局命令面板

系统 SHALL 在 `Layout` 层挂载一个全局模态命令面板，由既有 `openCommandPalette` 快捷键（默认 `Ctrl+K`）触发，在所有非全屏页面（Layout 内）均可弹出。

#### Scenario: 用户在 Dashboard 按 Ctrl+K
- **WHEN** 已登录用户在 `/`（Dashboard）按下 `Ctrl+K`
- **THEN** 弹出全局命令面板，默认展示导航类命令与最近图谱列表
- **AND** 输入关键字可过滤命令与最近项
- **AND** 按 ↑↓ 选择、Enter 执行、Esc 关闭

#### Scenario: 从命令面板跳转到最近图谱
- **WHEN** 用户在命令面板中选择一条"最近图谱"项
- **THEN** 关闭面板并 `navigate('/graph/:id')`

#### Scenario: GraphEditor 内的 Ctrl+K
- **WHEN** 用户在 `/graph/:id` 按 `Ctrl+K`
- **THEN** 优先弹出图谱内命令面板（保留现有 `CommandPalette` 行为）
- **AND** 不触发全局命令面板（避免双弹窗）

#### Scenario: 输入框内按 Ctrl+K
- **WHEN** 焦点在 `<input>` / `<textarea>` / `[contenteditable]` 内
- **THEN** 全局命令面板不弹出（沿用 `useGlobalShortcuts` 的输入框忽略逻辑）

### Requirement: 最近节点 hook

系统 SHALL 提供 `useRecentNodes` hook，在 localStorage（key: `recent-nodes`）维护最多 10 条最近访问节点，字段含 `id / title / graphId / graphTopic / visitedAt`。

#### Scenario: 进入节点时记录
- **WHEN** 用户在 `GraphEditor` 中选中一个节点（节点被聚焦 / 成为 active node）
- **THEN** 该节点被添加到 `recent-nodes` 顶部（去重，超出 10 条截断）
- **AND** 不阻塞渲染（异步写入）

#### Scenario: 重复访问同一节点
- **WHEN** 用户再次访问已在列表中的节点
- **THEN** 该节点移动到列表顶部并更新 `visitedAt`，不产生重复条目

### Requirement: 最近笔记 hook

系统 SHALL 提供 `useRecentNotes` hook，在 localStorage（key: `recent-notes`）维护最多 10 条最近访问笔记，字段含 `id / title / visitedAt`。

#### Scenario: 打开笔记时记录
- **WHEN** 用户在 `/notes/:noteId` 页面加载完成
- **THEN** 该笔记被添加到 `recent-notes` 顶部（去重，超出 10 条截断）

### Requirement: Settings 快捷键分段

系统 SHALL 在 `Settings` 页面新增 `shortcuts` 分段，复用 `ShortcutHelpPanel` 的查看 / 自定义 / 重置能力，支持内嵌渲染（非浮层）。

#### Scenario: 从 Settings 进入快捷键管理
- **WHEN** 用户在 `/settings` 选择"快捷键"分段
- **THEN** 内嵌展示快捷键列表（按类别分组、可搜索）
- **AND** 支持点击某条快捷键重新绑定、单条重置、全部重置
- **AND** 行为与既有 `ShortcutHelpPanel` 浮层一致

#### Scenario: 既有帮助浮层入口保留
- **WHEN** 用户从 Layout header 帮助按钮或 GraphEditor `?` 快捷键打开帮助
- **THEN** 既有浮层行为不变（不因抽取内嵌版本而破坏）

### Requirement: GraphEditor 节点面包屑

系统 SHALL 在 `GraphEditor` 顶部显示当前选中节点的层级面包屑：`图谱标题 / 父节点链 / 当前节点`。

#### Scenario: 选中节点有父链
- **WHEN** 用户选中一个有父节点的节点
- **THEN** 顶部显示 `图谱标题 / 父节点A / 父节点B / 当前节点`
- **AND** 点击任一父节点跳转到该节点（聚焦 / 居中）
- **AND** 点击图谱标题不跳转（已在图谱内）

#### Scenario: 选中根节点
- **WHEN** 用户选中无父节点的根节点
- **THEN** 面包屑仅显示 `图谱标题 / 当前节点`

#### Scenario: 未选中节点
- **WHEN** 无节点被选中
- **THEN** 不渲染面包屑（或仅显示图谱标题）

## MODIFIED Requirements

### Requirement: 全局快捷键 handler 接线

`Layout.tsx` 中 `useGlobalShortcuts` 的 handler 注册 SHALL 覆盖以下 action（此前未接线）：`navigateBack` / `navigateForward` / `goHome` / `openSettings` / `openSearch`（打开全局命令面板或独立搜索）/ `openCommandPalette`（全局）。

#### Scenario: 任意页面按 Alt+Left（navigateBack）
- **WHEN** 用户在非全屏页面按 `Alt+Left`（或 `navigateBack` 绑定的快捷键）
- **THEN** 等价于 `navigate(-1)`

#### Scenario: 任意页面按 Ctrl+,（openSettings）
- **WHEN** 用户在非全屏页面按 `Ctrl+,`
- **THEN** 跳转到 `/settings`

#### Scenario: 输入框内不触发导航
- **WHEN** 焦点在输入框内按 `Alt+Left`
- **THEN** 不触发 `navigate(-1)`（沿用 `isGlobalShortcut` 白名单逻辑，导航类不在白名单）
