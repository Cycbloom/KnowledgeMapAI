# Notes P2 (写作辅助 / 动态刷新 / 语义检索补全) Spec

## Why
P0/P1 已交付笔记基础结构、块编辑器、AI 总结/反向建图、模板 CRUD、图片上传、关键词搜索的 notes 命中。但 PRD `PRD-Block-Editor-Daily-Notes.md` 的 P2 阶段仍剩三项增量未做:
1. **写作辅助(M6.3)**——选中文本续写/改写/扩写,笔记缺乏"AI 辅助长文产出"能力
2. **模板动态刷新聚合数据(M3.7)**——Daily Note 的"今日数据"区是创建时静态快照,用户无法在一天中刷新最新统计
3. **笔记 embedding 纳入语义检索(M5.3 FR-M5-8)——P1 遗漏补全**:虽然 `note_embeddings` 表与 `match_notes` RPC 已存在,但 `searchService.semanticSearch` 未调用它,前端 `SearchResults` 也不渲染 notes 类别,导致语义搜索完全找不到笔记

本 spec 补齐这三项,完成 PRD P2 阶段。

## What Changes
- **写作辅助**:笔记工具栏新增"续写/改写/扩写"三选项(仅在选中文本时启用);AI 返回建议文本以 diff/建议气泡形式浮层呈现,用户确认后替换选区或追加到选区后;复用 aiService + performanceMonitor + promptService 三层 Prompt 管理
- **Daily 数据动态刷新**:Daily Note 编辑器工具栏新增"刷新今日数据"按钮(仅 daily type 显示);后端新增 `refreshDailyAggregation(noteId)` 服务方法,重新查询今日复习/任务/专注统计,定位正文中的 `## 今日数据` 段并整段替换为新数据,不影响其他区域
- **笔记语义检索补全**:
  - 后端 `searchService.semanticSearch` 并行调用 `match_notes` RPC,将笔记向量命中合并进 `SemanticSearchResult.notes`
  - 前端 `searchApi.SearchResult` 类型新增 `notes: SearchNoteResult[]` 字段
  - 前端 `SearchResults` 组件渲染 notes 类别(标题/摘要/类型徽章/标签),点击跳转 `/notes/:id`
- **BREAKING**:无(纯新增 + 扩展,不破坏既有 API 契约;`SearchResult` 类型新增可选字段,旧调用方无需变更)

## Impact
- **Affected specs**:
  - `add-notes-block-editor-daily`(P0 笔记基础)
  - `add-notes-p1-ai-search-templates`(P1 AI/搜索/模板/图片)
  本 spec 为这两份的后续阶段,共享同一套笔记数据模型与 notesApi
- **Affected code**:
  - 数据库:`supabase/migrations/54_seed_prompt_writing_assist.sql`(新增 Prompt seed:notes_writing_continue / notes_writing_rewrite / notes_writing_expand)
  - 共享类型:`shared/types/note.ts`(新增 WritingAssistAction、WritingAssistRequest、WritingAssistResponse、RefreshDailyAggregationResponse 类型)
  - 后端:
    - `api/services/notes/notesService.ts`(新增 writingAssist、refreshDailyAggregation 方法)
    - `api/routes/notes.ts`(新增 POST `/notes/:id/writing-assist`、POST `/notes/:id/refresh-aggregation` 端点,均走 aiHeavy 限流)
    - `api/services/ai/searchService.ts`(semanticSearch 并行调用 match_notes)
  - 前端:
    - `src/services/api/notes.ts` + `contracts/INotesApi.ts`(新增 writingAssist、refreshDailyAggregation 方法)
    - `src/services/api/search.ts`(SearchResult 类型新增 notes 字段)
    - `src/hooks/mutations/useNoteMutations.ts`(新增 useWritingAssistMutation、useRefreshDailyAggregationMutation)
    - `src/components/Notes/BlockEditorToolbar.tsx`(新增"写作辅助"按钮组与"刷新今日数据"按钮)
    - `src/components/Notes/WritingAssistPopover.tsx`(新增:建议气泡浮层,用 `editor.view.coordsAtPos(selection.to)` 取绝对坐标 + `position: fixed` 定位 + scroll 监听重算,对齐现有 `WikiLinkPopover.tsx` 实现风格,不引入新依赖)
    - `src/components/Notes/BlockEditor.tsx`(集成选区监听 + WritingAssistPopover 触发)
    - `src/components/common/SearchResults.tsx`(渲染 notes 类别)
  - 复用资产:`promptService`、`aiService`、`performanceMonitor`、`pricingService`、`parseAIResponse`、`match_notes` RPC、现有 Daily 聚合查询(`getDailyAggregation`)、现有 BlockEditor 选区 API(`editor.state.selection`)

## ADDED Requirements

### Requirement: 写作辅助(续写/改写/扩写)
系统 SHALL 在笔记块编辑器中,当用户选中文本时,提供"续写/改写/扩写"三种 AI 写作辅助操作,返回建议文本以建议气泡形式呈现,用户确认后替换选区或追加到选区后。

