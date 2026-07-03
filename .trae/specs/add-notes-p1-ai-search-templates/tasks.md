# Tasks

## P1 任务清单

### 第一组:数据层与基础设施(其他组依赖)

- [x] Task 1: 笔记 Embedding 数据层
  - [x] SubTask 1.1: 新增 `supabase/migrations/33_notes_embedding.sql`:创建 `note_embeddings` 表(id, note_id FK, embedding vector(N), chunk_text text, created_at)+ 索引(note_id, vector ivfflat)+ RLS(通过 note_id JOIN notes 验证 user_id)
  - [x] SubTask 1.2: 触发器——笔记 content 更新时标记 embedding 待重生成(可在 notes 表加 `embedding_stale_at timestamptz` 字段,或由 service 层处理)
  - [x] SubTask 1.3: 后端 notesService 新增私有方法 `refreshEmbedding(noteId)`:调用 embeddingOps.generateEmbedding(content),UPSERT 到 note_embeddings;在 update 后异步调用(容错,失败仅 logger.warn)
  - [x] SubTask 1.4: 静态验证 schema(FK 引用 notes 在 32 已建)+ 头部注释提醒运行 db reset

- [x] Task 2: 共享类型扩展
  - [x] SubTask 2.1: 扩展 `shared/types/note.ts`:新增 NoteTemplate 的 CreateNoteTemplateInput、UpdateNoteTemplateInput、SetDefaultTemplateInput;GenerateDailySummaryRequest/Response、ExtractConceptsRequest/Response、CreateNoteFromConceptsRequest、UploadImageResponse 等 P1 类型
  - [x] SubTask 2.2: 导出至 shared/types/index.ts(若 P0 已导出 *,自动覆盖;若需显式 export 则补)

### 第二组:后端 AI 服务扩展

- [x] Task 3: 笔记 Prompt 模板与 AI 总结/反向建图服务
  - [x] SubTask 3.1: 在数据库 prompt_templates 表 seed 两个 Prompt:`notes_daily_summary`(System:你是学习总结助手,基于今日数据生成结构化反思总结)、`notes_extract_concepts`(System:从笔记提取知识点候选,返回 JSON {concepts:[{name, description, related:[]}]}),含变量占位
  - [x] SubTask 3.2: notesService 新增 `generateDailySummary(noteId)`:聚合今日数据(复用 getDailyAggregation)+ promptService.getRenderedPrompt("notes_daily_summary", {date, reviewedCards, completedTasks, focusTime, cardContents}) + aiService 调用 + 性能监控,返回总结文本
  - [x] SubTask 3.3: notesService 新增 `extractConcepts(noteId)`:读取笔记 content + promptService.getRenderedPrompt("notes_extract_concepts", {content}) + aiService 调用(要求 JSON 输出)+ 性能监控,返回候选知识点列表
  - [x] SubTask 3.4: notesService 新增 `createNodesFromConcepts(noteId, graphId, selectedConcepts[])`:对每个选中知识点在 graphId 创建 knowledge_point + graph_node,自动建立 note_node_links(新节点↔本笔记),返回创建结果

- [x] Task 4: 笔记路由扩展(AI + 模板 + 图片)
  - [x] SubTask 4.1: `api/routes/notes.ts` 新增端点:
    - GET/POST/PUT/DELETE `/api/notes/templates`(模板 CRUD,DELETE 校验 is_system=false)
    - POST `/api/notes/templates/:id/set-default`
    - POST `/api/notes/:id/summary`(生成今日总结,返回总结文本)
    - POST `/api/notes/:id/extract-concepts`(返回候选知识点)
    - POST `/api/notes/:id/create-nodes`(确认建图,Body:graphId + selectedConcepts[])
    - POST `/api/notes/:id/upload-image`(multipart 文件,返回 url)
  - [x] SubTask 4.2: 限流:AI 端点用 aiHeavy 限流,图片上传用 write 限流
  - [x] SubTask 4.3: 后端单元测试:templates CRUD、set-default 唯一性、is_system 不可删、extractConcepts JSON 解析容错

- [x] Task 5: RAG 与搜索扩展纳入笔记
  - [x] SubTask 5.1: 扩展 `api/services/ai/ragSearchService.ts`:新增数据源类型 "note",查询 note_embeddings 表做向量检索,返回笔记片段
  - [x] SubTask 5.2: 扩展 `api/services/ai/ragService.ts`:RAG 检索时并行查 notes embedding + graph document_chunks,合并排序(rerankingService)
  - [x] SubTask 5.3: 扩展 `api/routes/search.ts`:全局搜索新增 "notes" 类型结果(标题/摘要/链接)
  - [x] SubTask 5.4: 扩展 `api/routes/rag.ts`:图谱问答时,通过 note_node_links 查当前节点(及相关节点)挂载的笔记,纳入上下文
  - [x] SubTask 5.5: 单元测试:笔记 embedding 命中检索、RAG 上下文含笔记内容

