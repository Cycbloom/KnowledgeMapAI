# Tasks

## P2 任务清单

### 第一组:数据库与共享类型(其他组依赖)

- [x] Task 1: 写作辅助 Prompt seed
  - [x] SubTask 1.1: 新增 `supabase/migrations/54_seed_prompt_writing_assist.sql`,在 `prompt_templates` 表 seed 三个 Prompt(均 system scope):
    - `notes_writing_continue`(System:你是写作助手,基于用户选中的文本与上下文续写后续内容,保持语气风格一致)
    - `notes_writing_rewrite`(System:你是写作助手,改写用户选中的文字,保持原意优化表达)
    - `notes_writing_expand`(System:你是写作助手,扩写用户选中的文字,添加细节/举例/论证)
    - 每个含变量占位:`{{selectedText}}`、`{{contextBefore}}`、`{{contextAfter}}`
  - [x] SubTask 1.2: 文件头注释提醒运行 `npx supabase db reset`

- [x] Task 2: 共享类型扩展
  - [x] SubTask 2.1: 扩展 `shared/types/note.ts`:
    - `WritingAssistAction = "continue" | "rewrite" | "expand"`
    - `WritingAssistRequest { noteId: string; action: WritingAssistAction; selectedText: string; contextBefore?: string; contextAfter?: string }`
    - `WritingAssistResponse { suggestion: string; tokensUsed?: number }`
    - `RefreshDailyAggregationResponse { note: Note; refreshed: boolean }`
  - [x] SubTask 2.2: 类型导出至 `shared/types/index.ts`(若 P0/P1 已用 `export *`,自动覆盖)

### 第二组:后端服务扩展

- [x] Task 3: 写作辅助与 Daily 数据刷新服务
  - [x] SubTask 3.1: `api/services/notes/notesService.ts` 新增 `writingAssist(req: WritingAssistRequest)`:
    - 读取笔记(校验存在与属主)
    - `promptService.getRenderedPrompt(\`notes_writing_${req.action}\`, { selectedText, contextBefore, contextAfter })`
    - `aiService.chat` 调用(单一 system+user 消息)
    - `performanceMonitor.recordLog` 记录 token 用量与时长
    - 返回 `{ suggestion, tokensUsed }`
  - [x] SubTask 3.2: 新增 `refreshDailyAggregation(noteId)`:
    - 读取笔记(校验 type="daily")
    - 调用现有 `getDailyAggregation(userId, date)` 获取最新统计
    - 渲染 `## 今日数据` 段 Markdown(与系统默认模板格式一致)
    - 用正则 `/^## 今日数据$\n(?:.*\n)*?(?=^## |\n$|$)/m` 定位正文中的"今日数据"段并整段替换
    - 若未匹配,在正文顶部追加 `## 今日数据` 段
    - 调用现有 `update(supabase, userId, noteId, { content })` 落盘
    - 返回 `{ note, refreshed: true }`
  - [x] SubTask 3.3: 单元测试覆盖:writingAssist 三种 action 调用对应 Prompt、refreshDailyAggregation 替换/追加/无 daily 类型三种场景

- [x] Task 4: 笔记路由扩展
  - [x] SubTask 4.1: `api/routes/notes.ts` 新增端点:
    - POST `/api/notes/:id/writing-assist`(Body: `{ action, selectedText, contextBefore?, contextAfter? }`,返回 `{ suggestion, tokensUsed }`)
    - POST `/api/notes/:id/refresh-aggregation`(无 Body,返回 `{ note, refreshed }`)
  - [x] SubTask 4.2: 两端点均走 `aiHeavy` 限流(refresh-aggregation 虽不调 AI 但有数据库写入,用 write 限流更合适)
  - [x] SubTask 4.3: 路由级集成测试(可选,主要靠服务层单测)

- [x] Task 5: 语义搜索补全笔记
  - [x] SubTask 5.1: `api/services/ai/searchService.ts` 修改 `semanticSearch`:
    - 在现有 `Promise.all([match_knowledge_points, search_similar_graphs])` 中追加第三个并行 `match_notes`
    - 将 match_notes 返回映射为 `SearchNoteResult[]`(title/chunk_text 截断为 summary/similarity)
    - 写入返回对象的 `notes` 字段(替换当前的 `notes: []`)
  - [x] SubTask 5.2: 单元测试:semanticSearch 并行调用三 RPC、notes 字段非空、match_notes 失败时 notes=[] 不阻塞其他结果

### 第三组:前端 API 与 UI(依赖第二组)

- [x] Task 6: 前端 API 客户端扩展
  - [x] SubTask 6.1: `src/services/api/notes.ts` + `contracts/INotesApi.ts` 新增:
    - `writingAssist(noteId, data: WritingAssistRequest): Promise<WritingAssistResponse>`
    - `refreshDailyAggregation(noteId): Promise<RefreshDailyAggregationResponse>`
  - [x] SubTask 6.2: `src/services/api/search.ts` 的 `SearchResult` 类型新增 `notes?: SearchNoteResult[]` 字段(并新增 `SearchNoteResult` 类型,字段对齐后端: id/title/summary/type/updated_at/tags/similarity?)

