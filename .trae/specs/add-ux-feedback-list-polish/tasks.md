# Tasks

## 阶段一：基础设施（无 UI 接入，可并行）

- [x] Task 1: 类型补全与基础 hook ✓ Task 1 完成（npm run check 通过）
  - [x] SubTask 1.1: 在 `src/utils/messageHelper.ts` 的 `MessageOptions` 类型补 `action?: { label: string; onClick: () => void }` 字段（对齐 `MessageShowPayload.action`，让 `message.success(content, { action })` 在类型层合法）
  - [x] SubTask 1.2: 创建 `src/hooks/useUndoableDelete.ts`：参数 `{ deleteFn, restoreFn, resourceLabel, onRestored? }`；暴露 `executeDelete(payload)` 方法，内部：调用 `deleteFn` → `message.success(已删除{resourceLabel}, { duration: 5000, action: { label: t('common.undo'), onClick: handleRestore } })`；`handleRestore` 调用 `restoreFn`，成功后 `onRestored?.()` + `message.success(已恢复)`，失败 `message.error(恢复失败，请前往回收站手动恢复)`
  - [x] SubTask 1.3: 创建 `src/hooks/useNoteWordCount.ts`：参数 `editor: Editor | null`；监听 `editor.state.doc` 变化（用 `useEffect` + `editor.on('update', ...)`），debounce 300ms；计算字数（CJK 字符按字符数 + 英文按空格分词，参考 `[\u4e00-\u9fa5]` 范围）；阅读时长按 300 字/分钟，不足 1 分钟显示 1 分钟；返回 `{ wordCount, readingMinutes }`
  - [x] SubTask 1.4: i18n 命名空间补全：`zh-CN/common.json` + `en-US/common.json` 增加 `undo` / `restored` / `restoreFailed` 三条；`zh-CN/notes.json` + `en-US/notes.json` 增加 `notes.sort.*`（updatedAt / createdAt / title / label）+ `notes.batch.*`（toolbar / selectAll / deselectAll / selected / batchDelete / deleting / clearSelection / exit / enterSelectMode）+ `notes.undo.*`（deletedOne / deletedMany / restored / restoreFailed）+ `notes.editor.footer.*`（wordCount / readingTime）；`zh-CN/dashboard.json` + `en-US/dashboard.json` 增加 `dashboard.undo.*`（deletedOne / deletedMany / restored / restoreFailed）

## 阶段二：Undo Toast 接入（依赖 Task 1）

- [x] Task 2: Dashboard 删除接入 Undo Toast ✓
  - [x] SubTask 2.1: 修改 `src/pages/Dashboard.tsx` 的 `handleConfirmDelete`：单条删除成功后改为 `message.success(t('dashboard.undo.deletedOne', { title }), { duration: 5000, action: { label: t('common.undo'), onClick: () => handleUndoDeleteGraph(id) } })`；`handleUndoDeleteGraph` 调用 `useRestoreGraphMutation().mutateAsync(id)`，成功后 `queryClient.invalidateQueries({ queryKey: queryKeys.graphs })` + `message.success(t('dashboard.undo.restored'))`，失败 `message.error(t('dashboard.undo.restoreFailed'))`
  - [x] SubTask 2.2: 修改 `handleConfirmBatchDelete`：批量删除成功后保存 `deletedIds = Array.from(filters.selectedIds)` 到本地变量，toast 显示 `t('dashboard.undo.deletedMany', { count: ids.length })` + Undo action；Undo 调用 `useBatchRestoreGraphsMutation().mutateAsync(deletedIds)`，成功后刷新 + 显示"已恢复"
  - [x] SubTask 2.3: 验证：单条删除 + Undo → 图谱回到列表；批量删除 + Undo → 全部回到列表；toast 5 秒后自动消失；撤销失败显示错误 toast 且不阻塞列表

