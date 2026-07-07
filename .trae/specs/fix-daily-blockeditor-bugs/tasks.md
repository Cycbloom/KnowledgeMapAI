# Tasks

## 缺陷修复任务清单

### 第一组:独立修复(无依赖,可并行)

- [x] Task 1: i18n 中文化(Bug 1)
  - [x] SubTask 1.1: 修改 `src/i18n/locales/zh-CN/notes.json`:
    - `badges.daily`: "Daily" → "每日笔记"
    - 搜索其他含 "Daily" 的英文残留(如 `actions.newDaily`、`empty.dailyTitle` 等),统一为中文
  - [x] SubTask 1.2: 检查 `src/i18n/locales/en-US/notes.json` 保持英文(不改动英文文案)
  - [x] SubTask 1.3: 验证 zh-CN / en-US key 集合一致

- [x] Task 2: linkifyjs scheme 修复(Bug 6,关键)
  - [x] SubTask 2.1: 修改 `src/components/Notes/editorExtensions.ts`:
    - Link 扩展 `protocols` 配置:将 `WIKI_LINK_PROTOCOL.slice(0, -2)`(结果 `"wiki:"` 含冒号)改为 `"wiki"`(不含冒号)
  - [x] SubTask 2.2: 评估 `autolink: true` 是否仍需保留
    - 若 linkifyjs 对含中文的 `wiki://节点名` 仍报错,考虑设 `autolink: false`(wiki 链接通过 popover 显式插入,不依赖 autolink)
    - 若 `autolink: false` 则验证手动插入的 wiki 链接仍正常渲染与保存
  - [x] SubTask 2.3: 全链路验证:插入 wiki 链接 → 保存 → 重新打开 → 链接渲染 → 点击跳转,控制台无 linkifyjs 错误

- [x] Task 3: 斜杠菜单边界自适应(Bug 5)
  - [x] SubTask 3.1: 修改 `src/components/Notes/BlockEditor.tsx` 的 `detectSlashCommand` 定位逻辑(约 352-358 行):
    - 计算 `coords = ed.view.coordsAtPos(selection.from)`
    - 预估菜单尺寸(menuWidth=280, menuHeight=320)
    - left = `Math.min(coords.left, window.innerWidth - menuWidth - 8)`
    - top: 若 `coords.bottom + 4 + menuHeight > window.innerHeight` 则翻转到上方 `coords.top - menuHeight - 4`,否则 `coords.bottom + 4`
    - left 最小为 8(避免贴左边缘)
  - [x] SubTask 3.2: 可选 — 用 ref 测量 SlashCommandMenu 实际尺寸后回调修正位置(避免预估不准)

### 第二组:状态与进度条(独立,可并行)

- [x] Task 4: 新建 Daily 按钮状态解耦(Bug 2)
  - [x] SubTask 4.1: 修改 `src/pages/Notes/NotesListPage.tsx`:
    - 为自动创建与手动按钮使用独立的 mutation 实例(方案 A):调用两次 `useGetOrCreateTodayDailyMutation()`,一个给 auto-create useEffect,一个给按钮
    - 或用独立 `autoCreateInProgress` state(方案 B):按钮 disabled 只看手动 mutation 的 isPending
  - [x] SubTask 4.2: 验证进入 /notes 页面后按钮立即可用(自动创建在后台进行,不影响按钮状态)

- [x] Task 5: 自动保存静默 mutation(Bug 4)
  - [x] SubTask 5.1: 修改 `src/components/common/LoadingBar.tsx`:
    - `useIsMutating()` 增加 predicate 过滤 silent mutation(类似 `isFetching` 已有的 `predicate: (query) => !query.meta?.silent`)
    - `useIsMutating({ predicate: (mutation) => !mutation.options.meta?.silent })` 或类似 API
  - [x] SubTask 5.2: 修改 `src/hooks/mutations/useNoteMutations.ts` 或 mutationFactory:
    - 为 `useUpdateNoteMutation` 的 mutation 设置 `meta: { silent: true }`(自动保存场景)
    - 注意:手动保存(如点击保存按钮)若也需要静默则统一;若有显式保存按钮则区分
  - [x] SubTask 5.3: 验证编辑时顶部 LoadingBar 不显示,但 saveStatus 文案仍正常

