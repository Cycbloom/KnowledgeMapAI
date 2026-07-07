# Tasks

## 阶段一：基础 hook 与组件抽取（无 UI 接入，可并行）

- [x] Task 1: 新增 `useRecentNodes` hook
  - [ ] 创建 `src/hooks/useRecentNodes.ts`，模仿 `useRecentGraphs.ts` 的实现风格
  - [ ] localStorage key：`recent-nodes`，最多 10 条
  - [ ] 字段：`id / title / graphId / graphTopic / visitedAt`
  - [ ] 暴露 `getRecentNodes / addRecentNode / removeRecentNode / clearRecentNodes`
  - [ ] 去重逻辑：相同 `id` 移到顶部并更新 `visitedAt`
  - [ ] 验证：写一个简单的单元测试或手动在浏览器控制台验证 localStorage 写入

- [x] Task 2: 新增 `useRecentNotes` hook
  - [ ] 创建 `src/hooks/useRecentNotes.ts`
  - [ ] localStorage key：`recent-notes`，最多 10 条
  - [ ] 字段：`id / title / visitedAt`
  - [ ] 暴露 `getRecentNotes / addRecentNote / removeRecentNote / clearRecentNotes`
  - [ ] 去重逻辑同上

- [x] Task 3: 抽取 `ShortcutHelpPanel` 为双形态（浮层 + 内嵌）
  - [ ] 重构 `src/components/common/ShortcutHelpPanel.tsx`，将核心列表 / 搜索 / 自定义 / 重置逻辑抽取为 `ShortcutListContent` 子组件
  - [ ] 保留 `ShortcutHelpPanel` 作为浮层包装（Modal + 触发按钮）
  - [ ] 新增 `ShortcutSettingsContent`（或直接复用 `ShortcutListContent`）供 Settings 内嵌渲染
  - [ ] 验证：Layout header 帮助按钮、GraphEditor `?` 快捷键两个既有入口行为不变

## 阶段二：全局命令面板（依赖阶段一 hook）

- [x] Task 4: 创建 `GlobalCommandPalette` 组件
  - [ ] 创建 `src/components/common/GlobalCommandPalette.tsx`
  - [ ] 复用 `CommandPalette.tsx` 的 UI 模式（模态 / 列表 / ↑↓EnterEsc / 分组），但不引入图谱耦合的 `nodes` prop
  - [ ] 命令分组：`navigation`（导航跳转）/ `recent`（最近图谱 + 节点 + 笔记）/ `action`（快速操作）
  - [ ] 导航命令列表：`/` / `/graph-map` / `/notes` / `/study` / `/scheduler` / `/statistics` / `/settings` / `/trash`（从 `frontendKernel.getNavItems()` 动态获取，避免硬编码）
  - [ ] 最近项：调用 `useRecentGraphs` / `useRecentNodes` / `useRecentNotes`，按类型分组渲染
  - [ ] 快速操作：新建图谱（跳 `/`）、切换主题（调用既有 toggleTheme）、打开设置、打开搜索（暂用全局面板的搜索输入，不依赖 GlobalSearch）
  - [ ] 选择项后关闭面板并 `navigate`
  - [ ] 输入框过滤：`includes` 大小写不敏感，匹配 `label` / `keywords`

- [x] Task 5: 在 `Layout.tsx` 挂载全局命令面板
  - [ ] 引入 `GlobalCommandPalette`，由 Layout 持有 `isOpen` 状态
  - [ ] 在 `useGlobalShortcuts` handler 中注册 `openCommandPalette`：切换 `isOpen`
  - [ ] 确保全屏页面（`isFullScreenPage`）不挂载（GraphEditor 自行处理 Ctrl+K）
  - [ ] 验证：Dashboard / Notes / Study / Statistics 页面按 `Ctrl+K` 均能弹出

## 阶段三：全局快捷键 handler 接线

- [x] Task 6: 补齐 `Layout.tsx` 的全局 handler
  - [ ] 在 `useGlobalShortcuts` 调用处补齐 handler：
    - `navigateBack` → `navigate(-1)`
    - `navigateForward` → `navigate(1)`
    - `goHome` → `navigate('/')`
    - `openSettings` → `navigate('/settings')`
    - `openSearch` → 打开全局命令面板（与 `openCommandPalette` 一致，或单独搜索入口 — 见决策）
    - `toggleTheme`（保留既有）
    - `openConsole`（保留既有）
    - `showHelp`（保留既有）
  - [ ] 验证：在非全屏页面分别按下上述快捷键，行为符合预期
  - [ ] 验证：输入框内按 `Alt+Left` 不触发 `navigate(-1)`

- [x] Task 7: 调整 `useGlobalShortcuts` 白名单
  - [ ] 检查 `isGlobalShortcut` 逻辑，确保新增 handler 在输入框内的忽略 / 触发行为正确
  - [ ] 导航类（navigateBack/Forward/goHome/openSettings）应**不**在白名单（输入框内不触发）
  - [ ] `openCommandPalette` / `openConsole` 在白名单（输入框内也触发 — 但需确认是否与输入框原生 Ctrl+K 冲突，若有冲突则也排除）

