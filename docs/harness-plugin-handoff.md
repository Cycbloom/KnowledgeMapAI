# KnowledgeMap × DSH Harness 插件开发 — 交接上下文

> **用途**：本文件是给「其他 AI 编程软件 / 新开发会话」的完整上下文交接，使其无需阅读历史会话即可继续 KnowledgeMap 插件开发。
> 生成时间：2026-08-16（目标达成，12 阶段完成）
> 项目根目录：`D:\KnowledgeMap`（KnowledgeMap 全栈应用源码仓库）

---

## 0. 一句话背景

用户想把自己开发的 **KnowledgeMap**（AI 驱动的知识管理/学习平台：知识图谱、FSRS 间隔重复、任务调度、成就系统、笔记、学习路径）整合进 **DeepSeek Harness（DSH）** 作为 Cordis 插件，让这些能力能在 harness 对话会话里直接使用。这是"大工程"，目前已按 12 个阶段完成并端到端验证。

**当前状态**：10 个动态插件 × 37 个 `km_*` 工具全部开发完毕（kmapui-7 取代 kmapui-6，新增面板内联复习交互）；另有一个**持久化 preset**（`knowledgemap`）+ 真实 npm 包（`@knowledgemap/dsh-km`），重启后自动加载，不依赖动态插件。

---

## 1. 架构总览

```
DSH 会话（Agent/模型循环）
  ├─ 动态插件（会话内，重启失效）：
  │    kmap-1      FSRS 闪卡      （5 工具）
  │    kmapg-2     知识图谱        （6 工具）
  │    kmapt-3     任务调度        （6 工具）
  │    kmapp-4     成就/经验       （3 工具）
  │    kmhub-13    Hub 六域        （3 工具：retrieve/export/dashboard）
  │    kmrag-14    RAG 语义问答    （2 工具）
  │    kmpath-11   学习路径        （6 工具）
  │    kmnote-12   笔记系统        （6 工具）
  │    kmapui-6    Client UI 仪表盘（run card 内嵌，已激活）
  │
  ├─ 持久化 preset（重启自动加载，推荐入口）：
  │    preset id: knowledgemap
  │    → 真实 npm 包 @knowledgemap/dsh-km（37 工具 + /km 命令）
  │    → 位置: ~/.dsh/profiles/node_modules/@knowledgemap/dsh-km/
  │    → 组合文件: ~/.dsh/.agent-presets/knowledgemap/agent.cordis.yml
  │
  └─ 数据层（全部 JSON，人工可编辑，每次调用重读）：
       <会话 cwd>/.deepseek-harness/knowledgemap/
         cards.json / graphs.json / tasks.json / progress.json / paths.json / notes.json
         + export-YYYY-MM-DD.json（km_export 备份）
```

**平台分工**：工具注册全部在 **Host**（`harness.defineTool` + `harness.registerTool`）；Client 仅 kmapui-7（`tool.view.cordis` slot + `host.call` RPC）。

---

## 2. 37 个工具清单

| 域 | 工具 |
| --- | --- |
| FSRS 闪卡 | `km_card_add` `km_card_list` `km_review_queue` `km_review_rate` `km_review_stats` |
| 知识图谱 | `km_graph_create` `km_graph_node_add` `km_graph_link` `km_graph_list` `km_graph_export` `km_graph_search` |
| 任务调度 | `km_task_add` `km_task_list` `km_task_start` `km_task_focus_end` `km_task_complete` `km_task_stats` |
| 成就/经验 | `km_progress_get` `km_progress_earn` `km_achievement_list` |
| Hub（六域） | `km_retrieve` `km_export` `km_dashboard` |
| RAG | `km_ask` `km_ask_sources` |
| 学习路径 | `km_path_create` `km_path_node_add` `km_path_list` `km_path_node_start` `km_path_node_complete` `km_path_stats` |
| 笔记 | `km_note_add` `km_note_list` `km_note_get` `km_note_link` `km_note_backlinks` `km_note_stats` |

