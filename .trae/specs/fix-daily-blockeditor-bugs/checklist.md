# 缺陷修复验收检查清单

## Bug 1: i18n 中文化
- [x] `zh-CN/notes.json` 中 `badges.daily` 改为中文(如"每日笔记")
- [x] 搜索 zh-CN 中所有含 "Daily" 英文残留的 key,统一改为中文
- [x] `en-US/notes.json` 保持英文不改动
- [x] zh-CN / en-US key 集合一致(值不同但 key 相同)

## Bug 2: 新建 Daily 按钮状态解耦
- [x] NotesListPage.tsx 自动创建 useEffect 与手动按钮使用独立 mutation 实例或独立 state
- [x] 进入 /notes 页面自动创建完成后,按钮恢复可用(非灰色转圈)
- [x] 按钮点击仍能正常新建

## Bug 3: AI 总结插入渲染
- [x] BlockEditorToolbar.tsx 的 insertSummary 改为先解析 Markdown 再插入
- [x] `### 标题` 插入后渲染为标题样式(大字号)
- [x] `**加粗**` 插入后渲染为加粗样式
- [x] `- 列表项` 插入后渲染为列表样式
- [x] 保存后重新打开仍为渲染样式(非字面量)
- [x] WritingAssistPopover 的续写/改写/扩写采纳逻辑同样修复(若存在纯文本插入问题)

## Bug 4: 自动保存不触发进度条
- [x] LoadingBar.tsx 的 useIsMutating 增加 predicate 过滤 silent mutation
- [x] useNoteMutations.ts 的 useUpdateNoteMutation 标记 meta.silent
- [x] 编辑时顶部 LoadingBar 不显示
- [x] saveStatus 文案(saving/saved)仍正常显示

## Bug 5: 斜杠菜单边界自适应
- [x] BlockEditor.tsx detectSlashCommand 定位逻辑增加 viewport clamp
- [x] 光标在右边缘时菜单左移不溢出
- [x] 光标在底部时菜单翻转到上方
- [x] 菜单左边缘不贴视口边缘(最小 8px 间距)

## Bug 6: Wiki 链接全链路
- [x] editorExtensions.ts Link protocols 去掉冒号("wiki:" → "wiki")
- [x] autolink 评估(若仍报错则设 false)
- [x] 插入 wiki 链接 → 编辑器渲染为可点击样式
- [x] 保存 → 落盘为 `[[节点名]]` 语法
- [x] 重新打开 → 链接重新渲染(括号不丢失)
- [x] 点击 wiki 链接 → 跳转到对应节点
- [x] 浏览器控制台无 `linkifyjs: incorrect scheme format` 错误

## Bug 7: 刷新今日数据不重复
- [x] notesService.ts refreshDailyAggregation 改为按行分段替换逻辑
- [x] 旧数据行被整段替换(不残留)
- [x] 连续多次刷新数据条目数量一致
- [x] 边界场景:heading 后空行 → 正确替换
- [x] 边界场景:段在文档末尾无 `\n` → 正确替换
- [x] 边界场景:`\r\n` 换行 → 正确替换
- [x] 边界场景:heading 含尾部空格 → 正确替换
- [x] notesRefreshAggregation.test.ts 补充边界用例

## 质量收口
- [x] `npm run check` 通过
- [x] `npm run lint` 通过
- [x] `npx vitest run api/__tests__/services/notesRefreshAggregation.test.ts` 通过
- [x] 无 any 类型、无非空断言 !
- [x] 前端无 console.log/info,后端无 console.*
