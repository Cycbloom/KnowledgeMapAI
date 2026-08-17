// KnowledgeMap × DSH Harness — Phase 3: 任务调度器 (Q0/Q1/Q2 + 番茄钟)
// Host half. 对齐 shared/types/scheduler-* 字段（queue_level、UserTaskStatus、TaskType）。
// Storage: <session cwd>/.deepseek-harness/knowledgemap/tasks.json via fs service.
// Usage: pass this function body to cordis_define (code.host), then cordis_run.

return {
  apply(ctx) {
    const fs = ctx.get('fs')
    const sandboxPolicy = ctx.get('sandboxPolicy')
    if (fs === undefined || sandboxPolicy === undefined) return

    const QUEUE_NAMES = { 0: 'q0', 1: 'q1', 2: 'q2' }
    const QUEUE_LABELS = { 0: 'Q0 专注', 1: 'Q1 标准', 2: 'Q2 后台' }
    const STATUSES = ['pending', 'in_progress', 'paused', 'completed', 'cancelled']
    const TASK_TYPES = ['one_time', 'long_term', 'periodic', 'learning', 'graph_learning']
    // 默认时间片（秒）：Q0 25min / Q1 45min / Q2 60min / 休息 5min
    const DEFAULT_SETTINGS = { q0_time_slice: 1500, q1_time_slice: 2700, q2_time_slice: 3600, break_duration: 300 }

    // ---------- persistence ----------
    const REL = '.deepseek-harness/knowledgemap/tasks.json'
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
      let store = { version: 1, tasks: [], settings: Object.assign({}, DEFAULT_SETTINGS) }
      if (info) {
        try {
          const parsed = JSON.parse(await fs.readText(target))
          if (parsed && Array.isArray(parsed.tasks)) {
            store = parsed
            store.settings = Object.assign({}, DEFAULT_SETTINGS, parsed.settings || {})
          }
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
      return (prefix || 't') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8)
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
    function taskView(t) {
      const focusTotal = (t.focus_sessions || []).reduce((s, f) => s + (f.duration_sec || 0), 0)
      return {
        id: t.id, title: t.title, description: t.description || '',
        queue_level: t.queue_level, queue: QUEUE_NAMES[t.queue_level] || 'q1', queue_label: QUEUE_LABELS[t.queue_level] || 'Q1 标准',
        status: t.status || 'pending', priority: t.priority || 3,
        estimated_duration: t.estimated_duration || null, deadline: t.deadline || null,
        tags: t.tags || [], task_type: t.task_type || 'one_time',
        actual_duration_sec: t.actual_duration_sec || 0, focus_sessions: (t.focus_sessions || []).length,
        focus_total_min: Math.round(focusTotal / 60),
        created_at: t.created_at, updated_at: t.updated_at, completed_at: t.completed_at || null,
      }
    }
    function queueSummary(store) {
      const byQueue = { q0: 0, q1: 0, q2: 0 }
      const byStatus = { pending: 0, in_progress: 0, paused: 0, completed: 0, cancelled: 0 }
      for (const t of store.tasks) {
        const q = QUEUE_NAMES[t.queue_level] || 'q1'
        byQueue[q] = (byQueue[q] || 0) + 1
        const s = STATUSES.includes(t.status) ? t.status : 'pending'
        byStatus[s] = (byStatus[s] || 0) + 1
      }
      return { by_queue: byQueue, by_status: byStatus, total: store.tasks.length }
    }

    // ---------- tools ----------
    const tools = []

    tools.push(harness.defineTool({
      name: 'km_task_add',
      description: '添加一个任务到三级反馈队列（Q0 专注 / Q1 标准 / Q2 后台）。返回创建的任务。',
      parameters: {
        title: { type: 'string', description: '任务标题', required: true },
        description: { type: 'string', description: '任务描述' },
        queue_level: { type: 'integer', enum: [0, 1, 2], description: '队列层级：0=Q0专注 1=Q1标准 2=Q2后台（默认 1）' },
        priority: { type: 'integer', description: '优先级 1-5（默认 3）' },
        estimated_duration: { type: 'integer', description: '预计耗时（分钟）' },
        deadline: { type: 'string', description: '截止时间（ISO 字符串）' },
        tags: { type: 'array', items: { type: 'string' }, description: '标签列表' },
        task_type: { type: 'string', enum: ['one_time', 'long_term', 'periodic', 'learning', 'graph_learning'], description: '任务类型（默认 one_time）' },
      },
      output: { schema: { type: 'object', additionalProperties: true }, render: renderText },
      execute: guard(async (args, exec) => {
        const store = await loadStore(exec)
        const now = new Date().toISOString()
        const task = {
          id: uid('t'), title: args.title, description: args.description || '',
          queue_level: args.queue_level === undefined ? 1 : args.queue_level,
          status: 'pending', priority: args.priority || 3,
          estimated_duration: args.estimated_duration || null, deadline: args.deadline || null,
          tags: args.tags || [], task_type: args.task_type || 'one_time',
          actual_duration_sec: 0, focus_sessions: [],
          created_at: now, updated_at: now, completed_at: null,
        }
        store.tasks.push(task)
        await saveStore(exec, store)
        return { ok: true, task: taskView(task), summary: queueSummary(store), store_path: await storeDisplayPath(exec) }
      }),
    }))

    tools.push(harness.defineTool({
      name: 'km_task_list',
      description: '列出任务。可按队列/状态/标签筛选。返回任务摘要列表。',
      parameters: {
        queue_level: { type: 'integer', enum: [0, 1, 2], description: '按队列层级筛选（0/1/2）' },
        status: { type: 'string', enum: ['pending', 'in_progress', 'paused', 'completed', 'cancelled'], description: '按状态筛选' },
        tag: { type: 'string', description: '按标签筛选（任意匹配）' },
        limit: { type: 'integer', description: '返回条数上限（默认 50，最大 200）' },
      },
      output: { schema: { type: 'object', additionalProperties: true }, render: renderText },
      execute: guard(async (args, exec) => {
        const store = await loadStore(exec)
        let tasks = store.tasks
        if (args.queue_level !== undefined) tasks = tasks.filter((t) => t.queue_level === args.queue_level)
        if (args.status) tasks = tasks.filter((t) => t.status === args.status)
        if (args.tag) tasks = tasks.filter((t) => (t.tags || []).includes(args.tag))
        const limit = Math.min(args.limit || 50, 200)
        const sliced = tasks.slice(0, limit)
        return { ok: true, total: tasks.length, returned: sliced.length, tasks: sliced.map(taskView), summary: queueSummary(store) }
      }),
    }))

    tools.push(harness.defineTool({
      name: 'km_task_start',
      description: '开始一个任务的番茄钟（focus session）。任务状态置为 in_progress 并记录开始时间。返回本次专注的开始信息与建议时间片。',
      parameters: {
        task_id: { type: 'string', description: '任务 id', required: true },
      },
      output: { schema: { type: 'object', additionalProperties: true }, render: renderText },
      execute: guard(async (args, exec) => {
        const store = await loadStore(exec)
        const task = store.tasks.find((t) => t.id === args.task_id)
        if (!task) return { ok: false, error: 'task not found: ' + args.task_id }
        if (task.status === 'completed') return { ok: false, error: 'task already completed' }
        // 若已有未结束的 focus session，拒绝重复开始
        const open = (task.focus_sessions || []).find((f) => !f.ended_at)
        if (open) {
          return { ok: false, error: 'a focus session is already running, end it first (km_task_focus_end)' }
        }
        const now = new Date()
        task.status = 'in_progress'
        task.focus_sessions = task.focus_sessions || []
        task.focus_sessions.push({ started_at: now.toISOString(), ended_at: null, duration_sec: 0 })
        task.updated_at = now.toISOString()
        await saveStore(exec, store)
        const sliceSec = store.settings['q' + task.queue_level + '_time_slice'] || DEFAULT_SETTINGS.q1_time_slice
        return {
          ok: true,
          task: taskView(task),
          focus: {
            started_at: task.focus_sessions[task.focus_sessions.length - 1].started_at,
            time_slice_sec: sliceSec, time_slice_min: Math.round(sliceSec / 60),
            break_duration_sec: store.settings.break_duration,
          },
        }
      }),
    }))

    tools.push(harness.defineTool({
      name: 'km_task_focus_end',
      description: '结束任务当前的番茄钟，累计实际专注时长。返回本次专注耗时与建议休息时长。',
      parameters: {
        task_id: { type: 'string', description: '任务 id', required: true },
      },
      output: { schema: { type: 'object', additionalProperties: true }, render: renderText },
      execute: guard(async (args, exec) => {
        const store = await loadStore(exec)
        const task = store.tasks.find((t) => t.id === args.task_id)
        if (!task) return { ok: false, error: 'task not found: ' + args.task_id }
        const sessions = task.focus_sessions || []
        const open = sessions.find((f) => !f.ended_at)
        if (!open) return { ok: false, error: 'no running focus session for this task' }
        const now = new Date()
        const started = new Date(open.started_at)
        const durationSec = Math.max(0, Math.round((now.getTime() - started.getTime()) / 1000))
        open.ended_at = now.toISOString()
        open.duration_sec = durationSec
        task.actual_duration_sec = (task.actual_duration_sec || 0) + durationSec
        task.updated_at = now.toISOString()
        await saveStore(exec, store)
        return {
          ok: true,
          task: taskView(task),
          focus: { started_at: open.started_at, ended_at: open.ended_at, duration_sec: durationSec, duration_min: Math.round(durationSec / 60) },
          suggest_break_min: Math.round((store.settings.break_duration || 300) / 60),
        }
      }),
    }))

    tools.push(harness.defineTool({
      name: 'km_task_complete',
      description: '完成任务（status=completed）。若有进行中的番茄钟会一并结算。返回完成信息与队列统计。',
      parameters: {
        task_id: { type: 'string', description: '任务 id', required: true },
      },
      output: { schema: { type: 'object', additionalProperties: true }, render: renderText },
      execute: guard(async (args, exec) => {
        const store = await loadStore(exec)
        const task = store.tasks.find((t) => t.id === args.task_id)
        if (!task) return { ok: false, error: 'task not found: ' + args.task_id }
        const now = new Date()
        // 结算未结束的 focus session
        const sessions = task.focus_sessions || []
        const open = sessions.find((f) => !f.ended_at)
        if (open) {
          const started = new Date(open.started_at)
          const durationSec = Math.max(0, Math.round((now.getTime() - started.getTime()) / 1000))
          open.ended_at = now.toISOString()
          open.duration_sec = durationSec
          task.actual_duration_sec = (task.actual_duration_sec || 0) + durationSec
        }
        task.status = 'completed'
        task.completed_at = now.toISOString()
        task.updated_at = now.toISOString()
        await saveStore(exec, store)
        return { ok: true, task: taskView(task), summary: queueSummary(store) }
      }),
    }))

    tools.push(harness.defineTool({
      name: 'km_task_stats',
      description: '任务调度统计：队列分布、状态分布、今日完成、完成率、总专注时长。',
      parameters: {
        queue_level: { type: 'integer', enum: [0, 1, 2], description: '只看某个队列' },
      },
      output: { schema: { type: 'object', additionalProperties: true }, render: renderText },
      execute: guard(async (args, exec) => {
        const store = await loadStore(exec)
        let tasks = store.tasks
        if (args.queue_level !== undefined) tasks = tasks.filter((t) => t.queue_level === args.queue_level)
        const now = new Date()
        const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0)
        const doneToday = tasks.filter((t) => t.status === 'completed' && t.completed_at && new Date(t.completed_at) >= startOfDay).length
        const completed = tasks.filter((t) => t.status === 'completed').length
        const completionRate = tasks.length ? Math.round((completed / tasks.length) * 100) : 0
        const totalFocusSec = tasks.reduce((s, t) => s + (t.actual_duration_sec || 0), 0)
        const q = { q0: 0, q1: 0, q2: 0 }
        for (const t of tasks) q[QUEUE_NAMES[t.queue_level] || 'q1']++
        return {
          ok: true, total: tasks.length, completed, completion_rate: completionRate,
          done_today: doneToday, total_focus_min: Math.round(totalFocusSec / 60),
          by_queue: q,
          by_status: {
            pending: tasks.filter((t) => t.status === 'pending').length,
            in_progress: tasks.filter((t) => t.status === 'in_progress').length,
            paused: tasks.filter((t) => t.status === 'paused').length,
            completed,
            cancelled: tasks.filter((t) => t.status === 'cancelled').length,
          },
          settings: store.settings,
          store_path: await storeDisplayPath(exec),
        }
      }),
    }))

    for (const def of tools) {
      ctx.effect(() => harness.registerTool(ctx, def))
    }
  },
}