外加 `/km` 人类命令（commands service 注册，返回进度总览文本）。

---

## 3. 关键源码位置（都在 D:\KnowledgeMap 内）

| 文件 | 内容 |
| --- | --- |
| `.deepseek-harness/knowledgemap/plugin-host.js` | FSRS 闪卡（动态插件版，含 FSRS-6 完整移植） |
| `.deepseek-harness/knowledgemap/plugin-graph-host.js` | 知识图谱 |
| `.deepseek-harness/knowledgemap/plugin-task-host.js` | 任务调度 |
| `.deepseek-harness/knowledgemap/plugin-progress-host.js` | 成就/经验 + /km 命令 |
| `.deepseek-harness/knowledgemap/plugin-hub2-host.js` | Hub 六域（v2，替换 plugin-hub-host.js） |
| `.deepseek-harness/knowledgemap/plugin-rag-host.js` | RAG（检索 + llm.stream） |
| `.deepseek-harness/knowledgemap/plugin-path-host.js` | 学习路径 |
| `.deepseek-harness/knowledgemap/plugin-note-host.js` | 笔记/wiki/反链 |
| `.deepseek-harness/knowledgemap/plugin-dashboard.js` | Client UI（Host RPC + Client slot 双半） |
| `.deepseek-harness/knowledgemap/plugin-review-ui.js` | Client UI 内联复习（Host RPC ×3 + Client 复习视图，取代 plugin-dashboard.js） |
| `docs/harness-integration.md` | 设计文档（12 阶段路线图 + 关键坑） |
| `docs/harness-usage.md` | 用户使用指南 |

**持久化包**（真实 npm 包，重启加载）：`C:\Users\金\.dsh\profiles\node_modules\@knowledgemap\dsh-km\lib\plugin.js` —— 是上面 8 个 host 插件的合并 ESM 版（37 工具 + /km），用 `defineTool` from `@deepseek-ai/dsh-tools` + `ctx.get('tools')` 注册，零 inject。

---

## 4. 数据模型（与 KnowledgeMap 上游类型对齐）

| JSON 文件 | 对齐的 shared/types 文件 | 关键字段 |
| --- | --- | --- |
| cards.json | `common.ts` StudyCard / ts-fsrs Card | state 0-3, stability, difficulty, due, scheduled_days, reps, lapses, history[] |
| graphs.json | `graph-node.ts` `graph-edge.ts` `graph-core.ts` | graphs[], nodes[](level/tags/aliases/pos), edges[](relationship_type/weight/custom_label) |
| tasks.json | `scheduler-task.ts` `scheduler-core.ts` | queue_level 0/1/2, status, focus_sessions[] |
| progress.json | `scheduler-achievement.ts` | xp, level, streak, best_streak, counters{}, unlocked{} |
| paths.json | `common.ts` LearningPath/NodeRef | status, nodes[](status/completed_at), progress_percentage |
| notes.json | `note.ts` Note/NoteNodeLink | notes[](content/type/tags), links[](noteId/nodeId) |

**FSRS-6**：从 `node_modules/ts-fsrs@5.4.1/dist/index.mjs` 逐行移植（21 参数 default_w、`computeDecayFactor`、`next_state` 分支、学习步进 1m/10m、间隔链 hard≤good≤easy 约束）。**XP 曲线**：`nextLevelThreshold = level × 500`（对齐 `api/services/achievements/achievementEngine.ts`）。

---

## 5. ⚠️ 关键实现坑（务必先读，避免重踩）

