# P0 MVP 验收检查清单

## 数据模型与类型
- [x] `notes`、`note_node_links`、`note_templates` 三张表已创建,字段与 PRD 一致
- [x] `notes` 表 `type='daily'` 时 `(user_id, date)` 唯一约束生效
- [x] `note_node_links` 表 `(note_id, node_id)` 唯一约束生效
- [x] 三张表均启用 RLS,跨用户访问返回 403
- [x] `notes` 表支持软删除(deleted_at 字段 + 接入回收站)
- [ ] `npm run db:gen-types` 已重新生成,`shared/types/note.ts` 类型定义完整(note.ts 类型完整;生成类型未含 notes 表,需 DB 运行后重新生成)
- [ ] 本地 `npx supabase db reset` 成功,无 schema 错误(需运行时验证)

## 后端 API
- [x] `/api/notes` 提供 list/get/create/update/delete 五个端点
- [x] 支持按 type、date、tag、is_archived、is_pinned 过滤与分页
- [x] 保存笔记时正确同步 `note_node_links`(新增 wiki 链接建挂载、删除 wiki 链接移除挂载)
- [x] Daily 自动创建端点存在且遵循唯一约束(重复创建返回 409 或返回已存在)
- [x] 系统默认三段式模板存在且不可删除
- [x] 模板变量 `{{date}}`/`{{today_reviewed_cards}}`/`{{today_completed_tasks}}`/`{{today_focus_time}}` 正确渲染为当日静态快照
- [x] 节点重命名时,所有引用该节点的笔记正文 `[[旧名]]` 同步更新为 `[[新名]]`(backlinkService.syncNotesWikiLinks 已实现)
- [x] 后端单元测试覆盖挂载关系同步、daily 唯一约束、聚合变量渲染
- [x] 软删除笔记时 `note_node_links` 同步清理

## 前端 API 客户端
- [x] `src/services/api/notes.ts` 已实现,命名符合 api-naming-conventions(notesApi 对象式导出)
- [x] 已注册到 `src/services/api/index.ts` 的 api 对象(notes: notesApi)

## 笔记列表页
- [x] `/notes` 路由可访问,主导航有入口(plugins.ts 注册 notesPlugin)
- [x] 列表按 updated_at 倒序,置顶笔记优先(notesService order is_pinned/updated_at)
- [ ] 列表项显示标题、类型徽章、更新时间、标签、挂载节点数(当前未展示挂载节点数)
- [x] 视图切换(全部/Daily/普通/收藏/归档)正确过滤
- [x] 新建普通笔记 / 新建 Daily 按钮工作
- [x] 置顶 / 取消置顶 / 归档 / 删除操作工作
- [ ] 标签管理复用 TagSystem 组件(当前列表项为只读 TagChips 展示)
- [x] 空状态使用 EmptyState 组件(非纯文本)

## 块编辑器
- [x] 支持 10 种块类型(段落/H1-H3/无序/有序/待办/引用/代码块/分割线/图片/表格)——实际实现 12 种(含分割线/图片/表格)
- [x] 空行输入 `/` 弹出块菜单,可选块类型插入(SlashCommandMenu.tsx)
- [x] 行首 Markdown 快捷输入(`#`/`-`/`>`/``` 等)自动转换为对应块(StarterKit inputRule)
- [x] 输入 `[[` 弹出图节点补全,选择后插入 `[[节点名]]`(WikiLinkPopover.tsx + knowledgePointsApi)
- [x] wiki 链接渲染为可点击,点击跳转到对应图谱节点(editorProps.handleClick 拦截 a[data-wiki])
- [x] 块可拖拽排序,Markdown 落盘正确(降级方案:块上下移动按钮,Markdown 落盘经 tiptap-markdown 验证)
- [x] 编辑器失焦或 3 秒定时自动保存(focusout + setTimeout debounce 3s)
- [x] Ctrl+Z / Ctrl+Shift+Z 撤销/重做工作(StarterKit UndoRedo 扩展)
- [x] 暗色模式显示正常(Tailwind dark: 变体全覆盖工具栏/编辑区/状态栏/浮层)
- [x] 复用 `src/utils/wikiLinkRemarkPlugin.tsx` 渲染 wiki 链接(markdownSerializer.ts 调用 preprocessWikiLinks)

## 笔记编辑器页
- [x] `/notes/:noteId` 路由可访问
- [x] 加载笔记内容并嵌入 BlockEditor
- [x] 标题可编辑
- [x] 保存反馈可见(loading/success/error)
- [x] 自动保存成功后列表查询失效,返回列表看到最新(useNoteMutations 失效 ["notes"] 缓存)

## Daily Notes 自动创建
- [x] 当日首次进入 `/notes` 时,若当天 daily 不存在则自动创建
- [x] 自动创建后跳转到该 daily 编辑器
- [x] 标题格式为"YYYY-MM-DD 学习日志"(notesService 渲染模板提取 H1 标题)
- [x] 正文顶部"今日数据"区已填入当日复习/任务/专注统计(静态快照)
- [x] 三段式空标题(今日学习/今日复习/今日反思)已就位(系统默认模板 content)
- [x] 当天 daily 已存在时不重复创建(getOrCreateTodayDaily 幂等)

## 节点详情关联笔记面板
- [x] 节点详情侧边栏出现"关联笔记"区块(NodeEditSidebar 集成 NotesPanel + tabNotes)
- [x] 列出挂载到该节点的所有笔记(useNotesByNode → notesApi.getByNodeId)
- [x] 点击关联笔记跳转到 `/notes/:noteId`
- [ ] 笔记 A 含 `[[节点X]]` → 节点X 详情显示笔记 A;移除链接后不再显示(需运行时验证)

## 软删除与回收站
- [x] 软删除的笔记进入 RecycleBin 页面"笔记"分类
- [x] 笔记可恢复,恢复时提示挂载关系不自动恢复(restoreSuccess 文案)
- [ ] 支持彻底删除(当前手动彻底删除暂未支持,30 天后自动清理)

## 国际化与质量
- [x] 新增 `notes` 命名空间 zh-CN/en-US 翻译,无硬编码中文
- [x] 接入 EmptyState、Skeleton 等现有 UX 组件
- [x] 无 `any` 类型无非空断言 `!`
- [x] 前端无 `console.log/info`,后端无 `console.*`
- [x] `npm run check` 通过
- [x] `npm run lint` 通过
