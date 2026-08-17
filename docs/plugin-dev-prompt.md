# KnowledgeMap × DSH 插件开发 — 可复制提示词包（给其他 AI 编程软件）

> **用途**：在 Cursor / Trae / Windsurf / Copilot 等**没有 cordis_define/cordis_run 工具**的 AI 编程软件里继续开发 KnowledgeMap 的 DSH harness 插件。
> 本文件是「复制即用」的提示词 + 上下文浓缩。完整设计见 `docs/harness-integration.md`，交接上下文见 `docs/harness-plugin-handoff.md`。
> 项目根目录：`D:\KnowledgeMap` · 生成：2026-08-16

---

## 1. 主提示词（直接复制粘贴给新会话）

把下面整段贴给其他 AI 编程软件（如 Cursor 对话、Trae 对话），作为会话开场：

```
你是 KnowledgeMap × DSH harness 集成项目的插件开发助手。

【项目背景】
D:\KnowledgeMap 是一个 AI 驱动的知识管理/学习平台（React + Electron + Express + Supabase）。
我们把它整合进 DeepSeek Harness（DSH）的 Cordis 插件体系，让 km_* 工具能在 harness 对话会话里直接使用。
已完成 12 个阶段、37 个 km_* 工具、Client UI 仪表盘、持久化 preset（重启自动加载）。当前目标是继续开发/维护这套插件。

【环境说明（重要）】
- 本环境没有 cordis_define / cordis_run / cordis_inspect 这些 harness 工具，你只能编辑文件。
- 插件代码都是「纯 JavaScript 函数体」（无 import/require/TS/JSX），返回 Cordis 插件对象。
- 验证方式：改完文件后，用户会回到 DSH 会话里用 cordis_define/cordis_run 加载并测试；你要保证文件语法正确、逻辑完整、并给出验证步骤。
- 数据文件路径固定：<会话 cwd>/.deepseek-harness/knowledgemap/*.json（cards/graphs/tasks/progress/paths/notes）。
- 所有工具注册在 Host 侧（harness.defineTool + harness.registerTool，或持久化包的 defineTool + ctx.get('tools')）。

【源码位置】
- 动态插件参考实现（每个都是完整可运行示例）：
  .deepseek-harness/knowledgemap/plugin-host.js            (FSRS 闪卡)
  .deepseek-harness/knowledgemap/plugin-graph-host.js      (知识图谱)
  .deepseek-harness/knowledgemap/plugin-task-host.js       (任务调度)
  .deepseek-harness/knowledgemap/plugin-progress-host.js   (成就/经验)
  .deepseek-harness/knowledgemap/plugin-hub2-host.js       (Hub 六域)
  .deepseek-harness/knowledgemap/plugin-rag-host.js        (RAG)
  .deepseek-harness/knowledgemap/plugin-path-host.js       (学习路径)
  .deepseek-harness/knowledgemap/plugin-note-host.js       (笔记/wiki/反链)
  .deepseek-harness/knowledgemap/plugin-dashboard.js       (Client UI 双半)
- 持久化包（真实 npm 包，重启自动加载，新增功能最好同步到这里）：
  C:\Users\金\.dsh\profiles\node_modules\@knowledgemap\dsh-km\lib\plugin.js
- 用户 preset 组合文件：C:\Users\金\.dsh\.agent-presets\knowledgemap\agent.cordis.yml

【关键约定】
1. 工具名一律 km_ 前缀，避免与内置工具冲突。
2. defineTool 的 output.render 签名是 render(args, value)，第二个参数才是结果。
3. 写文件必须传会话级 sandbox 策略：fs.writeText(target, content, undefined, undefined, sandboxPolicy.resolve({ session: exec.agent.session }))。
4. 每次调用从磁盘重读 JSON，不要内存缓存（支持人工编辑立即生效）。
5. 中文检索必须按 CJK 二字 bigram 切词（英文按词），否则无空格中文整句漏检。
6. FSRS-6 从 ts-fsrs 5.4.1 移植；XP 曲线 nextLevelThreshold = level × 500。
7. 所有 execute 用 guard 包裹（try/catch 返回 { ok:false, error, stack }）。

请先读 docs/harness-plugin-handoff.md 和 docs/harness-integration.md，再开始工作。
```

---

## 2. 任务模板提示词（按需选择）

### 2.1 新增一个域的工具集（如测验/文献/模板/周期任务）

```
请在 D:\KnowledgeMap 项目中新增一个「{域}」的 km_* 工具集，风格对齐现有 plugin-note-host.js / plugin-path-host.js。

要求：
1. 数据模型对齐 shared/types/{对应类型文件}.ts 的字段（先去读它）。
2. 新建 .deepseek-harness/knowledgemap/plugin-{name}-host.js，实现 {N} 个工具：{列出工具名与用途}。
3. 严格遵循：纯 JS 函数体返回 Cordis 插件；harness.defineTool + harness.registerTool；guard 错误包裹；每次重读 JSON；写文件传 sandboxPolicy。
4. 同时把新工具合并进持久化包 C:\Users\金\.dsh\profiles\node_modules\@knowledgemap\dsh-km\lib\plugin.js（在 apply 里 tools.push(defineTool({...}))，注意 FILES 常量要加对应 json 文件名）。
5. 数据存 <会话 cwd>/.deepseek-harness/knowledgemap/{name}.json。
6. 给出端到端验证步骤（建数据→查询→修改→统计），供用户在 DSH 会话里 cordis_run 后测试。
```

### 2.2 修复/增强现有工具

```
请在 {文件路径} 中修复/增强 {工具名}。
问题描述：{...}
要求：先读该文件和相关 shared/types，说明根因，给出最小改动，保持风格一致（guard、持久化 helper、schema DSL），并给出验证步骤。
```