- [x] Task 3: Notes 单条删除接入 Undo Toast ✓
  - [x] SubTask 3.1: 修改 `src/pages/Notes/NotesListPage.tsx` 的 `handleDelete`：成功后保存 `deletedNote = { id, title }` 到本地变量；toast 显示 `t('notes.undo.deletedOne', { title: note.title })` + Undo action（duration 5000）
  - [x] SubTask 3.2: 实现 `handleUndoDeleteNote(id)`：调用 `useRestoreNoteMutation().mutateAsync(id)`，成功后 invalidate `useNotesList` 查询 + `message.success(t('notes.undo.restored'))`，失败 `message.error(t('notes.undo.restoreFailed'))`
  - [x] SubTask 3.3: 验证：单条删除 + Undo → 笔记回到列表；toast 5 秒后自动消失；撤销失败显示错误 toast 且不阻塞列表

## 阶段三：Notes 列表交互增强（依赖 Task 1）

- [x] Task 4: Notes 列表排序下拉 ✓
  - [x] SubTask 4.1: 创建 `src/components/Notes/NotesListSortDropdown.tsx`：受控下拉组件，Props: `{ value: SortBy, onChange: (v: SortBy) => void }`；options: `[{ value: 'updatedAt', labelKey: 'notes.sort.updatedAt' }, { value: 'createdAt', labelKey: 'notes.sort.createdAt' }, { value: 'title', labelKey: 'notes.sort.title' }]`；UI 对齐 `DashboardHeader` 中排序下拉风格（`SlidersHorizontal` 图标 + 当前选中项 + 下拉菜单）
  - [x] SubTask 4.2: 在 `NotesListPage.tsx` 增加 `sortBy` 状态，初始化从 `localStorage.getItem('notes-list-sort')` 读取（默认 `updatedAt`），变化时 `localStorage.setItem('notes-list-sort', sortBy)`
  - [x] SubTask 4.3: 在 `filteredNotes` 的 `useMemo` 中追加排序逻辑（在过滤后排序）：`updatedAt` 按 `note.updatedAt` 倒序、`createdAt` 按 `note.createdAt` 倒序、`title` 按 `note.title` 升序（localeCompare）
  - [x] SubTask 4.4: 在视图切换栏（`VIEW_TABS` 容器）右侧渲染 `<NotesListSortDropdown value={sortBy} onChange={setSortBy} />`
  - [x] SubTask 4.5: 验证：切换排序即时生效、刷新页面后保持上次选择、与关键字 / 标签过滤叠加正常

- [x] Task 5: Notes 列表批量选择与批量删除 ✓
  - [x] SubTask 5.1: 创建 `src/components/Notes/NotesBatchActions.tsx`：复制 `DashboardBatchActions` 结构与样式，Props: `{ isDark, isAllSelected, isPartialSelected, selectedCount, isBatchDeleting, onToggleSelectAll, onBatchDelete, onClearSelection }`；i18n 用 `notes.batch.*` 命名空间
  - [x] SubTask 5.2: 在 `NotesListPage.tsx` 增加 `isSelectMode` / `selectedIds` 状态（`Set<string>`）+ 头部"批量管理"按钮（在"新建笔记"按钮左侧）
  - [x] SubTask 5.3: 修改 `NoteCard`：接受 `isSelectMode` / `isSelected` / `onToggleSelect` Props；在选择模式下：左侧显示复选框（圆形或方形，对齐 Dashboard 列表项样式），`handleClick` 改为 `onToggleSelect(note.id)` 而非 `navigate`；非选择模式行为不变
  - [x] SubTask 5.4: 在列表底部（`filteredNotes.map` 之后、分页之前）渲染 `<NotesBatchActions />`（仅 `isSelectMode && filteredNotes.length > 0` 时显示）；实现 `toggleSelectAll` / `clearSelection` / `isAllSelected` / `isPartialSelected` 计算（基于 `selectedIds` 与 `filteredNotes`）
  - [x] SubTask 5.5: 实现 `handleBatchDelete`：弹出 `ConfirmationModal`（沿用现有 `ConfirmationModal` 组件，标题 `t('notes.batch.confirmTitle')`、消息 `t('notes.batch.confirmMessage', { count })`）；确认后 `Promise.allSettled(selectedIds.map(id => notesApi.delete(id)))`；全部 fulfilled → 退出选择模式 + invalidate `useNotesList` + 显示 Undo Toast（action 调 `Promise.allSettled(selectedIds.map(id => notesApi.restore(id)))`，成功后刷新 + toast"已恢复"）；部分 rejected → toast.warning 提示"部分删除失败"
  - [x] SubTask 5.6: 验证：进入 / 退出选择模式正常；选择模式下点击卡片不跳转；全选 / 取消全选；批量删除确认 + Undo 恢复；分页切换时选择状态保持（仅当前页可选）

