# KnowledgeMap × DSH Harness — 使用指南

> 在 DeepSeek Harness 会话里直接使用 KnowledgeMap 的能力。当前 **10 插件 · 37 工具**运行中；持久化 preset `knowledgemap` 重启后自动加载同一套工具。
>
> 数据全部落在当前工作区 `<cwd>/.deepseek-harness/knowledgemap/*.json`，可人工编辑、可导出备份。

---

## 1. 一句话速览

| 领域 | 工具 | 典型用法 |
| --- | --- | --- |
| 📇 闪卡复习 | `km_card_add` / `km_card_list` / `km_review_queue` / `km_review_rate` / `km_review_stats` | 把对话中的知识点做成 FSRS 闪卡，按遗忘曲线复习 |
| 🗺️ 知识图谱 | `km_graph_create` / `km_graph_node_add` / `km_graph_link` / `km_graph_list` / `km_graph_export` / `km_graph_search` | 组织节点-边，导出 mermaid 直接渲染 |
| ⏱️ 任务调度 | `km_task_add` / `km_task_list` / `km_task_start` / `km_task_focus_end` / `km_task_complete` / `km_task_stats` | Q0/Q1/Q2 三级队列 + 番茄钟 |
| 🏆 成就系统 | `km_progress_get` / `km_progress_earn` / `km_achievement_list` | 经验/等级/连击/成就，游戏化反馈 |
| 🧭 学习路径 | `km_path_create` / `km_path_node_add` / `km_path_list` / `km_path_node_start` / `km_path_node_complete` / `km_path_stats` | 目标 → 图谱节点序列 → 进度追踪 |
| 📝 笔记 | `km_note_add` / `km_note_list` / `km_note_get` / `km_note_link` / `km_note_backlinks` / `km_note_stats` | Markdown + `[[wiki 链接]]` 挂载图谱 + 反链 |
| 🔍 跨域检索 | `km_retrieve` / `km_ask` / `km_ask_sources` | RAG：检索六域知识，或直接语义问答 |
| 📦 导出总览 | `km_export` / `km_dashboard` | 全量备份（六域）/ 六域聚合一屏总览 |
| 🖥️ 界面 | `/km` 命令 + run card 仪表盘 + **面板内直接复习（出题/评分内联）** | 进度速览 / 可视化面板 |

---

## 2. 常用工作流

### 2.1 沉淀对话知识为闪卡

```
「把刚才讲的 FSRS 公式做成闪卡」
→ km_card_add(front="FSRS 中 R(t,S) 的计算公式", back="…", deck="算法", tags=["fsrs"])
```

之后任何会话里：
```
「开始复习」→ km_review_queue()  → 模型逐张出题
km_review_rate(card_id=…, rating="good")  → FSRS-6 自动排下次复习
```

### 2.2 组织一个知识图谱

```
「建一个图，讲清楚我们的架构」→ km_graph_create(title="…")
「加节点」→ km_graph_node_add(graph_id=…, title=…, level=…, content=…)
「连边」→ km_graph_link(graph_id=…, source=…, target=…, relationship_type=…, custom_label=…)
「导出看看」→ km_graph_export(graph_id=…)  → 把返回的 mermaid 放进 dsh-ui 围栏渲染
```

### 2.3 三层队列任务 + 番茄钟

```
「安排今天的任务」→ km_task_add(title=…, queue_level=0, priority=5)  # Q0 专注
「开始干活」→ km_task_start(task_id=…)   # 返回该队列时间片（Q0=25min）
「休息一下」→ km_task_focus_end(task_id=…) # 结算专注时长，建议休息
「搞定」→ km_task_complete(task_id=…)
```

### 2.4 学习路径

```
「建一个学习路径」→ km_path_create(title="…", goal="…", daily_minutes_target=30)
「把图谱节点排进去」→ km_path_node_add(path_id=…, node_id=…, estimated_minutes=20)
「开始/完成节点」→ km_path_node_start(path_id=…, node_ref_id=…) → km_path_node_complete(...)
「看进度」→ km_path_list / km_path_stats   # 完成全部节点自动置 completed
```

