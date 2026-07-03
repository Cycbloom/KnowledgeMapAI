# Tasks

## P0 MVP 任务清单

- [x] Task 1: 数据库 schema 设计与迁移
  - [x] SubTask 1.1: 新增 `supabase/migrations/31_notes.sql`,定义 `notes`、`note_node_links`、`note_templates` 三张表(含 RLS、唯一约束、软删除字段、索引)
  - [x] SubTask 1.2: 添加必要触发器(updated_at 自动更新、daily 唯一约束校验)
  - [x] SubTask 1.3: 运行 `npm run db:gen-types` 重新生成 `shared/types/database.generated.ts`
  - [x] SubTask 1.4: 本地 `npx supabase db reset` 验证 schema 无误

- [x] Task 2: 共享类型定义
  - [x] SubTask 2.1: 新增 `shared/types/note.ts`,定义 Note、NoteNodeLink、NoteTemplate、CreateNoteInput、UpdateNoteInput 等类型,导出至 `shared/types/index.ts`
  - [x] SubTask 2.2: 扩展 `shared/utils/wikiLink.ts`(如需),支持笔记正文中 wiki 链接解析与节点重命名同步辅助函数

- [x] Task 3: 后端笔记服务与路由
  - [x] SubTask 3.1: 新增 `api/services/notes/notesService.ts`:笔记 CRUD、挂载关系同步(wiki 链接即挂载)、Daily 自动创建、模板渲染(4 个聚合变量)、聚合数据查询(复习卡数/完成任务/专注时长)
  - [x] SubTask 3.2: 新增 `api/routes/notes.ts`:RESTful 路由(list/get/create/update/delete + daily auto-create + templates CRUD)
  - [x] SubTask 3.3: 在 Kernel 插件系统注册 notes 路由(新增 NotesPlugin 或挂到 CorePlugin)
  - [x] SubTask 3.4: 后端单元测试覆盖挂载关系同步、daily 唯一约束、聚合变量渲染

- [x] Task 4: 节点重命名同步扩展
  - [x] SubTask 4.1: 扩展 `api/services/graph/backlinkService.ts`,在节点重命名时同步更新所有引用该节点的笔记正文 `[[旧名]]` → `[[新名]]`
  - [x] SubTask 4.2: 端到端验证:重命名节点后,笔记正文 wiki 链接同步更新

- [x] Task 5: 前端 API 客户端
  - [x] SubTask 5.1: 新增 `src/services/api/notes.ts`:对接后端 notesApi(list/get/create/update/delete/getOrCreateTodayDaily/listTemplates),按 api-naming-conventions 命名
  - [x] SubTask 5.2: 注册到 `src/services/api/index.ts` 的 api 对象

- [x] Task 6: 笔记列表页(`/notes`)
  - [x] SubTask 6.1: 新增 `src/pages/Notes/NotesListPage.tsx`:列表(按 updated_at 倒序、置顶优先)、视图切换(全部/Daily/普通/收藏/归档)、新建按钮(普通/Daily)、置顶/归档/删除操作、标签(复用 TagSystem)
  - [x] SubTask 6.2: 列表项显示标题、类型徽章、更新时间、标签、挂载节点数
  - [x] SubTask 6.3: 新增 `src/services/kernel/plugins.ts` 中的 notes 插件(注册 `/notes` 路由 + 主导航项)
  - [x] SubTask 6.4: 接入 Layout 主导航,确认入口可见

- [x] Task 7: 块编辑器组件
  - [x] SubTask 7.1: 新增 `src/components/Notes/BlockEditor.tsx`:基于 TipTap(ProseMirror)实现块编辑器(与 react-markdown 共存)
  - [x] SubTask 7.2: 实现 12 种块类型渲染与编辑(段落/H1-H3/无序/有序/待办/引用/代码块/分割线/图片/表格)
  - [x] SubTask 7.3: 实现斜杠命令 `/` 唤起块菜单
  - [x] SubTask 7.4: 实现 Markdown 快捷输入(StarterKit inputRule 提供行首 `#`/`-`/`>` 等)
  - [x] SubTask 7.5: 实现 wiki 链接 `[[` 自动补全(调用 knowledgePointsApi 拉取节点标题)与渲染为可点击跳转
  - [x] SubTask 7.6: 实现块拖拽排序(降级方案:块上下移动按钮,通过 ProseMirror Transaction 交换顶层节点)
  - [x] SubTask 7.7: 实现自动保存(失焦 + 3 秒 debounce)与撤销/重做(StarterKit UndoRedo 扩展 Ctrl+Z / Ctrl+Shift+Z)
  - [x] SubTask 7.8: 适配暗色模式(Tailwind dark: 变体全覆盖)
  - [x] SubTask 7.9: 复用 `src/utils/wikiLinkRemarkPlugin.tsx` 与 `preprocessWikiLinks` 渲染 wiki 链接(markdownSerializer 双向转换 `[[节点名]]` ↔ `wiki://节点名`)