#### Scenario: 选中文本唤起写作辅助
- **WHEN** 用户在笔记中选中一段文字
- **THEN** 工具栏"写作辅助"按钮变为可点击(未选中时禁用)
- **AND** 点击后弹出三个选项:续写 / 改写 / 扩写

#### Scenario: 续写
- **WHEN** 用户选中文字并点击"续写"
- **THEN** AI 基于选中文本与上下文续写后续内容
- **AND** 建议文本以建议气泡形式浮在选区下方
- **AND** 用户可"采纳"将建议追加到选区后,或"放弃"关闭气泡

#### Scenario: 改写
- **WHEN** 用户选中文字并点击"改写"
- **THEN** AI 改写选中文字(保持原意,优化表达)
- **AND** 建议气泡显示改写结果,用户"采纳"后替换选区

#### Scenario: 扩写
- **WHEN** 用户选中文字并点击"扩写"
- **THEN** AI 扩充选中文字(添加细节、举例、论证)
- **AND** 建议气泡显示扩写结果,用户"采纳"后替换选区

#### Scenario: 采纳即落盘
- **WHEN** 用户点击"采纳"将 suggestion 写入编辑器
- **THEN** BlockEditor 立即触发自动保存(失焦/3 秒 debounce 节奏的立即版本)
- **AND** 保存成功后 toast 提示"已保存"
- **AND** 保存失败时 toast 提示"保存失败",但 suggestion 已写入编辑器(用户可手动重试)

#### Scenario: 性能与 Prompt 管理
- **WHEN** 任意写作辅助操作执行
- **THEN** 使用 promptService 读取对应 Prompt(notes_writing_continue / notes_writing_rewrite / notes_writing_expand)
- **AND** 调用 performanceMonitor 记录 token 用量与时长
- **AND** 失败时返回错误,前端 toast 提示

### Requirement: Daily Note 数据动态刷新
系统 SHALL 在 Daily Note 编辑器工具栏提供"刷新今日数据"按钮(仅 daily type 显示),点击后重新查询当日复习/任务/专注统计,定位正文中的"## 今日数据"段并整段替换为新数据快照,不影响其他区域内容。

#### Scenario: 刷新今日数据
- **WHEN** 用户在 Daily Note 点击"刷新今日数据"
- **THEN** 后端重新查询当日聚合数据(复习卡数/完成任务/专注时长)
- **AND** 定位正文中的 `## 今日数据` 段(到下一个 `## ` 二级标题为止)
- **AND** 整段替换为新数据,保留 `## 今日数据` 标题
- **AND** 不影响其他段(今日学习/今日复习/今日反思)内容
- **AND** 返回更新后的笔记对象,前端用新 content 替换编辑器内容

#### Scenario: 模板缺失今日数据段
- **WHEN** 用户自定义模板未含 `## 今日数据` 段
- **THEN** 在正文顶部追加 `## 今日数据` 段及聚合数据,不修改其他内容

#### Scenario: 后端聚合查询失败
- **WHEN** 后端 `getDailyAggregation` 查询失败(如 study_progress 表不可用)
- **THEN** 接口返回 500 错误
- **AND** 前端 toast 提示"刷新失败"
- **AND** 编辑器内容保持原状(不调用 update,不落盘)

### Requirement: 笔记语义检索补全
系统 SHALL 在全局语义搜索时,通过 `match_notes` RPC 检索笔记 embedding 命中,与图谱节点/图谱结果并列返回;前端 `SearchResults` 组件渲染 notes 类别,点击跳转 `/notes/:id`。

#### Scenario: 语义搜索命中笔记
- **WHEN** 用户在全局搜索选择"语义"模式输入查询
- **THEN** 后端 `semanticSearch` 并行调用 `match_knowledge_points`、`search_similar_graphs`、`match_notes` 三个 RPC
- **AND** 返回结果含 `notes: SearchNoteResult[]`(标题/摘要/similarity)
- **AND** 前端 `SearchResults` 渲染 notes 类别区块(在 nodes 之后,answer 之前)

#### Scenario: 关键词搜索与语义搜索都覆盖笔记
- **WHEN** 用户切换 keyword / semantic 模式
- **THEN** 两种模式都返回 notes 结果(keyword 走 LIKE,semantic 走向量)
- **AND** notes 类别区块标题显示"笔记 {count}"

#### Scenario: 点击笔记结果跳转
- **WHEN** 用户点击 notes 类别中的某条
- **THEN** 跳转到 `/notes/:noteId` 编辑器

## MODIFIED Requirements

### Requirement: 全局搜索结果类型
(P1 已实现 keyword 模式返回 notes,但 semantic 模式遗漏且前端未渲染。本 spec 修正:)

系统 SHALL 在 keyword 与 semantic 两种搜索模式下,都返回 `notes: SearchNoteResult[]`,前端 `SearchResults` 渲染 notes 类别区块。

## REMOVED Requirements
(无)