1. **`output.render(args, value)`** —— 第二个参数才是结果，第一个是入参。写 `render(args, value)` 而不是 `render(value)`，否则结果变成入参回声。
2. **动态插件持久化路径**：必须从 `exec.agent.session.header.cwd` 取会话工作区；`sandboxPolicy.workspaceRoot` 只是 fallback（可能落在用户主目录 `C:\Users\金\...` 而非项目目录）。
3. **写文件必须显式传会话级 sandbox 策略**：`fs.writeText(target, content, undefined, undefined, sandboxPolicy.resolve({ session: exec.agent.session }))`，否则按部署默认模式拒绝写工作区（`file access denied under workspace-write mode`）。
4. **不要用内存缓存**：每次调用从磁盘重读 JSON，支持人工编辑文件后立即生效。
5. **loader 按 specifier 缓存模块**：持久化包改代码后进程内不生效（改名 `dsh-km-tools`→`dsh-km` 绕过）；预设 mount 校验用 `agentPresets.standingKeyFor(id)`。
6. **工具型包无需 realm**：只注册工具（不发布 service）的行，与 `tool-fs` 同理，在 preset 里直接平铺即可。
7. **RAG 中文检索**：中文无空格，整句会被当作单个 token 漏检 —— 必须按**连续 CJK 字符的二字 bigram** 切词（英文按词），任一命中即匹配。
8. **Client UI 需审批**：Client half 激活会进入 awaiting-approval，approval 策略为 never 时不会自动通过（用户手动批准后已激活 run-13；kmapui-6 现状以 persist 为准）。

---

## 6. 已完成的验证（证据）

- FSRS 数值与 ts-fsrs 5.4.1 逐项一致（good→stability=w[2]=2.3065 / again→0.212 / easy→8.2956 且 interval=8 天）
- 升级算法：440+100 XP → Lv.2 @40XP（对齐 level×500）
- 图谱 mermaid 导出 → dsh-ui 渲染闭环；路径 33%→67%→100% 自动 completed
- wiki 链接自动挂载图谱节点 + 笔记间反链
- RAG：中英文问答均从知识库命中并给出带依据答案（used_llm=true, deepseek-v4-flash）
- 持久化 preset `standingKeyFor` → "mounted OK"；npm 包 smoke 测试 37 工具 + /km
- plugin-review-ui.js：FSRS-6/成就块逐字符 diff 零漂移；node ESM import 冒烟通过（端到端面板复习待 DSH 会话内执行）

---

## 7. 剩余可选项（非阻塞，按需继续）

| 项 | 说明 | 前置条件 |
| --- | --- | --- |
| **better-sqlite3 桥** | 读 Electron 本地库 `knowledgemap.db`（`app.getPath('userData')`），把真实桌面数据导入 harness 六域 | 当前本机无该文件（数据在 Supabase 云端），等桌面端同步产生本地库 |
| **llm 语义嵌入 RAG** | 当前 `km_ask` 是关键词/bigram 检索；可升级为向量检索（复用 harness `llm` 或 KnowledgeMap pgvector） | 需评估 embedding 路由 |
| 更多域移植 | 测验/题库、文献、模板、周期任务等（shared/types 里都有对应类型） | 无 |

> Client UI 复习交互已于 Phase 12 完成（plugin-review-ui.js），待 DSH 会话内激活验证。

---

## 8. 如何在别的 AI 编程软件里继续

1. **把本文件连同 `docs/harness-integration.md`、`docs/harness-usage.md` 一起丢给新会话**，并说明"这是 KnowledgeMap 集成 DSH harness 的插件开发项目，当前 37 工具已完成，请基于这些继续"。
2. 如果新会话要**改代码并验证**：动态插件用 `cordis_define`（code.host 传函数体）→ `cordis_run`；持久化包直接改 `~/.dsh/profiles/node_modules/@knowledgemap/dsh-km/lib/plugin.js`（重启或改名绕过缓存后生效）。
3. 数据文件路径固定：`<会话 cwd>/.deepseek-harness/knowledgemap/`。
4. 参考实现：`plugin-*-host.js` 每个文件都是一个完整可运行的例子（含 guard 错误包裹、持久化 helper、工具 schema DSL）。
