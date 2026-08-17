// KnowledgeMap × DSH Harness — Phase 10: 笔记系统（wiki 链接 / 反链）
// Host half. 对齐 shared/types/note.ts（Note / NoteNodeLink）。
// [[标题]] 语法：保存时自动解析为指向图谱节点的挂载（wiki 链接即挂载）。
// Storage: <session cwd>/.deepseek-harness/knowledgemap/notes.json via fs service.
// Usage: pass this function body to cordis_define (code.host), then cordis_run.

return {
  apply(ctx) {
    const fs = ctx.get('fs')
    const sandboxPolicy = ctx.get('sandboxPolicy')
    if (fs === undefined || sandboxPolicy === undefined) return

    // ---------- persistence ----------
    const REL = '.deepseek-harness/knowledgemap/notes.json'
    const GRAPHS_REL = '.deepseek-harness/knowledgemap/graphs.json'
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
    async function resolveStore(exec, rel) {
      return fs.resolve(rel, { cwd: sessionRoot(exec) })
    }
    async function loadStore(exec) {
      const target = await resolveStore(exec, REL)
      const info = await fs.stat(target)
      let store = { version: 1, notes: [], links: [] }
      if (info) {
        try {
          const parsed = JSON.parse(await fs.readText(target))
          if (parsed && Array.isArray(parsed.notes)) store = parsed
        } catch (e) { /* fall through */ }
      }
      return store
    }
    async function saveStore(exec, store) {
      const target = await resolveStore(exec, REL)
      const policy = writePolicy(exec)
      await fs.writeText(target, JSON.stringify(store, null, 2), undefined, undefined, policy)
    }
    // 读取图谱，解析 [[节点标题]] → 节点
    async function loadGraphIndex(exec) {
      const target = await resolveStore(exec, GRAPHS_REL)
      const info = await fs.stat(target)
      if (!info) return { byTitle: {}, nodes: [] }
      try {
        const graphs = JSON.parse(await fs.readText(target))
        const nodes = graphs.nodes || []
        const byTitle = {}
        for (const n of nodes) {
          byTitle[(n.title || '').toLowerCase()] = n
          for (const a of n.aliases || []) byTitle[String(a).toLowerCase()] = n
        }
        return { byTitle, nodes }
      } catch (e) { /* fall through */ }
      return { byTitle: {}, nodes: [] }
    }
    function uid(prefix) {
      return (prefix || 'n') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8)
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
    // 从 Markdown 提取 [[...]] wiki 链接标题
    function extractWikiLinks(content) {
      const out = []
      const re = /\[\[([^\[\]]+)\]\]/g
      let m
      while ((m = re.exec(content || '')) !== null) {
        const raw = m[1].trim()
        // 支持 [[标题]]、[[标题|别名]]、[[标题#块]]
        const title = raw.split('|')[0].split('#')[0].trim()
        if (title) out.push(title)
      }
      return out
    }
    function noteView(n) {
      return {
        id: n.id, title: n.title, type: n.type || 'note', date: n.date || null,
        tags: n.tags || [], is_pinned: !!n.is_pinned, is_archived: !!n.is_archived,
        created_at: n.created_at, updated_at: n.updated_at,
        content_preview: (n.content || '').slice(0, 160),
      }
    }

    // ---------- tools ----------
    const tools = []

    tools.push(harness.defineTool({
      name: 'km_note_add',
      description: '创建一篇 Markdown 笔记（KnowledgeMap）。内容中的 [[节点标题]] 会自动解析为指向图谱节点的 wiki 挂载。返回创建的笔记与挂载。',
      parameters: {
        title: { type: 'string', description: '笔记标题', required: true },
        content: { type: 'string', description: 'Markdown 正文（支持 [[节点标题]] wiki 链接）' },
        tags: { type: 'array', items: { type: 'string' }, description: '标签列表' },
        note_type: { type: 'string', enum: ['note', 'daily'], description: '笔记类型（默认 note）' },
        date: { type: 'string', description: '日期（daily 类型用，YYYY-MM-DD）' },
      },
      output: { schema: { type: 'object', additionalProperties: true }, render: renderText },
      execute: guard(async (args, exec) => {
        const store = await loadStore(exec)
        const graphIndex = await loadGraphIndex(exec)
        const now = new Date().toISOString()
        const note = {
          id: uid('note'), title: args.title, content: args.content || '',
          type: args.note_type || 'note', date: args.date || null,
          tags: args.tags || [], is_pinned: false, is_archived: false,
          created_at: now, updated_at: now,
        }
        store.notes.push(note)
        // wiki 链接挂载：[[标题]] → 图谱节点
        const mounted = []
        for (const title of extractWikiLinks(note.content)) {
          const node = graphIndex.byTitle[title.toLowerCase()]
          if (!node) continue
          if (store.links.some((l) => l.noteId === note.id && l.nodeId === node.id)) continue
          store.links.push({ id: uid('lnk'), noteId: note.id, nodeId: node.id, graphId: node.graph_id || '', targetTitle: node.title, createdAt: now })
          mounted.push({ node_id: node.id, graph_id: node.graph_id || '', title: node.title })
        }
        await saveStore(exec, store)
        return { ok: true, note: noteView(note), wiki_mounted: mounted, store_path: await fs.processPath(await resolveStore(exec, REL)) }
      }),
    }))

    tools.push(harness.defineTool({
      name: 'km_note_list',
      description: '列出笔记。可按标签/类型/关键词筛选。返回笔记摘要列表。',
      parameters: {
        tag: { type: 'string', description: '按标签筛选（任意匹配）' },
        note_type: { type: 'string', enum: ['note', 'daily'], description: '按类型筛选' },
        search: { type: 'string', description: '标题/内容关键词' },
        limit: { type: 'integer', description: '返回条数上限（默认 50，最大 200）' },
      },
      output: { schema: { type: 'object', additionalProperties: true }, render: renderText },
      execute: guard(async (args, exec) => {
        const store = await loadStore(exec)
        let notes = store.notes
        if (args.tag) notes = notes.filter((n) => (n.tags || []).includes(args.tag))
        if (args.note_type) notes = notes.filter((n) => n.type === args.note_type)
        if (args.search) {
          const q = args.search.toLowerCase()
          notes = notes.filter((n) => (n.title || '').toLowerCase().includes(q) || (n.content || '').toLowerCase().includes(q))
        }
        const limit = Math.min(args.limit || 50, 200)
        return { ok: true, total: notes.length, returned: Math.min(notes.length, limit), notes: notes.slice(0, limit).map(noteView) }
      }),
    }))

    tools.push(harness.defineTool({
      name: 'km_note_get',
      description: '读取一篇笔记：全文 + 出链（wiki 挂载的图谱节点）+ 入链（引用本笔记的其他笔记/反链）。',
      parameters: {
        note_id: { type: 'string', description: '笔记 id', required: true },
      },
      output: { schema: { type: 'object', additionalProperties: true }, render: renderText },
      execute: guard(async (args, exec) => {
        const store = await loadStore(exec)
        const note = store.notes.find((n) => n.id === args.note_id)
        if (!note) return { ok: false, error: 'note not found: ' + args.note_id }
        // 出链：本笔记挂载的节点
        const outbound = store.links.filter((l) => l.noteId === note.id).map((l) => ({ node_id: l.nodeId, graph_id: l.graphId, title: l.targetTitle }))
        // 入链（反链）：其他笔记正文 [[本笔记标题]]
        const inbound = []
        const lower = note.title.toLowerCase()
        for (const other of store.notes) {
          if (other.id === note.id) continue
          const titles = extractWikiLinks(other.content)
          if (titles.some((t) => t.toLowerCase() === lower)) {
            inbound.push({ note_id: other.id, title: other.title, updated_at: other.updated_at })
          }
        }
        return { ok: true, note: Object.assign(noteView(note), { content: note.content }), outbound, inbound }
      }),
    }))

    tools.push(harness.defineTool({
      name: 'km_note_link',
      description: '手动把笔记挂载到图谱节点（等同在内容里写 [[节点标题]]）。返回更新后的挂载。',
      parameters: {
        note_id: { type: 'string', description: '笔记 id', required: true },
        node_id: { type: 'string', description: '图谱节点 id', required: true },
      },
      output: { schema: { type: 'object', additionalProperties: true }, render: renderText },
      execute: guard(async (args, exec) => {
        const store = await loadStore(exec)
        const note = store.notes.find((n) => n.id === args.note_id)
        if (!note) return { ok: false, error: 'note not found: ' + args.note_id }
        if (store.links.some((l) => l.noteId === note.id && l.nodeId === args.node_id)) {
          return { ok: true, note_id: note.id, already_linked: true }
        }
        const graphIndex = await loadGraphIndex(exec)
        const node = graphIndex.nodes.find((n) => n.id === args.node_id)
        if (!node) return { ok: false, error: 'graph node not found: ' + args.node_id }
        const now = new Date().toISOString()
        store.links.push({ id: uid('lnk'), noteId: note.id, nodeId: node.id, graphId: node.graph_id || '', targetTitle: node.title, createdAt: now })
        note.updated_at = now
        await saveStore(exec, store)
        return { ok: true, note_id: note.id, linked: { node_id: node.id, graph_id: node.graph_id || '', title: node.title } }
      }),
    }))

    tools.push(harness.defineTool({
      name: 'km_note_backlinks',
      description: '查询一篇笔记的反链（哪些笔记通过 [[标题]] 引用了它）以及它挂载的节点。',
      parameters: {
        note_id: { type: 'string', description: '笔记 id', required: true },
      },
      output: { schema: { type: 'object', additionalProperties: true }, render: renderText },
      execute: guard(async (args, exec) => {
        const store = await loadStore(exec)
        const note = store.notes.find((n) => n.id === args.note_id)
        if (!note) return { ok: false, error: 'note not found: ' + args.note_id }
        const lower = note.title.toLowerCase()
        const inbound = store.notes.filter((o) => o.id !== note.id && extractWikiLinks(o.content).some((t) => t.toLowerCase() === lower))
          .map((o) => ({ note_id: o.id, title: o.title, updated_at: o.updated_at }))
        const outbound = store.links.filter((l) => l.noteId === note.id).map((l) => ({ node_id: l.nodeId, graph_id: l.graphId, title: l.targetTitle }))
        return { ok: true, note_id: note.id, title: note.title, inbound, outbound, inbound_total: inbound.length, outbound_total: outbound.length }
      }),
    }))

    tools.push(harness.defineTool({
      name: 'km_note_stats',
      description: '笔记统计：总数、类型分布、标签、wiki 挂载数、含反链的笔记数。',
      parameters: {},
      output: { schema: { type: 'object', additionalProperties: true }, render: renderText },
      execute: guard(async (_args, exec) => {
        const store = await loadStore(exec)
        const notes = store.notes
        const byType = { note: 0, daily: 0 }
        for (const n of notes) byType[n.type] = (byType[n.type] || 0) + 1
        const tagCounts = {}
        for (const n of notes) for (const t of n.tags || []) tagCounts[t] = (tagCounts[t] || 0) + 1
        const withLinks = notes.filter((n) => store.links.some((l) => l.noteId === n.id)).length
        const withInbound = notes.filter((n) => notes.some((o) => o.id !== n.id && extractWikiLinks(o.content).some((t) => t.toLowerCase() === n.title.toLowerCase()))).length
        return {
          ok: true, total_notes: notes.length, by_type: byType,
          top_tags: Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([tag, count]) => ({ tag, count })),
          wiki_mounts: store.links.length, notes_with_outbound: withLinks, notes_with_inbound: withInbound,
          store_path: await fs.processPath(await resolveStore(exec, REL)),
        }
      }),
    }))

    for (const def of tools) {
      ctx.effect(() => harness.registerTool(ctx, def))
    }
  },
}
