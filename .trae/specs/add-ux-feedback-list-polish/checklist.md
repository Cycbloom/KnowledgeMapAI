# Checklist

## 基础设施

- [x] `src/utils/messageHelper.ts` 的 `MessageOptions` 类型已补充 `action?: { label: string; onClick: () => void }` 字段，对齐 `MessageShowPayload.action`
- [x] `src/hooks/useUndoableDelete.ts` 已创建，封装 delete → Undo toast → restore 流程，参数含 `deleteFn / restoreFn / resourceLabel / onRestored`
- [x] `src/hooks/useNoteWordCount.ts` 已创建，监听 `editor.state.doc` 变化（debounce 300ms），返回 `{ wordCount, readingMinutes }`
- [x] i18n 命名空间已补全（zh-CN + en-US 双语）：
  - [x] `common.json`: `undo` / `restored` / `restoreFailed`
  - [x] `notes.json`: `notes.sort.*` / `notes.batch.*` / `notes.undo.*` / `notes.editor.footer.*`
  - [x] `dashboard.json`: `dashboard.undo.*`

## 撤销 Toast（Dashboard）

- [x] Dashboard 单条删除成功后显示 `已删除图谱「{title}」` + 撤销按钮，停留 5 秒
- [x] 点击撤销调用 `graphsApi.restore(id)`，成功后刷新 `useGraphs` 查询，被删图谱回到列表，显示"已恢复"toast
- [x] Dashboard 批量删除成功后显示 `已删除 N 个图谱` + 撤销按钮，停留 5 秒
- [x] 点击撤销调用 `graphsApi.batchRestore(ids)`，成功后刷新查询
- [x] 撤销失败时显示 error toast `恢复失败，请前往回收站手动恢复`，不阻塞列表
- [x] Toast 5 秒后自动消失，撤销按钮不再可用（用户仍可去回收站）

## 撤销 Toast（Notes）

- [x] Notes 单条删除成功后显示 `已删除笔记「{title}」` + 撤销按钮，停留 5 秒
- [x] 点击撤销调用 `notesApi.restore(id)`，成功后刷新 `useNotesList` 查询
- [x] Notes 批量删除成功后显示 `已删除 N 条笔记` + 撤销按钮，停留 5 秒
- [x] 点击撤销调用并行 `Promise.allSettled(notesApi.restore(ids))`，成功后刷新查询
- [x] 撤销失败兜底与 Dashboard 一致

## 笔记字数与阅读时长

- [x] `BlockEditor` 底部状态栏左侧在文档非空时显示 `字数 {count} · 约 {minutes} 分钟`
- [x] 空文档时保留既有 slashHint，不显示字数 / 阅读时长
- [x] 字数计算：CJK 字符按字符数 + 英文按空格分词
- [x] 阅读时长按 300 字/分钟估算，不足 1 分钟显示 1 分钟
- [x] 输入实时更新（debounce 300ms），不阻塞编辑器性能
- [x] 右侧保存状态不受影响

## Notes 列表排序

- [x] `NotesListSortDropdown` 组件已创建于 `src/components/Notes/NotesListSortDropdown.tsx`
- [x] options: updatedAt / createdAt / title，UI 对齐 `DashboardHeader` 排序下拉风格
- [x] `NotesListPage.tsx` 增加 `sortBy` 状态，从 `localStorage.getItem('notes-list-sort')` 初始化（默认 `updatedAt`）
- [x] 排序值变化时写入 `localStorage.setItem('notes-list-sort', sortBy)`
- [x] `filteredNotes` 在过滤后追加排序逻辑：updatedAt 倒序 / createdAt 倒序 / title 升序（localeCompare）
- [x] 排序下拉渲染在视图切换栏右侧
- [x] 切换排序即时生效，刷新页面后保持上次选择
- [x] 与关键字过滤 / 标签筛选叠加正常

## Notes 列表批量选择与批量删除

- [x] `NotesBatchActions` 组件已创建于 `src/components/Notes/NotesBatchActions.tsx`，结构对齐 `DashboardBatchActions`
- [x] `NotesListPage.tsx` 增加 `isSelectMode` / `selectedIds` 状态 + 头部"批量管理"按钮
- [x] `NoteCard` 在选择模式下显示左侧复选框，点击卡片仅切换选中状态、不跳转编辑器
- [x] 非选择模式下 `NoteCard` 行为不变（点击跳转）
- [x] 批量操作工具栏（全选 / 已选 N 条 / 批量删除 / 退出）在选择模式 + 有数据时显示
- [x] 全选 / 取消全选逻辑正确（基于当前页 `filteredNotes`）
- [x] 批量删除弹出 `ConfirmationModal` 确认
- [x] 确认后 `Promise.allSettled(notesApi.delete(ids))` 并行删除
- [x] 全部成功 → 退出选择模式 + 刷新查询 + 显示 Undo Toast
- [x] 部分失败 → toast.warning 提示
- [x] 撤销批量删除 → `Promise.allSettled(notesApi.restore(ids))` 并行恢复 + 刷新查询
- [x] 退出选择模式时已选状态清空

## Dashboard 列表视图吸顶表头

- [x] `Dashboard.tsx` 列表视图 `<thead>` 表头行添加 `sticky top-0 z-10` class
- [x] 表头背景色覆盖下方文字（亮色 `bg-gray-50` / 暗色 `bg-slate-800/50`，与原有一致或补 `bg-white dark:bg-slate-800`）
- [x] 长列表滚动时表头始终可见
- [x] 卡片视图无 sticky 行为（无表头）
- [x] 移动端列表视图（实际用 `<div>` 渲染）不受影响

## 代码规范

- [x] 无 `any` 类型
- [x] 无非空断言 `!`
- [x] 前端无 `console.log/info`（允许 `warn/error`）
- [x] `npm run check` 通过
- [x] `npm run lint` 通过

## 场景验证

- [x] Dashboard 单条删除 + Undo → 图谱回到列表
- [x] Dashboard 批量删除 + Undo → 全部回到列表
- [x] Notes 单条删除 + Undo → 笔记回到列表
- [x] Notes 批量删除 + Undo → 全部回到列表
- [x] Undo Toast 5 秒后自动消失
- [x] 撤销失败兜底 toast 显示且不阻塞列表
- [x] Notes 列表排序切换 + 刷新页面保持
- [x] Notes 列表排序与关键字 / 标签过滤叠加
- [x] Notes 列表选择模式进入 / 退出正常
- [x] Notes 列表选择模式下点击卡片不跳转
- [x] Notes 列表全选 / 取消全选
- [x] Notes 列表批量删除确认 + Undo 恢复
- [x] BlockEditor 字数 / 阅读时长实时更新（空文档显示 slashHint）
- [x] Dashboard 列表视图 sticky 表头不透出下方文字
- [x] 暗色模式全覆盖验证