### 2.5 笔记 + wiki 链接

```
「记笔记」→ km_note_add(title="…", content="核心是 [[FSRS 复习引擎]] …")
  # [[节点标题]] 自动挂载图谱节点；[[其他笔记标题]] 形成反链
「查反链」→ km_note_backlinks(note_id=…)
```

### 2.6 基于知识库问答（RAG）

```
「问我知识库里有没有关于 FSRS 的内容」
→ km_ask_sources(question="FSRS 的 R(t,S) 公式")
→ km_ask(question="FSRS 的 R(t,S) 计算公式是什么？")  # 自动检索六域+LLM 合成
```

### 2.7 进度与备份

```
「看下总览」→ km_dashboard  或  /km   # 六域（闪卡/图谱/任务/路径/笔记/进度）
「备份」→ km_export(write_file=true)  → 生成 export-YYYY-MM-DD.json（六域全量）
「打卡」→ km_progress_earn(activity="login")
```

### 2.8 面板内直接复习

```
打开 run card 仪表盘 → 点「开始复习 (N)」
→ 逐张：看正面 → 点「显示答案」→ 看背面 → 点 重来/困难/良好/轻松
→ FSRS-6 自动排下次复习，+5 XP/张，连击/成就实时结算
→ 队列清空后显示总结（张数/四档分布/XP/升级/解锁），返回自动刷新统计
```

---

## 3. 数据文件（人工可编辑）

| 文件 | 内容 |
| --- | --- |
| `.deepseek-harness/knowledgemap/cards.json` | 闪卡（FSRS 状态：stability/difficulty/due/history） |
| `.deepseek-harness/knowledgemap/graphs.json` | 图谱（graphs/nodes/edges） |
| `.deepseek-harness/knowledgemap/tasks.json` | 任务（三级队列 + focus_sessions） |
| `.deepseek-harness/knowledgemap/progress.json` | 进度（xp/level/streak/unlocked） |
| `.deepseek-harness/knowledgemap/paths.json` | 学习路径（目标 + 节点序列 + 进度） |
| `.deepseek-harness/knowledgemap/notes.json` | 笔记（Markdown + wiki 挂载 links） |
| `.deepseek-harness/knowledgemap/export-*.json` | 全量备份（km_export 生成，六域） |

> 每次工具调用都会重读 JSON，手工改完立即生效；无需重启。

---

## 4. 持久化（重启后仍可用）

- **动态插件**（本会话）：`kmap-1`(FSRS) `kmapg-2`(图谱) `kmapt-3`(任务) `kmapp-4`(成就) `kmhub-13`(Hub 六域) `kmapui-7`(UI+内联复习) `kmrag-14`(RAG) `kmpath-11`(路径) `kmnote-12`(笔记)
- **持久化 preset**：新建会话时选择 **knowledgemap**，即自动加载同套 **37 工具**（真实 npm 包 `@knowledgemap/dsh-km`），数据文件共用。

---

## 5. 原理摘要（详见 docs/harness-integration.md）

- **FSRS-6**：从 ts-fsrs 5.4.1 逐行移植（21 参数默认权重、学习步进 1m/10m、间隔链约束），数值与上游一致
- **XP 曲线**：对齐 KnowledgeMap `achievementEngine`（level × 500 阈值，升级扣减、溢出结转）
- **RAG**：中英分词检索（中文 bigram）+ harness `llm` service（`agentDefaultModel` 当前路由）合成
- **wiki 链接**：`[[标题]]` 自动匹配图谱节点（含别名）挂载，笔记间形成反链
- **持久化包**：`~/.dsh/profiles/node_modules/@knowledgemap/dsh-km`（ESM 真实插件，`ctx.get` 取服务，零 inject）