## 阶段四：Settings 快捷键分段（依赖 Task 3）

- [x] Task 8: 新增 Settings `shortcuts` 分段
  - [ ] 创建 `src/components/Settings/ShortcutSettings.tsx`，渲染 Task 3 抽取的内嵌内容
  - [ ] 在 `src/pages/Settings.tsx` 的 `sections` 数组中插入 `shortcuts` 项（位置：在 `graphEditor` 之后、`notifications` 之前）
  - [ ] 在 `src/components/Settings/index.ts` 与 `settingsConstants.ts` 中导出
  - [ ] 验证：`/settings` 页面能看到"快捷键"分段，功能与浮层一致

## 阶段五：GraphEditor 节点面包屑

- [x] Task 9: 创建 `NodeBreadcrumb` 组件（已在阶段一完成）
  - [ ] 创建 `src/components/GraphEditor/shared/NodeBreadcrumb.tsx`
  - [ ] Props：`graphTitle` / `selectedNode` / `parentChain`（节点 ID 数组，从根到当前节点的父链）/ `onSelectNode(id)`
  - [ ] 渲染：`图谱标题 / 父节点A / 父节点B / 当前节点`，分隔符 `/` 或 `>`
  - [ ] 点击父节点 → `onSelectNode(id)`；点击图谱标题无操作
  - [ ] 未选中节点时不渲染（或仅渲染图谱标题）
  - [ ] 样式：紧凑、不遮挡画布，参考既有 `Breadcrumb.tsx` 风格

- [x] Task 10: 在 `GraphEditor.tsx` 接入面包屑
  - [ ] 计算选中节点的父链（基于 edges 数据，从根到当前节点）
  - [ ] 在 GraphEditor 顶部合适位置渲染 `<NodeBreadcrumb />`
  - [ ] 父节点点击 → 调用既有节点聚焦 / 居中逻辑
  - [ ] 验证：选中根节点、选中深层节点、未选中节点三种场景显示正确

## 阶段六：接入最近节点 / 最近笔记记录

- [x] Task 11: GraphEditor 接入 `useRecentNodes`
  - [ ] 在 `GraphEditor.tsx` 中监听 selectedNode 变化，调用 `addRecentNode`
  - [ ] 传入 `id / title / graphId / graphTopic / visitedAt`
  - [ ] 注意 debounce 或 effect 依赖控制，避免频繁写入

- [x] Task 12: Notes 页面接入 `useRecentNotes`
  - [ ] 在 `src/pages/NoteEditor.tsx`（或对应笔记详情页组件）中，页面加载完成后调用 `addRecentNote`
  - [ ] 传入 `id / title / visitedAt`

## 阶段七：GraphEditor Ctrl+K 冲突处理

- [x] Task 13: 处理 GraphEditor 与全局命令面板的 Ctrl+K 冲突
  - [ ] 决策（二选一）：
    - **方案 A**：保留 GraphEditor 内 `CommandPalette`，在 `useGlobalShortcuts` 中判断当前路径，若为 `/graph/:id` 则不触发全局面板
    - **方案 B**：移除 GraphEditor 内 `CommandPalette`，将图谱内命令注入全局命令面板（通过 context 或 callback 注入当前页面命令）
  - [ ] 推荐方案 A（改动小、风险低）
  - [ ] 实现方案 A：在 Layout 的 `openCommandPalette` handler 中检查 `location.pathname`，若在 GraphEditor 全屏路径则不打开
  - [ ] 验证：GraphEditor 内 Ctrl+K 弹出图谱内面板；其他页面弹出全局面板

## 阶段八：验证与文档

- [x] Task 14: 类型检查与 lint
  - [ ] 运行 `npm run check`
  - [ ] 运行 `npm run lint`
  - [ ] 修复所有报错（注意：无 `any`、无非空断言 `!`、前端无 `console.log/info`）

- [x] Task 15: 手动验证所有场景
  - [ ] 按 spec.md 中所有 Scenario 逐条验证
  - [ ] 重点验证：GraphEditor Ctrl+K 不双触发、Settings 快捷键分段功能完整、面包屑三种场景、最近项去重

# Task Dependencies

- Task 1 / 2 / 3 可并行（无相互依赖）
- Task 4 依赖 Task 1 / 2（需要 recent hooks）
- Task 5 依赖 Task 4
- Task 6 / 7 可并行（与 Task 5 同层，但建议 Task 5 先行以避免 handler 冲突）
- Task 8 依赖 Task 3
- Task 9 / 10 可并行（与阶段四独立）
- Task 11 依赖 Task 1
- Task 12 依赖 Task 2
- Task 13 依赖 Task 5（需要全局面板已挂载才能验证冲突）
- Task 14 / 15 依赖所有功能任务完成
