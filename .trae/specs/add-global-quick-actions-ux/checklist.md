# Checklist

## 全局命令面板

- [x] `GlobalCommandPalette` 组件已创建于 `src/components/common/GlobalCommandPalette.tsx`
- [x] 组件由全局 `Ctrl+K`（`openCommandPalette` 快捷键）触发，在所有 Layout 内页面可弹出
- [x] 全屏页面（`isFullScreenPage`，含 `/graph/:id`）不挂载全局面板
- [x] 命令分组包含：navigation / recent / action
- [x] 导航命令从 `frontendKernel.getNavItems()` 动态获取，未硬编码路径
- [x] 最近项来自 `useRecentGraphs` / `useRecentNodes` / `useRecentNotes` 三个 hook
- [x] 输入框过滤：`includes` 大小写不敏感，匹配 `label` / `keywords`
- [x] 键盘导航：↑↓ 选择、Enter 执行、Esc 关闭
- [x] 选择项后面板关闭并 `navigate` 到目标路径
- [x] 输入框聚焦时按 `Ctrl+K` 不弹出（沿用 `isGlobalShortcut` 逻辑）

## GraphEditor Ctrl+K 冲突处理

- [x] GraphEditor 内按 `Ctrl+K` 仅弹出图谱内 `CommandPalette`，不触发全局面板
- [x] Layout 的 `openCommandPalette` handler 在 `/graph/:id` 路径下不打开全局面板
- [x] 无双弹窗、无死锁

## 最近节点 hook

- [x] `useRecentNodes` 已创建于 `src/hooks/useRecentNodes.ts`
- [x] localStorage key 为 `recent-nodes`，最多 10 条
- [x] 字段含 `id / title / graphId / graphTopic / visitedAt`
- [x] 暴露 `getRecentNodes / addRecentNode / removeRecentNode / clearRecentNodes`
- [x] 重复访问同一节点时移到顶部并更新 `visitedAt`，无重复条目
- [x] GraphEditor 选中节点时调用 `addRecentNode`，effect 依赖正确无无限循环

## 最近笔记 hook

- [x] `useRecentNotes` 已创建于 `src/hooks/useRecentNotes.ts`
- [x] localStorage key 为 `recent-notes`，最多 10 条
- [x] 字段含 `id / title / visitedAt`
- [x] 暴露 `getRecentNotes / addRecentNote / removeRecentNote / clearRecentNotes`
- [x] Notes 详情页加载完成时调用 `addRecentNote`

## 全局快捷键 handler 接线

- [x] `Layout.tsx` 的 `useGlobalShortcuts` 注册了以下 handler：
  - [x] `navigateBack` → `navigate(-1)`
  - [x] `navigateForward` → `navigate(1)`
  - [x] `goHome` → `navigate('/')`
  - [x] `openSettings` → `navigate('/settings')`
  - [x] `openSearch` → 打开全局命令面板（或独立搜索入口）
  - [x] `openCommandPalette` → 打开全局命令面板
  - [x] `toggleTheme` / `openConsole` / `showHelp` 保留既有
- [x] `isGlobalShortcut` 白名单逻辑正确：导航类不在白名单（输入框内不触发）
- [x] 非全屏页面按 `Alt+Left` 等价于浏览器后退
- [x] 非全屏页面按 `Ctrl+,` 跳转到 `/settings`

## Settings 快捷键分段

- [x] `ShortcutHelpPanel` 已重构为支持浮层 + 内嵌双形态
- [x] 既有浮层入口（Layout header 帮助按钮、GraphEditor `?` 快捷键）行为不变
- [x] `src/components/Settings/ShortcutSettings.tsx` 已创建
- [x] `Settings.tsx` 的 `sections` 数组中已插入 `shortcuts` 分段
- [x] `/settings` 页面"快捷键"分段功能完整：可搜索、按类别分组、单条重置、全部重置、重新绑定

## GraphEditor 节点面包屑

- [x] `NodeBreadcrumb` 组件已创建于 `src/components/GraphEditor/shared/NodeBreadcrumb.tsx`
- [x] Props 包含 `graphTitle / selectedNode / parentChain / onSelectNode`
- [x] 选中有父链的节点时显示 `图谱标题 / 父节点A / 父节点B / 当前节点`
- [x] 选中根节点时显示 `图谱标题 / 当前节点`
- [x] 未选中节点时不渲染（或仅渲染图谱标题）
- [x] 点击父节点触发 `onSelectNode` 跳转
- [x] 点击图谱标题不跳转
- [x] 样式紧凑、不遮挡画布
- [x] GraphEditor 已接入 `<NodeBreadcrumb />`，父链计算基于 edges 数据正确

## 代码规范

- [x] 无 `any` 类型
- [x] 无非空断言 `!`
- [x] 前端无 `console.log/info`（允许 `warn/error`）
- [x] `npm run check` 通过
- [x] `npm run lint` 通过

## 场景验证

- [x] Dashboard 按 `Ctrl+K` 弹出全局面板，可跳转到最近图谱
- [x] Notes 页按 `Ctrl+K` 弹出全局面板
- [x] GraphEditor 按 `Ctrl+K` 弹出图谱内面板（非全局面板）
- [x] 输入框内按 `Ctrl+K` 不弹面板
- [x] 非全屏页面按 `Alt+Left` 浏览器后退
- [x] 非全屏页面按 `Ctrl+,` 跳转设置
- [x] `/settings` 快捷键分段可正常查看 / 自定义 / 重置
- [x] Layout header 帮助按钮浮层仍可正常打开
- [x] GraphEditor 选中深层节点时面包屑显示完整父链，点击父节点可跳转
- [x] 重复访问同一节点 / 笔记，最近列表去重并置顶