### 第三组:前端 API 与 UI(依赖第二组)

- [x] Task 6: 前端 API 客户端扩展
  - [x] SubTask 6.1: `src/services/api/notes.ts` + `contracts/INotesApi.ts` 新增方法:listTemplates/createTemplate/updateTemplate/deleteTemplate/setDefaultTemplate/generateDailySummary/extractConcepts/createNodesFromConcepts/uploadImage
  - [x] SubTask 6.2: 注册到 api 对象(若 P0 已注册 notesApi 则仅扩展方法)

- [x] Task 7: 块编辑器工具栏 AI 按钮
  - [x] SubTask 7.1: `src/components/Notes/BlockEditorToolbar.tsx` 新增按钮:"生成今日总结"(仅 daily type 显示)、"提取要点建图"
  - [x] SubTask 7.2: 调用 generateDailySummary mutation,成功后插入总结到"今日反思"段(用 editor.commands.insertContent)
  - [x] SubTask 7.3: 调用 extractConcepts mutation,成功后弹出 ExtractConceptsDialog
  - [x] SubTask 7.4: ExtractConceptsDialog 确认后调用 createNodesFromConcepts mutation,成功后 toast 提示 + 失效图谱查询缓存

- [x] Task 8: 反向建图对话框组件
  - [x] SubTask 8.1: 新增 `src/components/Notes/ExtractConceptsDialog.tsx`:展示候选知识点列表(勾选)、目标图谱选择器(graphsApi.list)、确认/取消
  - [x] SubTask 8.2: 确认后调用 createNodesFromConcepts,处理 loading/error 状态
  - [x] SubTask 8.3: 暗色模式 + i18n

- [x] Task 9: 图片上传集成
  - [x] SubTask 9.1: `src/components/Notes/BlockEditor.tsx` 集成图片粘贴/拖拽/选择:监听 paste/drop 事件,调用 uploadImage,插入 `![](url)`
  - [x] SubTask 9.2: 工具栏新增"插入图片"按钮(可选,若已有粘贴/拖拽足够则跳过)
  - [x] SubTask 9.3: 上传中显示进度/loading

- [x] Task 10: 笔记列表本地筛选
  - [x] SubTask 10.1: `src/pages/Notes/NotesListPage.tsx` 顶部新增搜索框,客户端按标题过滤(useMemo + useState)
  - [x] SubTask 10.2: 列表项标签点击触发标签筛选(setState filterTag,客户端过滤)
  - [x] SubTask 10.3: 与视图切换(Daily/普通等)叠加生效

- [x] Task 11: 模板管理页
  - [x] SubTask 11.1: 新增 `src/pages/Notes/TemplatesPage.tsx`:模板列表(系统模板+自定义)、新建/编辑/删除/设为默认
  - [x] SubTask 11.2: 模板编辑用 BlockEditor 或简化版 textarea(支持变量占位提示)
  - [x] SubTask 11.3: 路由 `/notes/templates`,注册到 notesPlugin(在 Task 6 的 P0 plugin 中扩展)
  - [x] SubTask 11.4: 暗色模式 + i18n

### 第四组:质量收口

- [x] Task 12: 国际化与质量收口
  - [x] SubTask 12.1: i18n 补充 notes.json 的 P1 key:templates.*、ai.summary.*、ai.extractConcepts.*、ai.createNodes.*、image.*、search.*
  - [x] SubTask 12.2: zh-CN/en-US key 集合一致性验证
  - [x] SubTask 12.3: 运行 `npm run check` 与 `npm run lint` 通过
  - [x] SubTask 12.4: 代码规范扫描(无 any/!/console.*)

# Task Dependencies
- Task 2 依赖 Task 1
- Task 3 依赖 Task 1、Task 2
- Task 4 依赖 Task 3
- Task 5 依赖 Task 1、Task 2、Task 3(embedding 服务已建)
- Task 6 依赖 Task 4、Task 5
- Task 7 依赖 Task 6
- Task 8 依赖 Task 6、Task 7
- Task 9 依赖 Task 6
- Task 10 依赖 Task 6(前端 API 已扩展即可,但本地筛选不依赖后端,可与 Task 7-9 并行)
- Task 11 依赖 Task 6
- Task 12 贯穿最后收口

# 可并行任务
- Task 5(RAG/搜索扩展) 与 Task 4(笔记路由扩展) 在 Task 3 完成后可并行
- Task 10(列表筛选,纯前端) 与 Task 7/8/9 在 Task 6 完成后可并行
- Task 11(模板管理页) 与 Task 7/8/9 在 Task 6 完成后可并行
