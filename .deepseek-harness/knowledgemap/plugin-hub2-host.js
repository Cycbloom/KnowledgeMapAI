// KnowledgeMap × DSH Harness — Phase 11: 统一 Hub v2（覆盖全部 6 域）
// Host half. 检索/导出/总览升级：cards + graphs/nodes/edges + tasks + progress + paths + notes。
// Storage: 读取 <session cwd>/.deepseek-harness/knowledgemap/*.json
// Usage: pass this function body to cordis_define (code.host), then cordis_run.

return {
  apply(ctx) {
    const fs = ctx.get('fs')
    const sandboxPolicy = ctx.get('sandboxPolicy')
    if (fs === undefined || sandboxPolicy === undefined) return

    const BASE = '.deepseek-harness/knowledgemap'
    const FILES = { cards: 'cards.json', graphs: 'graphs.json', tasks: 'tasks.json', progress: 'progress.json', paths: 'paths.json', notes: 'notes.json' }
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
      if (!info) return {}
      try {
        const parsed = JSON.parse(await fs.readText(target))
        if (parsed && typeof parsed === 'object') return parsed
      } catch (e) { /* fall through */ }
      return {}
    }
    async function readAll(exec) {
      const cards = await readStore(exec, 'cards')
      const graphs = await readStore(exec, 'graphs')
      const tasks = await readStore(exec, 'tasks')
      const progress = await readStore(exec, 'progress')
      const paths = await readStore(exec, 'paths')
      const notes = await readStore(exec, 'notes')
      return {
        cards: cards.cards || [], graphs: graphs.graphs || [], nodes: graphs.nodes || [], edges: graphs.edges || [],
        tasks: tasks.tasks || [], paths: paths.paths || [],
        notes: notes.notes || [], noteLinks: notes.links || [],
        progress: progress.xp !== undefined ? progress : null,
      }
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
      return String(text).toLowerCase().includes(q) ? 1 : 0
    }
    function noteExtractWiki(content) {
      const out = []
      const re = /\[\[([^\[\]]+)\]\]/g
      let m
      while ((m = re.exec(content || '')) !== null) {
        const title = m[1].trim().split('|')[0].split('#')[0].trim()
        if (title) out.push(title)
      }
      return out
    }

    const tools = []

    tools.push(harness.defineTool({
      name: 'km_retrieve',
      description: '跨域知识检索（RAG 检索层）：在闪卡/图谱节点/任务/笔记/学习路径中按关键词搜索，返回带来源与得分的相关条目，供作答时引用。',
      parameters: {
        query: { type: 'string', description: '检索关键词', required: true },
        limit: { type: 'integer', description: '每域返回条数上限（默认 5，最大 20）' },
      },
      output: { schema: { type: 'object', additionalProperties: true }, render: renderText },
      execute: guard(async (args, exec) => {
        const data = await readAll(exec)
        const q = args.query.toLowerCase()
        const limit = Math.min(args.limit || 5, 20)
        const hits = { cards: [], nodes: [], tasks: [], notes: [], paths: [] }

        for (const c of data.cards) {
          if (score(c.front, q) + score(c.back, q) + ((c.tags || []).some((t) => score(t, q)) ? 1 : 0) > 0) {
            hits.cards.push({ id: c.id, deck: c.deck, front: c.front, back: c.back, state: ['new', 'learning', 'review', 'relearning'][c.state] || 'new', tags: c.tags || [] })
          }
        }
        const graphTitles = {}
        for (const g of data.graphs) graphTitles[g.id] = g.title
        for (const n of data.nodes) {
          if (score(n.title, q) + score(n.content, q) + ((n.tags || []).some((t) => score(t, q)) ? 1 : 0) + ((n.aliases || []).some((a) => score(a, q)) ? 1 : 0) > 0) {
            hits.nodes.push({ id: n.id, graph_id: n.graph_id, graph_title: graphTitles[n.graph_id] || '', title: n.title, content: n.content || '', level: n.level || 'normal', tags: n.tags || [] })
          }
        }
        for (const t of data.tasks) {
          if (score(t.title, q) + score(t.description, q) + ((t.tags || []).some((tag) => score(tag, q)) ? 1 : 0) > 0) {
            hits.tasks.push({ id: t.id, title: t.title, description: t.description || '', status: t.status || 'pending', queue_level: t.queue_level, tags: t.tags || [] })
          }
        }
        for (const n of data.notes) {
          if (score(n.title, q) + score(n.content, q) + ((n.tags || []).some((t) => score(t, q)) ? 1 : 0) > 0) {
            hits.notes.push({ id: n.id, title: n.title, type: n.type || 'note', content_preview: (n.content || '').slice(0, 200), tags: n.tags || [], wiki_links: noteExtractWiki(n.content) })
          }
        }
        for (const p of data.paths) {
          if (score(p.title, q) + score(p.goal, q) + score(p.description, q) > 0) {
            hits.paths.push({ id: p.id, title: p.title, goal: p.goal || '', status: p.status || 'active', progress_percentage: p.progress_percentage || 0, total_nodes: p.total_nodes || 0 })
          }
        }
        const result = {
          ok: true, query: args.query,
          cards: hits.cards.slice(0, limit), nodes: hits.nodes.slice(0, limit), tasks: hits.tasks.slice(0, limit),
          notes: hits.notes.slice(0, limit), paths: hits.paths.slice(0, limit),
          total: hits.cards.length + hits.nodes.length + hits.tasks.length + hits.notes.length + hits.paths.length,
        }
        if (result.total === 0) result.hint = '无匹配条目，可换关键词或先补充知识（km_card_add / km_graph_node_add / km_note_add）'
        return result
      }),
    }))

    tools.push(harness.defineTool({
      name: 'km_export',
      description: '导出全部 KnowledgeMap 数据为单个 JSON 备份包（cards/graphs/nodes/edges/tasks/progress/paths/notes）。可写到文件。',
      parameters: {
        write_file: { type: 'boolean', description: '是否同时写入备份文件（默认 false，仅返回内容）' },
      },
      output: { schema: { type: 'object', additionalProperties: true }, render: renderText },
      execute: guard(async (args, exec) => {
        const data = await readAll(exec)
        const bundle = {
          app: 'KnowledgeMap', format_version: 2, exported_at: new Date().toISOString(),
          study_cards: data.cards,
          graphs: data.graphs, graph_nodes: data.nodes, edges: data.edges,
          tasks: data.tasks, progress: data.progress,
          learning_paths: data.paths, notes: data.notes, note_node_links: data.noteLinks,
        }
        const stats = {
          study_cards: data.cards.length, graphs: data.graphs.length,
          nodes: data.nodes.length, edges: data.edges.length, tasks: data.tasks.length,
          learning_paths: data.paths.length, notes: data.notes.length,
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
      description: 'KnowledgeMap 全景总览：复习队列、图谱、任务、进度、学习路径、笔记六域聚合统计，供快速掌握当前状态。',
      parameters: {},
      output: { schema: { type: 'object', additionalProperties: true }, render: renderText },
      execute: guard(async (_args, exec) => {
        const data = await readAll(exec)
        const now = Date.now()
        const byState = { new: 0, learning: 0, review: 0, relearning: 0 }
        for (const c of data.cards) byState[['new', 'learning', 'review', 'relearning'][c.state] || 'new']++
        const dueNow = data.cards.filter((c) => c.state === 0 || (c.state !== 0 && c.due <= now)).length
        const taskByQueue = { q0: 0, q1: 0, q2: 0 }
        for (const t of data.tasks) taskByQueue['q' + t.queue_level] = (taskByQueue['q' + t.queue_level] || 0) + 1
        const activeTasks = data.tasks.filter((t) => ['pending', 'in_progress', 'paused'].includes(t.status)).length
        const totalFocusMin = Math.round(data.tasks.reduce((s, t) => s + (t.actual_duration_sec || 0), 0) / 60)
        const activePaths = data.paths.filter((p) => p.status === 'active').length
        const pathProgress = data.paths.length ? Math.round(data.paths.reduce((s, p) => s + (p.progress_percentage || 0), 0) / data.paths.length) : 0
        const notesWithLinks = data.notes.filter((n) => data.noteLinks.some((l) => l.noteId === n.id)).length
        return {
          ok: true,
          study: { total: data.cards.length, by_state: byState, due_now: dueNow, decks: Object.keys(data.cards.reduce((m, c) => { m[c.deck || 'general'] = 1; return m }, {})).length },
          graphs: { total: data.graphs.length, nodes: data.nodes.length, edges: data.edges.length },
          tasks: { total: data.tasks.length, active: activeTasks, by_queue: taskByQueue, total_focus_min: totalFocusMin },
          paths: { total: data.paths.length, active: activePaths, avg_progress: pathProgress },
          notes: { total: data.notes.length, wiki_mounts: data.noteLinks.length, notes_with_links: notesWithLinks },
          progress: data.progress ? { level: data.progress.level, xp: data.progress.xp, streak: data.progress.streak, achievements: Object.keys(data.progress.unlocked || {}).length } : null,
        }
      }),
    }))

    for (const def of tools) {
      ctx.effect(() => harness.registerTool(ctx, def))
    }
  },
}
