// KnowledgeMap × DSH Harness — Phase 5: 统一检索 / 导出 / 总览
// Host half. 跨四域（cards/graphs/tasks/progress）检索、导出、聚合总览。
// Storage: 读取 <session cwd>/.deepseek-harness/knowledgemap/{cards,graphs,tasks,progress}.json
// Usage: pass this function body to cordis_define (code.host), then cordis_run.

return {
  apply(ctx) {
    const fs = ctx.get('fs')
    const sandboxPolicy = ctx.get('sandboxPolicy')
    if (fs === undefined || sandboxPolicy === undefined) return

    // ---------- 持久化（只读四域 + 导出写入） ----------
    const BASE = '.deepseek-harness/knowledgemap'
    const FILES = { cards: 'cards.json', graphs: 'graphs.json', tasks: 'tasks.json', progress: 'progress.json' }
    function sessionRoot(exec) {
      try {
        const cwd = exec && exec.agent && exec.agent.session && exec.agent.session.header ? exec.agent.session.header.cwd : undefined
        if (cwd && typeof cwd === 'string') return cwd
      } catch (e) { /* ignore */ }
      return sandboxPolicy.workspaceRoot
    }
    function writePolicy(exec) {
      try {
        if (exec && exec.agent && exec.agent.session) {
          return sandboxPolicy.resolve({ session: exec.agent.session })
        }
      } catch (e) { /* ignore */ }
      return sandboxPolicy.resolve()
    }
    async function readStore(exec, key) {
      const rel = BASE + '/' + FILES[key]
      const target = await fs.resolve(rel, { cwd: sessionRoot(exec) })
      const info = await fs.stat(target)
      if (!info) return { version: 1, cards: [], graphs: [], nodes: [], edges: [], tasks: [], progress: null }
      try {
        const parsed = JSON.parse(await fs.readText(target))
        if (parsed && typeof parsed === 'object') return parsed
      } catch (e) { /* fall through */ }
      return { version: 1, cards: [], graphs: [], nodes: [], edges: [], tasks: [], progress: null }
    }
    async function readAll(exec) {
      const cards = await readStore(exec, 'cards')
      const graphs = await readStore(exec, 'graphs')
      const tasks = await readStore(exec, 'tasks')
      const progress = await readStore(exec, 'progress')
      return { cards: cards.cards || [], graphs: graphs.graphs || [], nodes: graphs.nodes || [], edges: graphs.edges || [], tasks: tasks.tasks || [], progress: progress.xp !== undefined ? progress : null }
    }
    function renderText(args, value) {
      return [{ type: 'text', text: JSON.stringify(value, null, 2) }]
    }
    function guard(fn) {
      return async (args, exec) => {
        try {
          return await fn(args, exec)
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e)
          return { ok: false, error: msg, stack: e instanceof Error ? (e.stack || '').split('\n').slice(0, 6).join('\n') : undefined }
        }
      }
    }
    function score(text, q) {
      if (!text) return 0
      const t = String(text).toLowerCase()
      return t.includes(q) ? 1 : 0
    }

    // ---------- tools ----------
    const tools = []

    tools.push(harness.defineTool({
      name: 'km_retrieve',
      description: '跨域知识检索（RAG 检索层）：在闪卡/图谱节点/任务中按关键词搜索，返回带来源与得分的相关条目，供作答时引用。',
      parameters: {
        query: { type: 'string', description: '检索关键词', required: true },
        limit: { type: 'integer', description: '每域返回条数上限（默认 5，最大 20）' },
      },
      output: { schema: { type: 'object', additionalProperties: true }, render: renderText },
      execute: guard(async (args, exec) => {
        const data = await readAll(exec)
        const q = args.query.toLowerCase()
        const limit = Math.min(args.limit || 5, 20)
        const hits = { cards: [], nodes: [], tasks: [] }

        for (const c of data.cards) {
          const s = score(c.front, q) + score(c.back, q) + (c.tags || []).some((t) => score(t, q) ? 1 : 0)
          if (s > 0) hits.cards.push({ id: c.id, deck: c.deck, front: c.front, back: c.back, state: ['new', 'learning', 'review', 'relearning'][c.state] || 'new', tags: c.tags || [] })
        }
        const graphTitles = {}
        for (const g of data.graphs) graphTitles[g.id] = g.title
        for (const n of data.nodes) {
          const s = score(n.title, q) + score(n.content, q) + (n.tags || []).some((t) => score(t, q) ? 1 : 0) + (n.aliases || []).some((a) => score(a, q) ? 1 : 0)
          if (s > 0) hits.nodes.push({ id: n.id, graph_id: n.graph_id, graph_title: graphTitles[n.graph_id] || '', title: n.title, content: n.content || '', level: n.level || 'normal', tags: n.tags || [] })
        }
        for (const t of data.tasks) {
          const s = score(t.title, q) + score(t.description, q) + (t.tags || []).some((tag) => score(tag, q) ? 1 : 0)
          if (s > 0) hits.tasks.push({ id: t.id, title: t.title, description: t.description || '', status: t.status || 'pending', queue_level: t.queue_level, tags: t.tags || [] })
        }
        const result = {
          ok: true, query: args.query,
          cards: hits.cards.slice(0, limit), nodes: hits.nodes.slice(0, limit), tasks: hits.tasks.slice(0, limit),
          total: hits.cards.length + hits.nodes.length + hits.tasks.length,
        }
        if (result.total === 0) result.hint = '无匹配条目，可换关键词或先补充知识（km_card_add / km_graph_node_add）'
        return result
      }),
    }))

    tools.push(harness.defineTool({
      name: 'km_export',
      description: '导出全部 KnowledgeMap 数据为单个 JSON 备份包（cards/graphs/nodes/edges/tasks/progress）。可写到文件。',
      parameters: {
        write_file: { type: 'boolean', description: '是否同时写入备份文件（默认 false，仅返回内容）' },
      },
      output: { schema: { type: 'object', additionalProperties: true }, render: renderText },
      execute: guard(async (args, exec) => {
        const data = await readAll(exec)
        const bundle = {
          app: 'KnowledgeMap', format_version: 1, exported_at: new Date().toISOString(),
          study_cards: data.cards,
          graphs: data.graphs, graph_nodes: data.nodes, edges: data.edges,
          tasks: data.tasks,
          progress: data.progress,
        }
        const stats = {
          study_cards: data.cards.length, graphs: data.graphs.length,
          nodes: data.nodes.length, edges: data.edges.length, tasks: data.tasks.length,
          progress: data.progress ? `Lv.${data.progress.level}` : 'none',
        }
        if (args.write_file) {
          const rel = BASE + '/export-' + new Date().toISOString().slice(0, 10) + '.json'
          const target = await fs.resolve(rel, { cwd: sessionRoot(exec) })
          const policy = writePolicy(exec)
          await fs.writeText(target, JSON.stringify(bundle, null, 2), undefined, undefined, policy)
          return { ok: true, stats, file: await fs.processPath(target) }
        }
        return { ok: true, stats, bundle }
      }),
    }))

    tools.push(harness.defineTool({
      name: 'km_dashboard',
      description: 'KnowledgeMap 全景总览：复习队列、图谱、任务、进度四域聚合统计，供快速掌握当前状态。',
      parameters: {},
      output: { schema: { type: 'object', additionalProperties: true }, render: renderText },
      execute: guard(async (args, exec) => {
        const data = await readAll(exec)
        const now = Date.now()
        const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0)
        const dueNow = data.cards.filter((c) => c.state === 0 || (c.state !== 0 && c.due <= now))
        const byState = { new: 0, learning: 0, review: 0, relearning: 0 }
        for (const c of data.cards) byState[['new', 'learning', 'review', 'relearning'][c.state] || 'new']++
        const pendingTasks = data.tasks.filter((t) => ['pending', 'in_progress', 'paused'].includes(t.status))
        const taskByQueue = { q0: 0, q1: 0, q2: 0 }
        for (const t of data.tasks) taskByQueue['q' + t.queue_level] = (taskByQueue['q' + t.queue_level] || 0) + 1
        const totalFocusSec = data.tasks.reduce((s, t) => s + (t.actual_duration_sec || 0), 0)
        return {
          ok: true,
          study: { total: data.cards.length, by_state: byState, due_now: dueNow.length, decks: Object.keys(data.cards.reduce((m, c) => { m[c.deck || 'general'] = 1; return m }, {})).length },
          graphs: { total: data.graphs.length, nodes: data.nodes.length, edges: data.edges.length },
          tasks: { total: data.tasks.length, active: pendingTasks.length, by_queue: taskByQueue, total_focus_min: Math.round(totalFocusSec / 60) },
          progress: data.progress ? { level: data.progress.level, xp: data.progress.xp, streak: data.progress.streak, achievements: Object.keys(data.progress.unlocked || {}).length } : null,
        }
      }),
    }))

    for (const def of tools) {
      ctx.effect(() => harness.registerTool(ctx, def))
    }
  },
}