### 第三组:功能性修复(关键)

- [x] Task 6: AI 总结插入为渲染后内容(Bug 3,关键)
  - [x] SubTask 6.1: 修改 `src/components/Notes/BlockEditorToolbar.tsx` 的 `insertSummary`(约 118-132 行):
    - 当前:`insertContentAt(pos, { type: "paragraph", content: [{ type: "text", text: summary }] })` — summary 当纯文本
    - 改为:先用 `markdownToTiptap(summary)` 预处理(转 `[[wiki]]` 等),再用 tiptap-markdown 解析为 ProseMirror 节点 JSON 或 HTML 片段后插入
    - 方案:用 `editor.view.pasteHTML(html)` 或构造 ProseMirror content JSON 后 `insertContentAt(pos, json)`
    - 或:用 markdown-it 将 summary 转 HTML,再用 `insertContentAt(pos, htmlString)`(Markdown 扩展 html: true 已开启)
  - [x] SubTask 6.2: 验证 `### 标题` / `**加粗**` / `- 列表` 插入后渲染为可视化样式
  - [x] SubTask 6.3: 验证保存后重新打开仍为渲染样式(非字面量)
  - [x] SubTask 6.4: 验证写作辅助的"续写/改写/扩写"采纳逻辑是否也存在同样问题(若 WritingAssistPopover 也用纯文本插入,一并修复)

- [x] Task 7: 刷新今日数据不重复(Bug 7,关键)
  - [x] SubTask 7.1: 修改 `api/services/notes/notesService.ts` 的 `refreshDailyAggregation`(约 1937-1958 行):
    - 废弃脆弱的正则 `sectionRegex`
    - 改为按行分段逻辑:
      1. `content.split('\n')` 按行分割
      2. 找到 `## 今日数据` 行(含尾部空格容忍:`line.trim() === '## 今日数据'` 或 `line.startsWith('## 今日数据')`)
      3. 从该行下一行起,向后遍历直到遇到下一个 `## ` 标题或数组末尾
      4. 整段(标题行 + 所有数据行)替换为 newSection
      5. 若未找到 `## 今日数据` 行,在文档顶部追加 newSection
    - 注意保留段间空行与文档末尾换行
  - [x] SubTask 7.2: 修改 `api/__tests__/services/notesRefreshAggregation.test.ts` 补充边界用例:
    - heading 后紧跟空行(TipTap 默认块间空行)
    - 段位于文档末尾且末行无 `\n`
    - 换行为 `\r\n`(Windows)
    - heading 含尾部空格(`## 今日数据 `)
    - 多次连续刷新不重复
  - [x] SubTask 7.3: 验证刷新后数据条目数量一致,无重复

### 第四组:质量收口

- [x] Task 8: 整体验证与回归
  - [x] SubTask 8.1: 运行 `npm run check` 通过
  - [x] SubTask 8.2: 运行 `npm run lint` 通过
  - [x] SubTask 8.3: 运行 `npx vitest run api/__tests__/services/notesRefreshAggregation.test.ts` 通过
  - [x] SubTask 8.4: 手动回归测试清单(由用户执行):
    - 新建 Daily → 中文徽章
    - 进入 /notes → 按钮可用(非灰色转圈)
    - 生成今日总结 → 采纳后渲染为可视化样式
    - 连续输入 → 顶部无进度条
    - 斜杠命令 → 菜单在光标处且不越界
    - 插入 wiki 链接 → 保存 → 重开 → 链接渲染且可点击,控制台无错误
    - 刷新今日数据 → 多次刷新无重复

# Task Dependencies
- Task 1-5 互相独立,可并行
- Task 6 独立(依赖 markdownSerializer.ts 已有函数)
- Task 7 独立(后端服务)
- Task 8 依赖所有前置任务完成

# 可并行任务
- Task 1 / 2 / 3 / 4 / 5 / 6 / 7 全部可并行(无相互依赖)
