// KnowledgeMap × DSH Harness — Phase 2: 知识图谱工具集
// Host half. 节点/边 CRUD + mermaid 导出 + 搜索。对齐 shared/types/graph-* 字段。
// Storage: <session cwd>/.deepseek-harness/knowledgemap/graphs.json via fs service.
// Usage: pass this function body to cordis_define (code.host), then cordis_run.

return {
  apply(ctx) {
    const fs = ctx.get('fs')
    const sandboxPolicy = ctx.get('sandboxPolicy')
    if (fs === undefined || sandboxPolicy === undefined) return

    const LEVELS = ['root', 'core', 'sub', 'normal', 'leaf']
    const RELATIONS = ['prerequisite', 'extension', 'related', 'cross_domain']
    const LAYOUTS = ['mindmap', 'timeline', 'tree', 'planet', 'quadrant', 'semantic']

    // ---------- persistence ----------
    const REL = '.deepseek-harness/knowledgemap/graphs.json'
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
    async function resolveStore(exec) {
      return fs.resolve(REL, { cwd: sessionRoot(exec) })
    }
    async function loadStore(exec) {
      const target = await resolveStore(exec)
      const info = await fs.stat(target)
      let store = { version: 1, graphs: [], nodes: [], edges: [] }
      if (info) {
        try {
          const parsed = JSON.parse(await fs.readText(target))
          if (parsed && Array.isArray(parsed.graphs)) store = parsed
        } catch (e) { /* fall through */ }
      }
      return store
    }
    async function saveStore(exec, store) {
      const target = await resolveStore(exec)
      const policy = writePolicy(exec)
      await fs.writeText(target, JSON.stringify(store, null, 2), undefined, undefined, policy)
    }
    async function storeDisplayPath(exec) {
      const target = await resolveStore(exec)
      return fs.processPath(target)
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

    // ---------- helpers ----------
    function nodeView(n) {
      return {
        id: n.id, graph_id: n.graph_id, title: n.title, level: n.level || 'normal',
        content: n.content || '', tags: n.tags || [], aliases: n.aliases || [],
        x_position: n.x_position, y_position: n.y_position,
        created_at: n.created_at, updated_at: n.updated_at,
      }
    }
    function edgeView(e) {
      return {
        id: e.id, graph_id: e.graph_id, source: e.source, target: e.target,
        relationship_type: e.relationship_type || 'related', weight: e.weight || 1,
        custom_label: e.custom_label || undefined, created_at: e.created_at,
      }
    }
    function graphView(g, store) {
      const nodes = store.nodes.filter((n) => n.graph_id === g.id)
      const edges = store.edges.filter((e) => e.graph_id === g.id)
      return {
        id: g.id, title: g.title, description: g.description || '',
        layout: g.layout || 'mindmap', node_count: nodes.length, edge_count: edges.length,
        created_at: g.created_at, updated_at: g.updated_at,
      }
    }
    function mermaidEscape(text) {
      return String(text || '')
        .replace(/"/g, '&quot;')
        .replace(/\[/g, '&#91;')
        .replace(/\]/g, '&#93;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br/>')
    }
    function toMermaid(graph, nodes, edges) {
      const lines = ['graph TD']
      const idMap = new Map()
      let idx = 0
      for (const n of nodes) {
        const mid = 'n' + idx++
        idMap.set(n.id, mid)
        lines.push(`  ${mid}["${mermaidEscape(n.title)}"]`)
      }
      const nodeIds = new Set(nodes.map((n) => n.id))
      for (const e of edges) {
        if (!nodeIds.has(e.source) || !nodeIds.has(e.target)) continue
        const label = e.custom_label || e.relationship_type || 'related'
        lines.push(`  ${idMap.get(e.source)} -->|${mermaidEscape(label)}| ${idMap.get(e.target)}`)
      }
      return lines.join('\n')
    }

    // ---------- tools ----------
    const tools = []

    tools.push(harness.defineTool({
      name: 'km_graph_create',
      description: '创建一个知识图谱（KnowledgeMap）。返回图谱信息。',
      parameters: {
        title: { type: 'string', description: '图谱标题', required: true },
        description: { type: 'string', description: '图谱描述' },
        layout: { type: 'string', enum: ['mindmap', 'timeline', 'tree', 'planet', 'quadrant', 'semantic'], description: '布局模式（默认 mindmap）' },
      },
      output: { schema: { type: 'object', additionalProperties: true }, render: renderText },
      execute: guard(async (args, exec) => {
        const store = await loadStore(exec)
        const now = new Date().toISOString()
        const g = {
          id: uid('g'), title: args.title, description: args.description || '',
          layout: args.layout || 'mindmap', created_at: now, updated_at: now,
        }
        store.graphs.push(g)
        await saveStore(exec, store)
        return { ok: true, graph: graphView(g, store), store_path: await storeDisplayPath(exec) }
      }),
    }))

    tools.push(harness.defineTool({
      name: 'km_graph_node_add',
      description: '向图谱添加一个知识点节点。返回节点及其所属图谱的统计。',
      parameters: {
        graph_id: { type: 'string', description: '图谱 id', required: true },
        title: { type: 'string', description: '节点标题（知识点名称）', required: true },
        content: { type: 'string', description: '节点内容/说明' },
        level: { type: 'string', enum: ['root', 'core', 'sub', 'normal', 'leaf'], description: '节点层级（默认 normal）' },
        tags: { type: 'array', items: { type: 'string' }, description: '标签列表' },
        aliases: { type: 'array', items: { type: 'string' }, description: '别名列表' },
        x: { type: 'number', description: 'x 坐标（布局用）' },
        y: { type: 'number', description: 'y 坐标（布局用）' },
      },
      output: { schema: { type: 'object', additionalProperties: true }, render: renderText },
      execute: guard(async (args, exec) => {
        const store = await loadStore(exec)
        const graph = store.graphs.find((g) => g.id === args.graph_id)
        if (!graph) return { ok: false, error: 'graph not found: ' + args.graph_id }
        const now = new Date().toISOString()
        const node = {
          id: uid('n'), graph_id: args.graph_id, title: args.title,
          content: args.content || '', level: args.level || 'normal',
          tags: args.tags || [], aliases: args.aliases || [],
          x_position: args.x || 0, y_position: args.y || 0,
          created_at: now, updated_at: now,
        }
        store.nodes.push(node)
        graph.updated_at = now
        await saveStore(exec, store)
        return { ok: true, node: nodeView(node), graph: graphView(graph, store) }
      }),
    }))

    tools.push(harness.defineTool({
      name: 'km_graph_link',
      description: '在图谱中连接两个节点（创建边/关系）。source 与 target 必须是该图谱中已存在的节点。',
      parameters: {
        graph_id: { type: 'string', description: '图谱 id', required: true },
        source: { type: 'string', description: '源节点 id', required: true },
        target: { type: 'string', description: '目标节点 id', required: true },
        relationship_type: { type: 'string', enum: ['prerequisite', 'extension', 'related', 'cross_domain'], description: '关系类型（默认 related）' },
        weight: { type: 'number', description: '关系权重（默认 1）' },
        custom_label: { type: 'string', description: '自定义边标签（显示用）' },
      },
      output: { schema: { type: 'object', additionalProperties: true }, render: renderText },
      execute: guard(async (args, exec) => {
        const store = await loadStore(exec)
        const graph = store.graphs.find((g) => g.id === args.graph_id)
        if (!graph) return { ok: false, error: 'graph not found: ' + args.graph_id }
        const hasSource = store.nodes.some((n) => n.id === args.source && n.graph_id === args.graph_id)
        const hasTarget = store.nodes.some((n) => n.id === args.target && n.graph_id === args.graph_id)
        if (!hasSource) return { ok: false, error: 'source node not found in graph: ' + args.source }
        if (!hasTarget) return { ok: false, error: 'target node not found in graph: ' + args.target }
        if (args.source === args.target) return { ok: false, error: 'source and target must differ' }
        const now = new Date().toISOString()
        const edge = {
          id: uid('e'), graph_id: args.graph_id,
          source: args.source, target: args.target,
          relationship_type: args.relationship_type || 'related',
          weight: args.weight || 1, custom_label: args.custom_label || undefined,
          created_at: now,
        }
        store.edges.push(edge)
        graph.updated_at = now
        await saveStore(exec, store)
        return { ok: true, edge: edgeView(edge), graph: graphView(graph, store) }
      }),
    }))

    tools.push(harness.defineTool({
      name: 'km_graph_list',
      description: '列出所有知识图谱（含节点/边数量）。可按标题关键词筛选。',
      parameters: {
        query: { type: 'string', description: '按标题关键词筛选' },
      },
      output: { schema: { type: 'object', additionalProperties: true }, render: renderText },
      execute: guard(async (args, exec) => {
        const store = await loadStore(exec)
        let graphs = store.graphs
        if (args.query) {
          const q = args.query.toLowerCase()
          graphs = graphs.filter((g) => g.title.toLowerCase().includes(q))
        }
        return { ok: true, total: graphs.length, graphs: graphs.map((g) => graphView(g, store)) }
      }),
    }))

    tools.push(harness.defineTool({
      name: 'km_graph_export',
      description: '导出图谱为 mermaid（默认，可直接用 dsh-ui mermaid 渲染）或 JSON。返回导出内容。',
      parameters: {
        graph_id: { type: 'string', description: '图谱 id', required: true },
        format: { type: 'string', enum: ['mermaid', 'json'], description: '导出格式（默认 mermaid）' },
      },
      output: { schema: { type: 'object', additionalProperties: true }, render: renderText },
      execute: guard(async (args, exec) => {
        const store = await loadStore(exec)
        const graph = store.graphs.find((g) => g.id === args.graph_id)
        if (!graph) return { ok: false, error: 'graph not found: ' + args.graph_id }
        const nodes = store.nodes.filter((n) => n.graph_id === args.graph_id)
        const edges = store.edges.filter((e) => e.graph_id === args.graph_id)
        if (args.format === 'json') {
          return {
            ok: true, graph: graphView(graph, store),
            data: { graph, nodes: nodes.map(nodeView), edges: edges.map(edgeView) },
          }
        }
        return {
          ok: true, graph: graphView(graph, store),
          mermaid: toMermaid(graph, nodes, edges),
          hint: '将此 mermaid 代码放入 dsh-ui 围栏的 mermaid 组件即可渲染图谱',
        }
      }),
    }))

    tools.push(harness.defineTool({
      name: 'km_graph_search',
      description: '在图谱中按关键词搜索节点（标题/内容/标签/别名，忽略大小写）。可限定单个图谱。',
      parameters: {
        query: { type: 'string', description: '搜索关键词', required: true },
        graph_id: { type: 'string', description: '限定图谱（默认全部）' },
        limit: { type: 'integer', description: '返回条数上限（默认 20，最大 100）' },
      },
      output: { schema: { type: 'object', additionalProperties: true }, render: renderText },
      execute: guard(async (args, exec) => {
        const store = await loadStore(exec)
        const q = args.query.toLowerCase()
        let nodes = store.nodes.filter((n) => {
          if (args.graph_id && n.graph_id !== args.graph_id) return false
          if (n.title && n.title.toLowerCase().includes(q)) return true
          if (n.content && n.content.toLowerCase().includes(q)) return true
          if ((n.tags || []).some((t) => t.toLowerCase().includes(q))) return true
          if ((n.aliases || []).some((a) => a.toLowerCase().includes(q))) return true
          return false
        })
        const limit = Math.min(args.limit || 20, 100)
        const sliced = nodes.slice(0, limit)
        const graphTitles = {}
        for (const g of store.graphs) graphTitles[g.id] = g.title
        return {
          ok: true, query: args.query, total: nodes.length, returned: sliced.length,
          nodes: sliced.map((n) => Object.assign({ graph_title: graphTitles[n.graph_id] || '' }, nodeView(n))),
        }
      }),
    }))

    for (const def of tools) {
      ctx.effect(() => harness.registerTool(ctx, def))
    }
  },
}
