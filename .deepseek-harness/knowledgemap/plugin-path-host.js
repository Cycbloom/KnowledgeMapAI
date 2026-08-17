// KnowledgeMap × DSH Harness — Phase 9: 学习路径（Learning Paths）
// Host half. 对齐 shared/types/common.ts（LearningPath / LearningPathNodeRef）。
// 把图谱节点编排成「目标 → 节点序列 → 进度」的学习路径。
// Storage: <session cwd>/.deepseek-harness/knowledgemap/paths.json via fs service.
// Usage: pass this function body to cordis_define (code.host), then cordis_run.

return {
  apply(ctx) {
    const fs = ctx.get('fs')
    const sandboxPolicy = ctx.get('sandboxPolicy')
    if (fs === undefined || sandboxPolicy === undefined) return

    const PATH_STATUSES = ['active', 'completed', 'paused', 'archived']
    const NODE_STATUSES = ['pending', 'in_progress', 'completed', 'skipped']

    // ---------- persistence ----------
    const REL = '.deepseek-harness/knowledgemap/paths.json'
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
      let store = { version: 1, paths: [] }
      if (info) {
        try {
          const parsed = JSON.parse(await fs.readText(target))
          if (parsed && Array.isArray(parsed.paths)) store = parsed
        } catch (e) { /* fall through */ }
      }
      return store
    }
    async function saveStore(exec, store) {
      const target = await resolveStore(exec)
      const policy = writePolicy(exec)
      await fs.writeText(target, JSON.stringify(store, null, 2), undefined, undefined, policy)
    }
    function uid(prefix) {
      return (prefix || 'p') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8)
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
    // 重新计算路径进度（completed_nodes / progress_percentage / status）
    function recompute(p) {
      const nodes = p.nodes || []
      const done = nodes.filter((n) => n.status === 'completed').length
      p.total_nodes = nodes.length
      p.completed_nodes = done
      p.progress_percentage = nodes.length ? Math.round((done / nodes.length) * 100) : 0
      if (nodes.length && done === nodes.length && p.status === 'active') p.status = 'completed'
      return p
    }
    function pathView(p) {
      return {
        id: p.id, title: p.title, description: p.description || '', goal: p.goal || '',
        status: p.status || 'active', total_nodes: p.total_nodes || 0, completed_nodes: p.completed_nodes || 0,
        progress_percentage: p.progress_percentage || 0, daily_minutes_target: p.daily_minutes_target || null,
        target_completion_date: p.target_completion_date || null,
        created_at: p.created_at, updated_at: p.updated_at,
        nodes: (p.nodes || []).map((n) => ({
          id: n.id, node_id: n.node_id, title: n.title, status: n.status || 'pending',
          estimated_minutes: n.estimated_minutes || 0, difficulty_level: n.difficulty_level || 1,
          completed_at: n.completed_at || null,
        })),
      }
    }

    // ---------- tools ----------
    const tools = []

    tools.push(harness.defineTool({
      name: 'km_path_create',
      description: '创建一个学习路径（Learning Path）：设定目标，后续把图谱节点编排进路径并按序学习。返回创建的路径。',
      parameters: {
        title: { type: 'string', description: '路径标题', required: true },
        description: { type: 'string', description: '路径描述' },
        goal: { type: 'string', description: '学习目标（自然语言）' },
        daily_minutes_target: { type: 'integer', description: '每日学习分钟目标' },
        target_completion_date: { type: 'string', description: '目标完成日期（ISO 字符串）' },
      },
      output: { schema: { type: 'object', additionalProperties: true }, render: renderText },
      execute: guard(async (args, exec) => {
        const store = await loadStore(exec)
        const now = new Date().toISOString()
        const p = {
          id: uid('p'), title: args.title, description: args.description || '', goal: args.goal || '',
          status: 'active', total_nodes: 0, completed_nodes: 0, progress_percentage: 0,
          daily_minutes_target: args.daily_minutes_target || null,
          target_completion_date: args.target_completion_date || null,
          nodes: [], created_at: now, updated_at: now,
        }
        store.paths.push(p)
        await saveStore(exec, store)
        return { ok: true, path: pathView(p), store_path: await fs.processPath(await resolveStore(exec)) }
      }),
    }))

    tools.push(harness.defineTool({
      name: 'km_path_node_add',
      description: '把图谱中的一个节点加入学习路径（需传入图谱中已存在的节点 id）。返回路径与节点。',
      parameters: {
        path_id: { type: 'string', description: '路径 id', required: true },
        node_id: { type: 'string', description: '图谱节点 id', required: true },
        estimated_minutes: { type: 'integer', description: '预计学习分钟数' },
        difficulty_level: { type: 'integer', description: '难度 1-5（默认 1）' },
      },
      output: { schema: { type: 'object', additionalProperties: true }, render: renderText },
      execute: guard(async (args, exec) => {
        const store = await loadStore(exec)
        const path = store.paths.find((p) => p.id === args.path_id)
        if (!path) return { ok: false, error: 'path not found: ' + args.path_id }
        if (path.nodes.some((n) => n.node_id === args.node_id)) return { ok: false, error: 'node already in path: ' + args.node_id }
        // 从图谱取节点标题（graphs.json）
        const graphsTarget = await fs.resolve('.deepseek-harness/knowledgemap/graphs.json', { cwd: sessionRoot(exec) })
        const graphsInfo = await fs.stat(graphsTarget)
        let nodeTitle = args.node_id
        if (graphsInfo) {
          try {
            const graphs = JSON.parse(await fs.readText(graphsTarget))
            const found = (graphs.nodes || []).find((n) => n.id === args.node_id)
            if (found) nodeTitle = found.title
          } catch (e) { /* keep id as title */ }
        }
        const now = new Date().toISOString()
        path.nodes.push({
          id: uid('pn'), node_id: args.node_id, title: nodeTitle, status: 'pending',
          estimated_minutes: args.estimated_minutes || 0, difficulty_level: args.difficulty_level || 1,
          completed_at: null, created_at: now, updated_at: now,
        })
        recompute(path)
        path.updated_at = now
        await saveStore(exec, store)
        return { ok: true, path: pathView(path) }
      }),
    }))

    tools.push(harness.defineTool({
      name: 'km_path_list',
      description: '列出所有学习路径（含节点数与进度）。可按标题关键词筛选。',
      parameters: {
        query: { type: 'string', description: '按标题关键词筛选' },
      },
      output: { schema: { type: 'object', additionalProperties: true }, render: renderText },
      execute: guard(async (args, exec) => {
        const store = await loadStore(exec)
        let paths = store.paths
        if (args.query) {
          const q = args.query.toLowerCase()
          paths = paths.filter((p) => p.title.toLowerCase().includes(q))
        }
        return { ok: true, total: paths.length, paths: paths.map(pathView) }
      }),
    }))

    tools.push(harness.defineTool({
      name: 'km_path_node_start',
      description: '把路径中的某个节点标记为 in_progress（开始学习）。返回路径。',
      parameters: {
        path_id: { type: 'string', description: '路径 id', required: true },
        node_ref_id: { type: 'string', description: '路径节点 id（km_path_node_add 返回的节点 id）', required: true },
      },
      output: { schema: { type: 'object', additionalProperties: true }, render: renderText },
      execute: guard(async (args, exec) => {
        const store = await loadStore(exec)
        const path = store.paths.find((p) => p.id === args.path_id)
        if (!path) return { ok: false, error: 'path not found: ' + args.path_id }
        const node = (path.nodes || []).find((n) => n.id === args.node_ref_id)
        if (!node) return { ok: false, error: 'node ref not found in path: ' + args.node_ref_id }
        if (node.status === 'completed') return { ok: false, error: 'node already completed' }
        node.status = 'in_progress'
        node.updated_at = new Date().toISOString()
        path.updated_at = node.updated_at
        await saveStore(exec, store)
        return { ok: true, path: pathView(path) }
      }),
    }))

    tools.push(harness.defineTool({
      name: 'km_path_node_complete',
      description: '把路径中的某个节点标记为 completed（完成学习），自动更新路径进度百分比。返回路径。',
      parameters: {
        path_id: { type: 'string', description: '路径 id', required: true },
        node_ref_id: { type: 'string', description: '路径节点 id', required: true },
      },
      output: { schema: { type: 'object', additionalProperties: true }, render: renderText },
      execute: guard(async (args, exec) => {
        const store = await loadStore(exec)
        const path = store.paths.find((p) => p.id === args.path_id)
        if (!path) return { ok: false, error: 'path not found: ' + args.path_id }
        const node = (path.nodes || []).find((n) => n.id === args.node_ref_id)
        if (!node) return { ok: false, error: 'node ref not found in path: ' + args.node_ref_id }
        const now = new Date().toISOString()
        node.status = 'completed'
        node.completed_at = now
        node.updated_at = now
        recompute(path)
        path.updated_at = now
        await saveStore(exec, store)
        return { ok: true, path: pathView(path) }
      }),
    }))

    tools.push(harness.defineTool({
      name: 'km_path_stats',
      description: '学习路径统计：路径数、进行中/已完成、平均进度、全部节点完成率。',
      parameters: {},
      output: { schema: { type: 'object', additionalProperties: true }, render: renderText },
      execute: guard(async (_args, exec) => {
        const store = await loadStore(exec)
        const paths = store.paths
        const byStatus = { active: 0, completed: 0, paused: 0, archived: 0 }
        for (const p of paths) byStatus[p.status] = (byStatus[p.status] || 0) + 1
        const avgProgress = paths.length ? Math.round(paths.reduce((s, p) => s + (p.progress_percentage || 0), 0) / paths.length) : 0
        const allNodes = paths.reduce((s, p) => s + (p.nodes || []).length, 0)
        const doneNodes = paths.reduce((s, p) => s + (p.completed_nodes || 0), 0)
        return {
          ok: true, total_paths: paths.length, by_status: byStatus,
          avg_progress: avgProgress,
          total_nodes: allNodes, completed_nodes: doneNodes,
          node_completion_rate: allNodes ? Math.round((doneNodes / allNodes) * 100) : 0,
          store_path: await fs.processPath(await resolveStore(exec)),
        }
      }),
    }))

    for (const def of tools) {
      ctx.effect(() => harness.registerTool(ctx, def))
    }
  },
}