### 2.3 better-sqlite3 桥（读 Electron 本地库）

```
请设计并实现「better-sqlite3 桥」：把 KnowledgeMap Electron 桌面端本地库（app.getPath('userData')/knowledgemap.db，better-sqlite3 数据库，见 electron/db/schema.ts 的 TABLES 定义）的六域数据（study_cards/graphs/nodes/edges/tasks/...）导入 harness 的 .deepseek-harness/knowledgemap/*.json。

注意：
- 插件代码本身不能 import better-sqlite3（动态插件沙箱无 require）；方案需通过 DSH 的 subprocess/shell 服务执行一个 node 脚本读取 .db，或用持久化包 + fs 读取导出文件。
- 先读 electron/db/schema.ts 确认表结构，再给方案；本机当前可能没有该 .db 文件（数据在 Supabase 云端），方案要处理「文件不存在」的降级。
- 输出：实现方案 + 代码 + 验证步骤。
```

### 2.4 给 RAG 升级语义嵌入

```
请评估并实现 km_ask 的语义嵌入升级：当前是关键词/bigram 检索（见 .deepseek-harness/knowledgemap/plugin-rag-host.js）。
方案选项：复用 DSH harness 的 llm service（查询 llm.stream / 嵌入能力）、或接入 KnowledgeMap 的 pgvector（api 侧，需 Supabase）。
请先读 harness 的 llm 契约（C:\Users\金\.dsh\profiles\node_modules\@deepseek-ai\dsh-llm\lib\types\*.d.ts），给出可行方案（含降级到关键词检索），再实现。
```

### 2.5 Client UI 增强（复习交互面板）

```
请在 kmapui-6 的仪表盘基础上增强 Client UI：在 run card（tool.view.cordis slot）里加「复习出题/评分」交互。
参考 .deepseek-harness/knowledgemap/plugin-dashboard.js 的 Host RPC + Client React 模式（React.createElement，无 JSX）。
新增 RPC 方法（harness.handle）返回待复习卡片，Client 端内联评分按钮，调用 km_review_rate 对应逻辑。
注意：Client half 需要用户批准后才能激活；代码要可独立于审批验证（Host 侧逻辑 + render_ui 工具卡兜底）。
```

---

## 3. 其他 AI 软件里的工作流（没有 cordis 工具时）

```
1. 编辑文件：直接改 .deepseek-harness/knowledgemap/plugin-*.js（动态插件版）或持久化包 lib/plugin.js。
2. 自检：语法检查（node --check）、逻辑审查、与现有文件风格对比。
3. 交付验证步骤：告诉用户回到 DSH 会话执行
   - 动态插件：cordis_define（code.host 传文件函数体）→ cordis_run → 调用新工具测试
   - 持久化包：重启 DSH（或改包名绕过 loader 缓存）→ 新会话选 knowledgemap preset
4. 提醒用户：改动持久化包后进程内不生效（loader 按 specifier 缓存模块），重启或改名后才加载。
```

---

## 4. 契约/参考文件路径（新会话可直接查阅）

| 用途 | 路径 |
| --- | --- |
| defineTool DSL（parameters/output/render） | `C:\Users\金\.dsh\profiles\node_modules\@deepseek-ai\dsh-tools\lib\types\schema.d.ts` |
| harness 注册工具/手柄（guard 层） | `C:\Users\金\.dsh\profiles\node_modules\@deepseek-ai\dsh-cordis-host-runner\lib\types\guard.d.ts` |
| Session header（cwd 来源） | `C:\Users\金\.dsh\profiles\node_modules\@deepseek-ai\dsh-session\lib\types\types.d.ts` |
| sandboxPolicy.resolve 契约 | `C:\Users\金\.dsh\profiles\node_modules\@deepseek-ai\dsh-sandbox-policy\lib\types\index.d.ts` |
| llm.stream / Message 构造 | `C:\Users\金\.dsh\profiles\node_modules\@deepseek-ai\dsh-llm\lib\types\{types,message}.d.ts` |
| commands 注册（/km） | `C:\Users\金\.dsh\profiles\node_modules\@deepseek-ai\dsh-commands\lib\types\index.d.ts` |
| agentPresets（preset 管理） | `C:\Users\金\.dsh\profiles\node_modules\@deepseek-ai\dsh-agent-presets\lib\index.js` |
| KnowledgeMap 数据模型 | `D:\KnowledgeMap\shared\types\*.ts`（common/graph-*/scheduler-*/note/quiz 等） |
| FSRS 上游算法 | `D:\KnowledgeMap\node_modules\ts-fsrs\dist\index.mjs` |
| 设计文档 | `D:\KnowledgeMap\docs\harness-integration.md` |
| 交接上下文 | `D:\KnowledgeMap\docs\harness-plugin-handoff.md` |
| 使用指南 | `D:\KnowledgeMap\docs\harness-usage.md` |

---

## 5. 交付前自检清单

- [ ] 文件语法通过（node --check；持久化包是 ESM，动态插件是函数体）
- [ ] 工具名 km_ 前缀、与现有工具不冲突
- [ ] parameters/output 用 schema DSL（type/description/required/enum/items）
- [ ] output.render(args, value) 用第二参数渲染结果
- [ ] execute 用 guard 包裹；写文件传 sandboxPolicy.resolve({session})
- [ ] 每次从磁盘重读 JSON（无缓存）
- [ ] 中文检索用 bigram（如涉及 RAG）
- [ ] 数据模型对齐 shared/types 对应文件
- [ ] 给出可复制的验证步骤（含预期输出）