- [x] Task 8: 笔记编辑器页
  - [x] SubTask 8.1: 新增 `src/pages/Notes/NoteEditorPage.tsx`:加载笔记、嵌入 BlockEditor、标题编辑、保存反馈、软删除入口
  - [x] SubTask 8.2: 路由 `/notes/:noteId`,注册到 notes 插件
  - [x] SubTask 8.3: 编辑器自动保存成功后更新列表(查询失效)

- [x] Task 9: Daily Notes 自动创建流程
  - [x] SubTask 9.1: 进入 `/notes` 时调用 getOrCreateTodayDaily,若不存在则后端自动创建(系统默认三段式模板)
  - [x] SubTask 9.2: 自动创建后跳转到当日 daily note 编辑器
  - [x] SubTask 9.3: 验证聚合数据(复习卡数/完成任务/专注时长)写入静态快照

- [x] Task 10: 节点详情"关联笔记"面板
  - [x] SubTask 10.1: 新增 `src/components/Notes/NotesPanel.tsx`(参考 BacklinksPanel 模式),列出挂载到当前节点的笔记
  - [x] SubTask 10.2: 在节点详情侧边栏集成 NotesPanel
  - [x] SubTask 10.3: 点击关联笔记跳转到 `/notes/:noteId`
  - [x] SubTask 10.4: 后端新增"按 node_id 查询笔记"接口(若 notesService.list 不支持,扩展 filter)

- [x] Task 11: 软删除接入回收站
  - [x] SubTask 11.1: 在现有 RecycleBin 页面新增"笔记"分类,展示已软删除笔记
  - [x] SubTask 11.2: 支持笔记恢复(恢复时提示挂载关系不自动恢复)
  - [x] SubTask 11.3: 支持笔记彻底删除

- [x] Task 12: 国际化与类型检查
  - [x] SubTask 12.1: 新增 `notes` 命名空间 zh-CN/en-US 翻译(标题、视图、操作、空状态等)
  - [x] SubTask 12.2: 接入 EmptyState、Skeleton 等现有 UX 组件(参考 UX 微改进规范)
  - [x] SubTask 12.3: 运行 `npm run check` 与 `npm run lint` 通过

- [x] Task 13: 修复 notesService 单元测试失败(验证发现)
  - [x] SubTask 13.1: 修复 getOrCreateTodayDaily 兜底模板缺失三段式标题(今日学习/今日复习/今日反思)
  - [x] SubTask 13.2: 修复 getOrCreateTodayDaily 测试中 insertedRow.date 断言失败
  - [x] SubTask 13.3: 重跑 `npx vitest run api/__tests__/services/notesService.test.ts` 全部通过

# Task Dependencies
- Task 2 依赖 Task 1(类型基于 schema)
- Task 3 依赖 Task 1、Task 2
- Task 4 依赖 Task 3(扩展 backlinkService 需 notesService 已建立挂载关系)
- Task 5 依赖 Task 3
- Task 6 依赖 Task 5
- Task 7 依赖 Task 5
- Task 8 依赖 Task 7、Task 5
- Task 9 依赖 Task 8、Task 3(后端 daily auto-create)
- Task 10 依赖 Task 5、Task 3(按 node_id 查询)
- Task 11 依赖 Task 6
- Task 12 贯穿全程,最后统一收口

# 可并行任务
- Task 6(列表页) 与 Task 7(块编辑器) 在 Task 5 完成后可并行
- Task 10(关联笔记面板) 在 Task 5 完成后可与 Task 6/7/8 并行
- Task 11(回收站) 在 Task 6 完成后可与 Task 8/9 并行
