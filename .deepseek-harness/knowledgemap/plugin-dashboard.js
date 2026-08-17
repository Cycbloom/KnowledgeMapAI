// KnowledgeMap × DSH Harness — Phase 6: Client UI 面板（run card 内嵌仪表盘）
// Host: harness.handle('km-dashboard-data', {sessionId}) 提供四域聚合数据。
// Client: 注册 tool.view.cordis (key:'self')，在 cordis_run 卡片内渲染仪表盘。
// Usage: 传 code.host + code.client 给 cordis_define，然后 cordis_run。

// ============================ HOST ============================
const HOST = function () {
  return {
    apply(ctx) {
      const fs = ctx.get('fs')
      const sandboxPolicy = ctx.get('sandboxPolicy')
      if (fs === undefined || sandboxPolicy === undefined) return

      const BASE = '.deepseek-harness/knowledgemap'
      const FILES = { cards: 'cards.json', graphs: 'graphs.json', tasks: 'tasks.json', progress: 'progress.json' }

      function resolveRoot(args) {
        try {
          const sid = args && args.sessionId
          if (sid) {
            const sessions = ctx.get('sessions')
            const session = sessions ? sessions.get(sid) : undefined
            const cwd = session && session.header ? session.header.cwd : undefined
            if (cwd && typeof cwd === 'string') return cwd
          }
        } catch (e) { /* ignore */ }
        return sandboxPolicy.workspaceRoot
      }
      async function readStore(root, key) {
        const rel = BASE + '/' + FILES[key]
        const target = await fs.resolve(rel, { cwd: root })
        const info = await fs.stat(target)
        if (!info) return {}
        try {
          const parsed = JSON.parse(await fs.readText(target))
          if (parsed && typeof parsed === 'object') return parsed
        } catch (e) { /* fall through */ }
        return {}
      }
      async function buildDashboard(args) {
        const root = resolveRoot(args)
        const cards = await readStore(root, 'cards')
        const graphs = await readStore(root, 'graphs')
        const tasks = await readStore(root, 'tasks')
        const progress = await readStore(root, 'progress')
        const cardList = cards.cards || []
        const taskList = tasks.tasks || []
        const now = Date.now()
        const byState = { new: 0, learning: 0, review: 0, relearning: 0 }
        for (const c of cardList) byState[['new', 'learning', 'review', 'relearning'][c.state] || 'new']++
        const dueNow = cardList.filter((c) => c.state === 0 || (c.state !== 0 && c.due <= now)).length
        const taskByQueue = { q0: 0, q1: 0, q2: 0 }
        for (const t of taskList) taskByQueue['q' + t.queue_level] = (taskByQueue['q' + t.queue_level] || 0) + 1
        const activeTasks = taskList.filter((t) => ['pending', 'in_progress', 'paused'].includes(t.status)).length
        const totalFocusMin = Math.round(taskList.reduce((s, t) => s + (t.actual_duration_sec || 0), 0) / 60)
        const p = progress.xp !== undefined ? progress : null
        return {
          cards: { total: cardList.length, by_state: byState, due_now: dueNow },
          graphs: { total: (graphs.graphs || []).length, nodes: (graphs.nodes || []).length, edges: (graphs.edges || []).length },
          tasks: { total: taskList.length, active: activeTasks, by_queue: taskByQueue, focus_min: totalFocusMin },
          progress: p ? { level: p.level, xp: p.xp, streak: p.streak, achievements: Object.keys(p.unlocked || {}).length } : null,
          updated_at: new Date().toISOString(),
        }
      }
      ctx.effect(() => harness.handle('km-dashboard-data', async (args) => {
        return buildDashboard(args || {})
      }))
    },
  }
}

// ============================ CLIENT ============================
const CLIENT = function () {
  return {
    apply(ctx) {
      const slots = ctx.get('slots')
      if (slots === undefined) return

      function Stat(props) {
        return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 2, padding: '8px 12px', borderRadius: 8, background: 'var(--bg-2, rgba(128,128,128,0.08))' } },
          React.createElement('span', { style: { fontSize: 11, color: 'var(--text-2, #9ca3af)' } }, props.label),
          React.createElement('span', { style: { fontSize: 16, fontWeight: 600 } }, props.value),
        )
      }

      function Dashboard(props) {
        const [data, setData] = React.useState(null)
        const [error, setError] = React.useState(null)
        const sessionId = props && props.sessionId
        const load = React.useCallback(() => {
          host.call('km-dashboard-data', sessionId ? { sessionId } : {}).then((value) => {
            setData(value)
            setError(null)
          }).catch((e) => setError(String(e && e.message ? e.message : e)))
        }, [sessionId])
        React.useEffect(() => { load() }, [load])
        if (error) {
          return React.createElement('div', { style: { padding: 8, color: '#f87171', fontSize: 12 } }, 'KnowledgeMap: ' + error)
        }
        if (!data) {
          return React.createElement('div', { style: { padding: 8, fontSize: 12, color: 'var(--text-2, #9ca3af)' } }, '加载 KnowledgeMap 仪表盘…')
        }
        const c = data.cards || {}
        const g = data.graphs || {}
        const t = data.tasks || {}
        const p = data.progress
        return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 8, padding: 8 } },
          React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
            React.createElement('span', { style: { fontSize: 13, fontWeight: 600 } }, '🧠 KnowledgeMap 仪表盘'),
            React.createElement('button', { onClick: load, style: { fontSize: 11, border: '1px solid var(--border, rgba(128,128,128,0.3))', borderRadius: 6, background: 'transparent', padding: '2px 8px', cursor: 'pointer' } }, '刷新'),
          ),
          React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 } },
            React.createElement(Stat, { label: '复习待办', value: String(c.due_now || 0) }),
            React.createElement(Stat, { label: '图谱节点', value: String(g.nodes || 0) }),
            React.createElement(Stat, { label: '活跃任务', value: String(t.active || 0) }),
            React.createElement(Stat, { label: p ? 'Lv.' + p.level : '进度', value: p ? (p.streak ? p.streak + '🔥' : String(p.achievements || 0) + '🏅') : '—' }),
          ),
          React.createElement('div', { style: { fontSize: 11, color: 'var(--text-2, #9ca3af)' } },
            '闪卡 ' + (c.total || 0) + ' · 图 ' + (g.total || 0) + ' 节点 ' + (g.nodes || 0) + ' 边 ' + (g.edges || 0) +
            ' · 任务 ' + (t.total || 0) + ' 专注 ' + (t.focus_min || 0) + 'min' +
            (p ? ' · XP ' + p.xp : '') + ' · 更新 ' + (data.updated_at || '').slice(11, 19),
          ),
        )
      }

      slots.inject('tool.view.cordis', () => slots.register(
        { name: 'tool.view.cordis', key: 'self' },
        (props) => React.createElement(Dashboard, { sessionId: props && props.sessionId }),
      ))
    },
  }
}

// cordis_define 需要独立 host/client 字段；此文件供本地参考，
// 实际注册请把上面两个 const 的「函数体」分别传给 code.host / code.client。
export { HOST, CLIENT }
