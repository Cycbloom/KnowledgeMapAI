# P1 验收检查清单

## 数据层与 Embedding
- [x] `note_embeddings` 表已创建(id/note_id/embedding vector/chunk_text/created_at)
- [x] note_id 外键引用 notes,on delete cascade
- [x] vector 字段建立 ivfflat 索引(余弦距离)
- [x] RLS 启用,通过 note_id JOIN notes 验证 user_id
- [x] 笔记 content 更新时 embedding 异步刷新(容错,失败不阻塞保存)
- [x] 静态校验 schema,FK 引用 notes(32_notes.sql)正确
- [x] 文件头注释提醒运行 `npx supabase db reset`

## 共享类型
- [x] `shared/types/note.ts` 已扩展 P1 类型(Template Input、AI 总结/反向建图、图片上传)
- [x] 类型导出完整,无 any

## 后端 Prompt 与 AI 服务
- [x] `prompt_templates` 表已 seed 两个 Prompt:notes_daily_summary、notes_extract_concepts
- [x] Prompt 含变量占位,通过 promptService.getRenderedPrompt 读取
- [x] notesService.generateDailySummary 聚合今日数据 + AI 调用 + 性能监控
- [x] notesService.extractConcepts 返回候选知识点(JSON 解析容错)
- [x] notesService.createNodesFromConcepts 创建节点 + 自动建立 note_node_links
- [x] AI 调用复用 aiService/chatService,记录 performanceMonitor

## 后端路由扩展
- [x] `/api/notes/templates` GET/POST/PUT/DELETE 实现
- [x] DELETE 校验 is_system=false(系统模板不可删)
- [x] POST `/api/notes/templates/:id/set-default` 实现,同时只能一个默认
- [x] POST `/api/notes/:id/summary` 生成今日总结
- [x] POST `/api/notes/:id/extract-concepts` 提取候选
- [x] POST `/api/notes/:id/create-nodes` 确认建图
- [x] POST `/api/notes/:id/upload-image` 图片上传
- [x] AI 端点用 aiHeavy 限流,图片上传用 write 限流
- [x] 单元测试覆盖 templates CRUD、set-default 唯一性、is_system 不可删、JSON 解析容错

## RAG 与搜索扩展
- [x] ragSearchService 新增 "note" 数据源,查 note_embeddings
- [x] ragService RAG 检索并行查 notes + graph,合并 rerankingService 排序
- [x] `/api/search` 全局搜索返回 notes 类型结果
- [x] `/api/rag` 图谱问答通过 note_node_links 查挂载笔记纳入上下文
- [x] 单元测试:笔记 embedding 命中检索、上下文含笔记内容

## 前端 API 客户端
- [x] notesApi 新增方法:listTemplates/createTemplate/updateTemplate/deleteTemplate/setDefaultTemplate
- [x] notesApi 新增方法:generateDailySummary/extractConcepts/createNodesFromConcepts/uploadImage
- [x] 命名遵循 api-naming-conventions

## 块编辑器工具栏
- [x] "生成今日总结"按钮(仅 daily type 显示)
- [x] 点击后调用 generateDailySummary,成功插入总结到"今日反思"段
- [x] "提取要点建图"按钮
- [x] 点击后调用 extractConcepts,成功弹出 ExtractConceptsDialog
- [x] 暗色模式 + i18n

## 反向建图对话框
- [x] ExtractConceptsDialog 展示候选知识点列表(勾选)
- [x] 目标图谱选择器(graphsApi.list)
- [x] 确认后调用 createNodesFromConcepts,loading/error 状态
- [x] 成功后 toast 提示 + 失效图谱查询缓存
- [x] 暗色模式 + i18n

## 图片上传
- [x] BlockEditor 监听 paste/drop 事件,调用 uploadImage,插入 ![](url)
- [x] 工具栏"插入图片"按钮(若有)
- [x] 上传中显示进度/loading
- [x] 外链图片直接插入不下载

## 笔记列表本地筛选
- [x] 顶部搜索框客户端按标题过滤
- [x] 列表项标签点击触发标签筛选
- [x] 与视图切换(Daily/普通等)叠加生效
- [x] 暗色模式

## 模板管理页
- [x] `/notes/templates` 路由可访问
- [x] 模板列表(系统模板 + 自定义)
- [x] 新建/编辑/删除/设为默认
- [x] 系统模板不可删(按钮禁用或隐藏)
- [x] 模板编辑支持变量占位提示
- [x] 暗色模式 + i18n

## 国际化与质量
- [x] notes.json 补充 P1 key:templates.* / ai.summary.* / ai.extractConcepts.* / ai.createNodes.* / image.* / search.*
- [x] zh-CN / en-US key 集合一致
- [x] 无 any 类型、无非空断言 !
- [x] 前端无 console.log/info,后端无 console.*
- [x] `npm run check` 通过
- [x] `npm run lint` 通过