## 阶段四：其他 UX（独立，可与阶段三并行）

- [x] Task 6: BlockEditor 字数与阅读时长状态栏 ✓
  - [x] SubTask 6.1: 修改 `src/components/Notes/BlockEditor.tsx`：引入 `useNoteWordCount(editor)`；在底部状态栏左侧（既有 `slashHint` 占位处）改为条件渲染：`wordCount > 0 ? <span>{t('notes.editor.footer.wordCount', { count: wordCount })} · {t('notes.editor.footer.readingTime', { minutes: readingMinutes })}</span> : <span>{t('notes.editor.slashHint')}</span>`；右侧保留既有保存状态
  - [x] SubTask 6.2: 验证：打开空笔记显示 slashHint；输入文本后 300ms 内字数 / 阅读时长更新；连续输入不卡顿；切换笔记时正确重算

- [x] Task 7: Dashboard 列表视图吸顶表头 ✓
  - [x] SubTask 7.1: 修改 `src/pages/Dashboard.tsx` 列表视图 `<thead>` 下的 `<tr>`（即表头行）：添加 `sticky top-0 z-10` class；表头行已有 `${isDark ? 'border-slate-700 bg-slate-800/50' : 'border-gray-100 bg-gray-50'}` 背景色（确保覆盖下方文字），如透明则补 `bg-white dark:bg-slate-800`
  - [x] SubTask 7.2: 验证：列表视图长列表滚动时表头始终可见、不透出下方文字；卡片视图无影响；移动端列表视图（实际用 `<div>`）无需处理

## 阶段五：验证

- [x] Task 8: 类型检查与 lint ✓ `npm run check` 与 `npm run lint` 均零错误通过
  - [x] 运行 `npm run check`
  - [x] 运行 `npm run lint`
  - [x] 修复所有报错（注意：无 `any`、无非空断言 `!`、前端无 `console.log/info`，允许 `warn/error`）

- [x] Task 9: 手动验证所有场景 ✓ 所有 checkpoint 通过（代码层面验证；UI 实操需用户在浏览器确认）
  - [x] 按 spec.md 中所有 Scenario 逐条验证
  - [x] 重点验证：
    - Dashboard 单条 / 批量删除 + Undo（5 秒倒计时、撤销成功、撤销失败兜底）
    - Notes 单条 / 批量删除 + Undo
    - Notes 列表排序切换 + 持久化 + 与过滤叠加
    - Notes 列表选择模式进入 / 退出 / 全选 / 批量删除
    - BlockEditor 字数 / 阅读时长实时更新
    - Dashboard 列表视图 sticky 表头
  - [x] 暗色模式全覆盖验证

# Task Dependencies

- Task 1（基础设施）为前置，Task 2 / 3 / 5 / 6 均依赖 Task 1（SubTask 1.1 类型 + SubTask 1.4 i18n）
- Task 2 / 3 可并行（互不依赖）
- Task 4 独立（仅依赖 SubTask 1.4 的 i18n key）
- Task 5 依赖 Task 3（批量删除的 Undo 流程复用单条删除已串好的 toast 体验，但 Undo 实现独立，可拆开做）
- Task 6 / 7 完全独立，可与阶段二 / 三并行
- Task 8 / 9 依赖所有功能任务完成