- [x] Task 7: 写作辅助前端集成
  - [x] SubTask 7.1: 新增 `src/components/Notes/WritingAssistPopover.tsx`:
    - 浮层组件,接收 `suggestion: string`、`onAccept: () => void`、`onReject: () => void`、`isLoading: boolean`、`error?: string`、`anchorRect: DOMRect`(由 BlockEditor 通过 `editor.view.coordsAtPos(selection.to)` 计算并传入)
    - 用 `position: fixed` + `top/left = anchorRect.bottom/left` 定位,组件内 `useEffect` 监听 `window scroll` 与 `resize` 触发父组件重算坐标(对齐 `WikiLinkPopover.tsx` 实现风格)
    - 显示建议文本(只读 textarea/Markdown 预览)
    - 底部"采纳" + "放弃"按钮
    - 暗色模式 + i18n
  - [x] SubTask 7.2: `src/components/Notes/BlockEditorToolbar.tsx` 新增"写作辅助"按钮组(含三个子按钮或下拉菜单:续写/改写/扩写),仅在 `editor.state.selection` 非空且非折叠时启用;另新增"刷新今日数据"按钮(仅 daily type 显示)
  - [x] SubTask 7.3: `src/components/Notes/BlockEditor.tsx`:
    - 通过 `useEditor` 的 `onSelectionUpdate` 或 `editor.on("selectionUpdate")` 跟踪选区,向 toolbar 透传 `hasSelection` 与 `selectedText`、`contextBefore`、`contextAfter`
    - 写作辅助 mutation 成功后,在选区下方挂载 `WritingAssistPopover`(用 `editor.view.coordsAtPos(selection.to)` 计算 anchorRect 传入)
    - 采纳时:continue → 在选区后插入 suggestion;rewrite/expand → 替换选区为 suggestion;关闭 popover
    - 失败时:toast 提示
  - [x] SubTask 7.4: 刷新今日数据 mutation 成功后,用返回的 `note.content` 替换编辑器内容(`editor.commands.setContent(markdownToProsemirror(note.content))`),toast 提示"今日数据已刷新"

- [x] Task 8: 搜索结果 UI 补全
  - [x] SubTask 8.1: `src/components/common/SearchResults.tsx` 在 `results.nodes` 区块后、`results.answer` 区块前追加 `results.notes` 区块:
    - 区块标题:"笔记 {count}",用 `NotebookPen` 图标
    - 每项:标题 + 类型徽章(note/daily) + 摘要(line-clamp-2) + 标签 chips(复用 NotesListPage 的 TagChips 视觉)
    - 点击整行跳转 `/notes/:id`(用 `useNavigate`)
  - [x] SubTask 8.2: `hasResults` 判定追加 `|| results.notes?.length`
  - [x] SubTask 8.3: 空状态文案:当 graphs/nodes/notes 都为空时显示"未找到匹配的结果"(已有,仅修判定)
  - [x] SubTask 8.4: 暗色模式 + i18n(若 SearchResults 已有 i18n,补 notes 区块文案;若无,新增 search.notes.* 命名空间)

### 第四组:质量收口

- [x] Task 9: 国际化与质量收口
  - [x] SubTask 9.1: i18n 补充 notes.json 的 P2 key:
    - `notes.writingAssist.*`(button / continue / rewrite / expand / loading / accept / reject / error / popoverTitle)
    - `notes.refreshAggregation.*`(button / success / error)
    - `search.notes.*`(title / empty,若需独立命名空间)或在 notes.json 加 `notes.search.notesTitle`
  - [x] SubTask 9.2: zh-CN/en-US key 集合一致性验证
  - [x] SubTask 9.3: 运行 `npm run check` 与 `npm run lint` 通过
  - [x] SubTask 9.4: 代码规范扫描(无 any/!/console.*)

# Task Dependencies
- Task 2 依赖 Task 1
- Task 3 依赖 Task 1、Task 2
- Task 4 依赖 Task 3
- Task 5 独立(不依赖 Task 1-4,但依赖 P1 已存在的 match_notes RPC 与 note_embeddings 表)
- Task 6 依赖 Task 4、Task 5
- Task 7 依赖 Task 6
- Task 8 依赖 Task 6(search.ts 类型扩展)
- Task 9 贯穿最后收口

# 可并行任务
- Task 5(语义搜索补全,纯后端) 与 Task 3(写作辅助服务) 在 Task 1/2 完成后可并行
- Task 7(写作辅助 UI) 与 Task 8(搜索 UI) 在 Task 6 完成后可并行
