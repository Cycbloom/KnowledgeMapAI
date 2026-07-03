# P2 验收检查清单

## 数据库与 Prompt
- [x] `54_seed_prompt_writing_assist.sql` 已创建,seed 三个 Prompt(notes_writing_continue / notes_writing_rewrite / notes_writing_expand)
- [x] 三个 Prompt 含变量占位 `{{selectedText}}` / `{{contextBefore}}` / `{{contextAfter}}`
- [x] 文件头注释提醒运行 `npx supabase db reset`

## 共享类型
- [x] `shared/types/note.ts` 已扩展 P2 类型(WritingAssistAction / WritingAssistRequest / WritingAssistResponse / RefreshDailyAggregationResponse)
- [x] 类型导出完整,无 any

## 后端服务
- [x] notesService.writingAssist 实现:读取笔记 + promptService.getRenderedPrompt + aiService.chat + performanceMonitor
- [x] writingAssist 三种 action 对应三个 Prompt code
- [x] notesService.refreshDailyAggregation 实现:校验 type="daily" + 调用 getDailyAggregation + 定位"## 今日数据"段整段替换 / 缺失时追加 + 落盘
- [x] refreshDailyAggregation 不影响其他段(今日学习/今日复习/今日反思)
- [x] 单元测试覆盖:writingAssist 三 action、refreshDailyAggregation 三场景(替换/追加/非 daily 报错)

## 后端路由扩展
- [x] POST `/api/notes/:id/writing-assist` 实现
- [x] POST `/api/notes/:id/refresh-aggregation` 实现
- [x] 写作辅助端点走 aiHeavy 限流,刷新聚合走 write 限流
- [x] 端点响应符合 contracts 类型

## 语义搜索补全
- [x] searchService.semanticSearch 并行调用 match_notes RPC
- [x] match_notes 返回映射为 SearchNoteResult[] (title / chunk_text→summary / similarity)
- [x] 返回 SemanticSearchResult.notes 非空(命中时)
- [x] match_notes 失败不阻塞 graphs/nodes 结果(notes=[] 兜底)
- [x] 单元测试覆盖

## 前端 API 客户端
- [x] notesApi.writingAssist(noteId, data) 实现
- [x] notesApi.refreshDailyAggregation(noteId) 实现
- [x] searchApi.SearchResult 类型新增 notes?: SearchNoteResult[] 字段
- [x] 命名遵循 api-naming-conventions

## 写作辅助前端
- [x] WritingAssistPopover 组件实现(suggestion / 采纳 / 放弃 / loading / error / anchorRect 定位 + scroll 监听)
- [x] BlockEditorToolbar 新增"写作辅助"按钮组(续写/改写/扩写),仅 hasSelection 时启用
- [x] BlockEditorToolbar 新增"刷新今日数据"按钮,仅 daily type 显示
- [x] BlockEditor 跟踪选区,透传 hasSelection / selectedText / contextBefore / contextAfter 给 toolbar
- [x] 写作辅助 mutation 成功后,在选区下方挂载 WritingAssistPopover
- [x] 采纳时:continue→追加,rewrite/expand→替换,关闭 popover
- [x] 刷新今日数据成功后,用 note.content 替换编辑器内容
- [x] 暗色模式 + i18n

## 搜索结果 UI
- [x] SearchResults 组件渲染 notes 类别区块(在 nodes 后、answer 前)
- [x] notes 区块标题"笔记 {count}" + NotebookPen 图标
- [x] 每项显示标题/类型徽章/摘要/标签
- [x] 点击整行跳转 /notes/:id
- [x] hasResults 判定追加 results.notes?.length
- [x] 暗色模式 + i18n

## 国际化与质量
- [x] notes.json 补充 P2 key:writingAssist.* / refreshAggregation.* / search.notesTitle
- [x] zh-CN / en-US key 集合一致
- [x] 无 any 类型、无非空断言 !
- [x] 前端无 console.log/info,后端无 console.*
- [x] `npm run check` 通过
- [x] `npm run lint` 通过
