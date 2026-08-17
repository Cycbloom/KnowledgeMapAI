# @knowledgemap/dsh-km-ui

KnowledgeMap × DeepSeek Harness 融合 UI（durable web-profile 包）。

## 做什么

把 KnowledgeMap 的六域数据（闪卡/图谱/任务/进度/学习路径/笔记）融合进 harness 产品表面，
而不是塞在 run card 里：

| Slot | 内容 |
| --- | --- |
| `conversation.composer.dock` | 常驻环境状态带：`🧠 复习 N · 图 M · 任务 K · Lv.X 🔥Y`，点击展开/收起到期复习队列 |
| `conversation.input.right` | 🧠 按钮：展开/收起复习队列（发送键左侧） |
| `conversation.session.header.utilities` | 📊 按钮：打开六域总览浮层 |
| `shell.overlay` | 六域总览面板（root 作用域，sessionId 由 📊 按钮捕获） |

## 结构

- `lib/index.js` — host 半区：注册 `/km-ui-overview`、`/km-ui-queue [limit]` 两个命令，
  读取目标 session 工作区下 `.deepseek-harness/knowledgemap/*.json` 六个域，
  以 JSON 字符串作为命令结果 `text` 返回（`recordInput: false`）。
- `lib/client.js` — 浏览器半区：`window.__ModuleLoader__.load` 包装，
  通过内置 `commands` remote 调用 host 命令，四个 Slot 全部 additive。
- `cordis.patch.yml` — bundle 层 insert 行（`id: km-ui`）。

## 安装（web profile）

1. 将本目录复制到 `~/.dsh/profiles/web/node_modules/@knowledgemap/dsh-km-ui/`
2. 在 `~/.dsh/profiles/web/package.json` 的 `dsh.profile.bundles` 中加入 `@knowledgemap/dsh-km-ui`
3. （可选热生效）在 `~/.dsh/profiles/web/cordis.patch.yml` 中加入同名 insert 行，
   其 watcher 会热应用；重启后 bundle 层也会自动加载该行

## 数据

六域 JSON 与工具插件共用：`<workspace>/.deepseek-harness/knowledgemap/{cards,graphs,tasks,progress,paths,notes}.json`。
